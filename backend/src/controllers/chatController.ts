import { Request, Response } from 'express';
import { ChatRequestSchema, SSEEvent } from '../types';
import { generateEmbedding, ingestKnowledgeItem } from '../services/embeddings/embeddingPipeline';
import { hybridRetrieve } from '../services/retrieval/hybridRetriever';
import {
  routeToLLM,
  classifyIntent,
  getModelRegistryStatus,
  RouteExecutionMetadata,
} from '../services/llm/modelRouter';
import {
  buildSystemPrompt,
  extractActions,
  extractProductCards,
  validateResponse,
} from '../services/llm/promptBuilder';
import {
  runCatalogGuard,
  isRestaurantQuery,
  buildKnowledgeUnavailableResponse,
} from '../services/guard/catalogGuard';
import { executeToolAction } from '../services/tools/toolExecutor';
import { recordEvent, getMetrics, getFullTelemetryDashboard } from '../services/telemetry/telemetryService';
import { generateRecommendations, generateHomepageRecommendations, generateDashboardRecommendations } from '../services/recommendation/recommendationEngine';
import { checkSystemHealth } from '../services/monitor/connectionMonitor';
import { sendProductionErrorAlert, getAlertHistory } from '../services/alerts/emailAlertService';
import { transcribeAudio, synthesizeSpeech } from '../services/speech/speechService';
import { cache } from '../config/cache';
import { invalidateMenuCache, fetchLiveMenu } from '../services/menu/liveMenuService';

// ── SSE Helper ────────────────────────────────────────────────────────────────
function sendSSE(res: Response, event: SSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  if (typeof (res as any).flush === 'function') {
    (res as any).flush();
  }
}

// ── 1. Live Chat SSE Stream Gateway (Intent-Routed, Zero-Hallucination) ────────
export async function handleChatStream(req: Request, res: Response): Promise<void> {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }
  const { messages, sessionId, websiteContext = {} } = parsed.data;
  const requestId = `req_${Math.random().toString(36).substring(2, 9)}`;
  const userAuthToken = req.headers.authorization;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let isClientConnected = true;
  req.on('close', () => {
    isClientConnected = false;
  });

  const userQuery = messages.at(-1)?.content ?? '';

  // ── Diagnostic tracking object (built up during pipeline) ──
  const diag = {
    intent: '',
    embeddingGenerated: false,
    pineconeQueried: false,
    pineconeLatencyMs: 0,
    vectorsRetrieved: 0,
    topSimilarityScore: 0,
    retrievedDocumentIds: [] as string[],
    firestoreQueried: false,
    firestoreCollectionsAccessed: [] as string[],
    finalContextLengthChars: 0,
    restaurantKnowledgeUsed: false,
    catalogGuardStatus: 'PASS',
    flaggedHallucinatedItems: [] as string[],
  };

  try {
    // ── Step 1: Intelligent Intent Classification ──
    const intent = classifyIntent(messages, websiteContext as any);
    diag.intent = intent;
    if (isClientConnected) {
      sendSSE(res, {
        type: 'thinking',
        data: { stage: 'intent', label: `Classified: ${intent.replace(/_/g, ' ')}` },
      });
    }

    // ── Step 2: Determine if this is a restaurant knowledge query ──
    const isRestaurant = intent !== 'GENERAL_CONVERSATION' || isRestaurantQuery(userQuery);
    diag.restaurantKnowledgeUsed = isRestaurant;

    let contextAssembledPrompt = '';
    let retrievedChunksCount = 0;
    let similarityScore = 0;
    let recommendationItems: any[] = [];
    let liveMenuForGuard: any[] | undefined;

    // ── Step 3: Task-Specific Execution Pipeline ──
    if (intent === 'GENERAL_CONVERSATION' && !isRestaurantQuery(userQuery)) {
      // Pure general knowledge — no retrieval needed
      contextAssembledPrompt = `=== GENERAL ASSISTANCE MODE ===\nThe user is asking a general question (programming, math, science, history, education, etc.).\nAnswer warmly and accurately using your general knowledge.`;
      diag.restaurantKnowledgeUsed = false;

    } else if (intent === 'PRODUCT_RECOMMENDATION') {
      // Product Recommendation: Engine picks products, LLM explains them
      if (isClientConnected) {
        sendSSE(res, {
          type: 'thinking',
          data: { stage: 'recommendation', label: 'Consulting Olive Pizza taste engine…' },
        });
      }
      const recResult = await generateRecommendations({
        cartItems: websiteContext.cartItems as any,
        isVeg: websiteContext.preferences?.vegetarianOnly,
        query: userQuery,
      });
      recommendationItems = recResult.recommendations || [];
      liveMenuForGuard = recommendationItems;
      const recSummary = (recResult.recommendations || [])
        .map((r: any) => `- [ID: ${r.id}] ${r.name || r.item?.name} (₹${r.price || r.item?.price}): ${r.reason}`)
        .join('\n');
      const pairingSummary = (recResult.pairingSuggestions || [])
        .map((p: any) => `- [ID: ${p.id}] ${p.name || p.item?.name}: ${p.reason}`)
        .join('\n');

      contextAssembledPrompt = `=== LIVE RECOMMENDATION ENGINE PICKS ===\nThese products were selected from the live Olive Pizza database by the Recommendation Engine:\n${recSummary || 'No specific recommendations available.'}\n\n${pairingSummary ? `Pairing suggestions:\n${pairingSummary}` : ''}\n\nCRITICAL: Explain ONLY these listed products. DO NOT invent any other items.`;
      diag.restaurantKnowledgeUsed = true;

    } else {
      // Restaurant Knowledge / Tool Calling / Long Context — Mandatory Hybrid Retrieval
      if (isClientConnected) {
        sendSSE(res, {
          type: 'thinking',
          data: { stage: 'embedding', label: 'Generating semantic embedding…' },
        });
      }

      // Generate embedding
      const embedStart = Date.now();
      let embeddingVector: number[] | undefined;
      try {
        const embeddingResult = await generateEmbedding(userQuery);
        embeddingVector = embeddingResult.vector;
        diag.embeddingGenerated = true;
        recordEvent({
          sessionId,
          timestamp: Date.now(),
          stage: 'embedding',
          provider: embeddingResult.provider,
          latencyMs: Date.now() - embedStart,
          success: true,
          metadata: { dimensions: embeddingResult.dimensions },
        });
      } catch (embedErr) {
        console.warn('⚠️ Embedding generation failed, using text-only retrieval:', (embedErr as Error).message);
        diag.embeddingGenerated = false;
      }

      if (isClientConnected) {
        sendSSE(res, {
          type: 'thinking',
          data: { stage: 'retrieval', label: 'Searching live Olive Pizza knowledge base…' },
        });
      }

      const retrievalStart = Date.now();
      const context = await hybridRetrieve(userQuery, embeddingVector);
      contextAssembledPrompt = context.assembledPrompt;
      retrievedChunksCount = context.chunks.length;
      similarityScore = context.chunks[0]?.score || 0;

      // Update diagnostics from retrieval result
      diag.pineconeQueried = context.pineconeQueried;
      diag.vectorsRetrieved = context.chunks.length;
      diag.topSimilarityScore = similarityScore;
      diag.retrievedDocumentIds = context.documentIds || [];
      diag.firestoreQueried = context.firestoreQueried;
      diag.restaurantKnowledgeUsed = true;

      const retrievalLatency = Date.now() - retrievalStart;
      diag.pineconeLatencyMs = retrievalLatency;

      recordEvent({
        sessionId,
        timestamp: Date.now(),
        stage: 'retrieval',
        provider: 'pinecone+firestore',
        latencyMs: retrievalLatency,
        success: true,
        metadata: {
          chunksRetrieved: context.chunks.length,
          firestoreFactsCount: context.firestoreFacts.length,
          topScore: similarityScore,
          pineconeQueried: context.pineconeQueried,
          firestoreQueried: context.firestoreQueried,
          documentIds: context.documentIds,
        },
      });

      // ── HARD KNOWLEDGE LOCK: If no data retrieved and restaurant query, block LLM ──
      if (
        retrievedChunksCount === 0 &&
        context.firestoreFacts.length === 0 &&
        !contextAssembledPrompt.includes('LIVE OLIVE PIZZA VERIFIED MENU')
      ) {
        console.warn(`🛡️ [KnowledgeLock] No restaurant data retrieved for query: "${userQuery.slice(0, 60)}"`);
        const safeResponse = buildKnowledgeUnavailableResponse(userQuery);
        if (isClientConnected) {
          sendSSE(res, { type: 'chunk', data: { token: safeResponse } });
          sendSSE(res, {
            type: 'telemetry',
            data: {
              ...diag,
              model: 'Knowledge Lock (No retrieval)',
              provider: 'guard',
              intent,
              latencyMs: 0,
              tokensUsed: 0,
              isFallback: false,
              catalogGuardStatus: 'UNAVAILABLE',
            },
          });
          sendSSE(res, { type: 'done', data: { requestId, timestamp: Date.now() } });
          res.end();
        }
        return;
      }
    }

    diag.finalContextLengthChars = contextAssembledPrompt.length;

    // ── Step 4: LLM Stream Generation via Model Orchestrator ──
    if (isClientConnected) {
      sendSSE(res, {
        type: 'thinking',
        data: { stage: 'generating', label: 'Baking your artisan response…' },
      });
    }
    const systemPrompt = buildSystemPrompt(contextAssembledPrompt, websiteContext as Record<string, unknown>);
    let fullResponse = '';
    let selectedRouteMeta: RouteExecutionMetadata | undefined;
    const llmStart = Date.now();

    const llmStream = routeToLLM(
      systemPrompt,
      messages,
      websiteContext as any,
      false,
      (routeMeta) => {
        selectedRouteMeta = routeMeta;
      },
    );

    for await (const token of llmStream) {
      if (!isClientConnected) break;
      fullResponse += token;
      sendSSE(res, { type: 'chunk', data: { token } });
    }

    if (!isClientConnected) return;

    const llmLatency = Date.now() - llmStart;

    // ── Step 5: Post-Processing — Action Extraction ──
    const { cleanText, actions } = extractActions(fullResponse);
    const { cleanText: llmText, productIds: llmProductIds } = extractProductCards(cleanText);
    const validation = validateResponse(
      llmText,
      retrievedChunksCount > 0 || intent === 'GENERAL_CONVERSATION',
    );

    if (!validation.valid) {
      console.warn('⚠️ Response validator triggered:', validation.warning);
    }

    // ── Step 6: CatalogGuard — Cross-check response against live catalog ──
    const guardStart = Date.now();
    const liveMenu = liveMenuForGuard || await fetchLiveMenu();
    const guardResult = await runCatalogGuard(llmText, diag.restaurantKnowledgeUsed, liveMenu);
    const guardLatency = Date.now() - guardStart;

    diag.catalogGuardStatus = guardResult.status;
    diag.flaggedHallucinatedItems = guardResult.flaggedItems;

    // Merge product IDs: LLM-mentioned + CatalogGuard verified
    const allProductIds = [...new Set([...llmProductIds, ...guardResult.verifiedProductIds])];

    // The final verified text
    const finalText = guardResult.sanitizedText;

    recordEvent({
      sessionId,
      timestamp: Date.now(),
      stage: 'catalogguard',
      provider: 'catalogguard',
      latencyMs: guardLatency,
      success: guardResult.status !== 'FLAGGED_HALLUCINATION',
      metadata: {
        status: guardResult.status,
        flaggedItems: guardResult.flaggedItems,
        verifiedProductIds: guardResult.verifiedProductIds,
      },
    });

    // ── Step 7: Execute & emit verified actions ──
    for (const action of actions) {
      if (!isClientConnected) break;
      const executed = await executeToolAction(action, userAuthToken);
      sendSSE(res, { 
        type: 'action', 
        data: {
          ...action,
          executionSuccess: executed.success,
          resultData: executed.resultData,
          message: executed.message
        } 
      });
    }

    // ── Step 8: Emit real product cards (verified IDs only) ──
    for (const pid of allProductIds) {
      if (!isClientConnected) break;
      sendSSE(res, {
        type: 'product_card',
        data: {
          productId: pid,
          product: liveMenu.find((m: any) => m.id === pid),
        },
      });
    }

    // If recommendation engine returned items and no product cards were emitted, emit top 3
    if (recommendationItems.length > 0 && allProductIds.length === 0) {
      for (const rec of recommendationItems.slice(0, 3)) {
        if (!isClientConnected) break;
        const pid = rec.id || rec.item?.id || rec.productId;
        if (pid) {
          sendSSE(res, {
            type: 'product_card',
            data: {
              productId: pid,
              product: liveMenu.find((m: any) => m.id === pid) || rec,
            },
          });
        }
      }
    }

    // ── Step 9: Record full telemetry ──
    recordEvent({
      sessionId,
      timestamp: Date.now(),
      stage: 'llm',
      provider: selectedRouteMeta?.provider || 'nvidia',
      latencyMs: llmLatency,
      success: true,
      metadata: {
        intent,
        selectedModel: selectedRouteMeta?.selectedModel || 'DeepSeek V4 Flash',
        tokensUsed: selectedRouteMeta?.tokensUsed || Math.ceil(fullResponse.length / 4),
        isFallback: selectedRouteMeta?.isFallback || false,
        retrievedChunks: retrievedChunksCount,
        similarityScore,
        contextSizeChars: systemPrompt.length,
        costUSD: selectedRouteMeta?.costUSD || 0,
        restaurantKnowledgeUsed: diag.restaurantKnowledgeUsed,
        catalogGuardStatus: guardResult.status,
        flaggedItems: guardResult.flaggedItems,
        pineconeQueried: diag.pineconeQueried,
        firestoreQueried: diag.firestoreQueried,
        documentIds: diag.retrievedDocumentIds,
        pineconeLatencyMs: diag.pineconeLatencyMs,
        embeddingGenerated: diag.embeddingGenerated,
      },
    });

    if (isClientConnected && !res.writableEnded) {
      sendSSE(res, {
        type: 'telemetry',
        data: {
          model: selectedRouteMeta?.selectedModel || 'DeepSeek V4 Flash (NVIDIA)',
          provider: selectedRouteMeta?.provider || 'nvidia',
          intent,
          latencyMs: llmLatency,
          tokensUsed: selectedRouteMeta?.tokensUsed || Math.ceil(fullResponse.length / 4),
          isFallback: selectedRouteMeta?.isFallback || false,
          similarityScore,
          // Extended diagnostics
          intentClassified: diag.intent,
          embeddingGenerated: diag.embeddingGenerated,
          pineconeQueried: diag.pineconeQueried,
          pineconeLatencyMs: diag.pineconeLatencyMs,
          vectorsRetrieved: diag.vectorsRetrieved,
          topSimilarityScore: diag.topSimilarityScore,
          retrievedDocumentIds: diag.retrievedDocumentIds,
          firestoreQueried: diag.firestoreQueried,
          finalContextLengthChars: diag.finalContextLengthChars,
          restaurantKnowledgeUsed: diag.restaurantKnowledgeUsed,
          catalogGuardStatus: diag.catalogGuardStatus,
          flaggedHallucinatedItems: diag.flaggedHallucinatedItems,
        },
      });

      sendSSE(res, { type: 'done', data: { requestId, timestamp: Date.now() } });
      res.end();
    }
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`❌ [${requestId}] Stream error:`, errorMsg);
    recordEvent({
      sessionId,
      timestamp: Date.now(),
      stage: 'llm',
      provider: 'orchestrator',
      latencyMs: 0,
      success: false,
      error: errorMsg,
    });
    if (isClientConnected && !res.writableEnded) {
      sendSSE(res, { type: 'error', data: { message: 'Our artisan ovens encountered a brief issue. Please retry!' } });
      res.end();
    }
  }
}

// ── 2. Live Context Synchronization (POST /api/ai/context) ────────────────────
export async function handleContextSync(req: Request, res: Response): Promise<void> {
  const { sessionId, websiteContext } = req.body;
  if (!sessionId || !websiteContext) {
    res.status(400).json({ error: 'Missing sessionId or websiteContext' });
    return;
  }
  await cache.set(`ctx:${sessionId}`, websiteContext, 3600);
  res.json({ status: 'synchronized', sessionId, timestamp: new Date().toISOString() });
}

// ── 3. Live Menu Resolver (GET /api/ai/menu) ──────────────────────────────────
export async function handleGetMenu(req: Request, res: Response): Promise<void> {
  const category = req.query.category as string | undefined;
  const vegOnly = req.query.veg === 'true';
  const query = req.query.q as string | undefined;

  let items = await fetchLiveMenu();
  if (category) items = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
  if (vegOnly) items = items.filter((i) => i.isVeg);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }

  res.json({ items, total: items.length, timestamp: new Date().toISOString() });
}

// ── 4. Tool Execution Direct Gateway (POST /api/ai/action) ────────────────────
export async function handleDirectAction(req: Request, res: Response): Promise<void> {
  const { action } = req.body;
  const userAuthToken = req.headers.authorization;
  if (!action || !action.type) {
    res.status(400).json({ error: 'Missing action object or action.type' });
    return;
  }
  const result = await executeToolAction(action, userAuthToken);
  res.json({
    ...result,
    action: {
      type: result.actionType || action.type,
      payload: result.payload,
      description: action.description || result.message,
    },
  });
}

// ── 5. Multi-Surface Recommendations ─────────────────────────────────────────
export async function handleGetRecommendations(req: Request, res: Response): Promise<void> {
  const { isVeg, cartItems = [], weather, timeOfDay, userHistory = [] } = req.body;
  const recs = await generateRecommendations({ isVeg, cartItems, weather, timeOfDay, userHistory });
  res.json(recs);
}

export async function handleHomepageRecommendations(req: Request, res: Response): Promise<void> {
  const { weather, timeOfDay, isVeg, userId } = req.body;
  const result = await generateHomepageRecommendations({ weather, timeOfDay, isVeg, userId });
  res.json(result);
}

export async function handleDashboardRecommendations(req: Request, res: Response): Promise<void> {
  const { userId, userRole, isVeg } = req.body;
  const result = await generateDashboardRecommendations({ userId, userRole, isVeg });
  res.json(result);
}

// ── 6. Event-Driven Webhook Receiver (POST /api/ai/events) ────────────────────
export async function handleEventWebhook(req: Request, res: Response): Promise<void> {
  const { eventType, userId, sessionId, data = {}, timestamp = Date.now() } = req.body;
  if (!eventType) {
    res.status(400).json({ error: 'Missing eventType in webhook payload' });
    return;
  }

  console.log(`📡 [Webhook Event Received] ${eventType} for User: ${userId || 'guest'} (Session: ${sessionId || 'none'})`);

  if (eventType === 'MENU_UPDATED' || eventType === 'PRODUCT_UPDATED') {
    invalidateMenuCache();
    await cache.flush();
  }

  res.json({
    status: 'acknowledged',
    eventType,
    timestamp: new Date().toISOString(),
    message: `Event ${eventType} synchronized with AI runtime`,
  });
}

// ── 7. Multi-LLM Model Registry Status (GET /api/ai/models/status) ────────────
export async function handleGetModelStatus(_req: Request, res: Response): Promise<void> {
  const models = getModelRegistryStatus();
  res.json({
    primaryProvider: 'nvidia',
    secondaryProvider: 'openrouter',
    models,
    timestamp: new Date().toISOString(),
  });
}

// ── 8. Speech Recognition (STT) Gateway (POST /api/ai/speech/stt) ─────────────
export async function handleSpeechSTT(req: Request, res: Response): Promise<void> {
  const { audioBase64, contentType = 'audio/wav' } = req.body;
  if (!audioBase64) {
    res.status(400).json({ error: 'Missing audioBase64 string in request body' });
    return;
  }
  const result = await transcribeAudio(audioBase64, contentType);
  res.json(result);
}

// ── 9. Speech Synthesis (TTS) Gateway (POST /api/ai/speech/tts) ───────────────
export async function handleSpeechTTS(req: Request, res: Response): Promise<void> {
  const { text, voice = 'alloy', language = 'en', speed = 1.0 } = req.body;
  if (!text) {
    res.status(400).json({ error: 'Missing text in request body' });
    return;
  }
  const result = await synthesizeSpeech(text, { voice, language, speed });
  res.json(result);
}

// ── 10. Instant Knowledge Ingest (POST /api/ai/knowledge/ingest) ──────────────
export async function handleInstantKnowledgeIngest(req: Request, res: Response): Promise<void> {
  const { category = 'general', title, content, metadata = {} } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'Missing title or content for knowledge ingestion' });
    return;
  }
  const result = await ingestKnowledgeItem(
    `manual_${Date.now()}`,
    category,
    title,
    content,
    'manual',
    'en',
    'manual',
    [],
    1
  );
  res.json({
    success: true,
    knowledgeId: result.id,
    dimensions: result.dimensions,
    message: 'Instant embedding and ingestion complete. Ready immediately without restart.',
  });
}

// ── 11. Live Knowledge Synchronization Webhook ────────────────────────────────
export async function handleKnowledgeSync(req: Request, res: Response): Promise<void> {
  const { category } = req.body;
  await cache.flush();
  invalidateMenuCache();
  res.json({
    status: 'synced',
    category: category || 'all',
    timestamp: new Date().toISOString(),
    message: 'Cache invalidated and live knowledge synchronized',
  });
}

// ── 12. Connection Health & Heartbeat ─────────────────────────────────────────
export async function handleHealthCheck(_req: Request, res: Response): Promise<void> {
  const health = await checkSystemHealth(true);
  res.json({
    status: health.overallStatus || 'healthy',
    ...health,
  });
}

// ── 13. Telemetry & Developer Dashboard ───────────────────────────────────────
export async function handleGetAlerts(_req: Request, res: Response): Promise<void> {
  res.json({ alerts: getAlertHistory() });
}

export async function handleTestAlert(req: Request, res: Response): Promise<void> {
  const { errorName = 'TestDiagnosticTrigger', message = 'Manual alert test triggered by developer dashboard' } = req.body;
  const alert = await sendProductionErrorAlert({
    requestId: `test_${Math.random().toString(36).substring(2, 9)}`,
    endpoint: '/api/ai/test-alert',
    error: new Error(`${errorName}: ${message}`),
    action: 'TEST_ALERT_DISPATCH',
    suggestedRootCause: 'Simulated alert for reliability testing & developer dashboard validation.',
  });
  res.json({ success: true, alert });
}

export async function handleGetMetrics(req: Request, res: Response): Promise<void> {
  const sessionId = Array.isArray(req.params.sessionId)
    ? req.params.sessionId[0]
    : req.params.sessionId || '';
  res.json(getMetrics(sessionId));
}

export async function handleGetFullDashboard(_req: Request, res: Response): Promise<void> {
  res.json(getFullTelemetryDashboard());
}

// ── 14. SDUI Designer (Google Stitch Pipeline) ─────────────────────────────
import { sduiService } from '../services/sdui/sduiService';
import { imageService } from '../services/image/imageService';
import { promptEnhancerService } from '../services/ai/promptEnhancerService';
import { mainBackendClient } from '../services/integration/mainBackendClient';
import { knowledgeSyncService } from '../services/ai/knowledgeSyncService';

export async function handleGenerateSDUI(req: Request, res: Response): Promise<void> {
  const { prompt = 'Featured Woodfired Pizza Menu', targetPage = 'homepage' } = req.body;
  const sduiPreview = await sduiService.generateSDUIPreview(prompt, targetPage);
  res.json(sduiPreview);
}

export async function handlePublishSDUI(req: Request, res: Response): Promise<void> {
  const { previewId, sduiSchema } = req.body;
  const userAuthToken = req.headers.authorization || '';
  if (!previewId || !sduiSchema) {
    res.status(400).json({ error: 'Missing previewId or sduiSchema' });
    return;
  }
  const result = await sduiService.publishSDUI(userAuthToken, previewId, sduiSchema);
  res.json(result);
}

// ── 15. Image Generation Gateway (Preview -> Owner Approval -> Cloudinary) ──
export async function handleGenerateImage(req: Request, res: Response): Promise<void> {
  const { prompt = 'Artisan woodfired truffle sourdough pizza', model = 'flux-1-dev' } = req.body;
  const imagePreview = await imageService.generateImagePreview(prompt, model);
  res.json(imagePreview);
}

export async function handleApproveImage(req: Request, res: Response): Promise<void> {
  const { imageId, previewUrl, bannerMetadata } = req.body;
  const userAuthToken = req.headers.authorization || '';
  if (!imageId || !previewUrl) {
    res.status(400).json({ error: 'Missing imageId or previewUrl' });
    return;
  }
  const result = await imageService.approveAndUploadImage(userAuthToken, imageId, previewUrl, bannerMetadata);
  res.json(result);
}

// ── 16. Prompt Enhancer & Image Prompt Enhancer ─────────────────────────────
export async function handleEnhancePrompt(req: Request, res: Response): Promise<void> {
  const { prompt, persona = 'customer' } = req.body;
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }
  const result = promptEnhancerService.enhanceTextPrompt(prompt, persona);
  res.json(result);
}

export async function handleEnhanceImagePrompt(req: Request, res: Response): Promise<void> {
  const { prompt } = req.body;
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }
  const result = promptEnhancerService.enhanceImagePrompt(prompt);
  res.json(result);
}

// ── 17. Specialized AI Capabilities (Email AI, Analytics Explanation) ───────
export async function handleGenerateEmail(req: Request, res: Response): Promise<void> {
  const { campaignTitle = 'Artisan Pizza Festival', targetAudience = 'VIP Customers' } = req.body;
  const result = promptEnhancerService.generatePromotionalEmail(campaignTitle, targetAudience);
  res.json(result);
}

export async function handleExplainAnalytics(req: Request, res: Response): Promise<void> {
  const { metrics = {} } = req.body;
  const result = promptEnhancerService.explainAnalytics(metrics);
  res.json(result);
}

// ── 18. Dynamic Tool Registry Endpoint ──────────────────────────────────────
export async function handleGetToolRegistry(_req: Request, res: Response): Promise<void> {
  const tools = await mainBackendClient.fetchToolRegistry();
  res.json({ tools, timestamp: new Date().toISOString() });
}

// ── 19. Cloudflare R2 Knowledge Download Trigger ─────────────────────────────
export async function handleDownloadR2Knowledge(_req: Request, res: Response): Promise<void> {
  const result = await knowledgeSyncService.checkAndDownloadR2Knowledge();
  res.json({
    success: true,
    message: 'Checked Cloudflare R2 version.json and synchronized changed JSON files.',
    ...result,
  });
}

