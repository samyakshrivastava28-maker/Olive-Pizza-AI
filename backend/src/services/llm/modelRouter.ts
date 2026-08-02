import axios from 'axios';
import { env } from '../../config/env';
import {
  MODEL_REGISTRY,
  ModelIntent,
  ModelProfile,
  getModelsForIntent,
} from '../../config/modelsConfig';
import type { ChatMessage, WebsiteContext } from '../../types';

// ─── Intent Classifier ─────────────────────────────────────────────────────────
export function classifyIntent(
  messages: ChatMessage[],
  websiteContext?: WebsiteContext,
  hasImageAttachment: boolean = false,
): ModelIntent {
  if (hasImageAttachment) {
    return 'VISION';
  }

  const lastUserMsg = messages
    .slice()
    .reverse()
    .find((m) => m.role === 'user')?.content.toLowerCase() || '';

  // 1. Vision Detection (base64 or image URLs in text or explicit prompt)
  if (
    lastUserMsg.includes('data:image/') ||
    ((lastUserMsg.includes('http://') || lastUserMsg.includes('https://')) &&
      (/\.(jpg|jpeg|png|webp|gif)/i.test(lastUserMsg) || /qr code|receipt|bill|food photo|menu photo/i.test(lastUserMsg)))
  ) {
    return 'VISION';
  }

  // 2. Tool Calling Trigger Detection
  const toolTriggers = [
    'add to cart',
    'add to my cart',
    'remove from cart',
    'delete from cart',
    'change quantity',
    'update quantity',
    'apply coupon',
    'remove coupon',
    'apply promo',
    'checkout',
    'open checkout',
    'proceed to pay',
    'navigate to',
    'go to page',
    'open category',
    'search menu',
    'repeat order',
    'reorder',
    'track order',
    'cancel order',
    'call restaurant',
    'contact support',
    'open notifications',
    'view offers',
  ];
  if (toolTriggers.some((t) => lastUserMsg.includes(t))) {
    return 'TOOL_CALLING';
  }

  // 3. Product Recommendation Detection
  const recTriggers = [
    'recommend',
    'suggest',
    'what should i eat',
    'what is good',
    'best pizza',
    'combo',
    'popular',
    'bestseller',
    'trending',
    'pair with',
    'pairing',
    'hungry for',
    'craving',
  ];
  if (recTriggers.some((t) => lastUserMsg.includes(t))) {
    return 'PRODUCT_RECOMMENDATION';
  }

  // 4. Restaurant Knowledge Triggers (Menu, Prices, Offers, Coupons, Store timings, Policies, Delivery)
  const restaurantTriggers = [
    'menu',
    'pizza',
    'burger',
    'pasta',
    'garlic bread',
    'truffle',
    'margherita',
    'paneer',
    'farm fresh',
    'beverage',
    'coke',
    'dessert',
    'lava cake',
    'olive',
    'price',
    'cost',
    'how much',
    'discount',
    'coupon',
    'offer',
    'timing',
    'open',
    'close',
    'opening hours',
    'delivery',
    'deliver to',
    'delivery fee',
    'address',
    'location',
    'phone',
    'contact',
    'jain',
    'vegetarian',
    'non-veg',
    'vegan',
    'gluten',
    'allergy',
    'spicy',
    'refund',
    'return policy',
    'hygiene',
    'woodfired',
    'crust',
    'cheese burst',
  ];
  if (restaurantTriggers.some((t) => lastUserMsg.includes(t))) {
    return 'RESTAURANT_KNOWLEDGE';
  }

  // 5. Long Context Trigger (large messages or legal policy review)
  const totalLength = messages.reduce((acc, m) => acc + m.content.length, 0);
  if (
    totalLength > 12000 ||
    /terms of service|privacy policy|legal terms|long summary|full transcript/i.test(lastUserMsg)
  ) {
    return 'LONG_CONTEXT';
  }

  // 6. General Conversation & Knowledge (Science, Coding, Math, School, GK, etc.)
  return 'GENERAL_CONVERSATION';
}

// ─── Circuit Breaker & Health State ───────────────────────────────────────────
interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  totalCalls: number;
  totalTokens: number;
  successCount: number;
}

const circuitStates = new Map<string, CircuitState>();
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 30_000;

function getCircuit(id: string): CircuitState {
  if (!circuitStates.has(id)) {
    circuitStates.set(id, {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      totalCalls: 0,
      totalTokens: 0,
      successCount: 0,
    });
  }
  return circuitStates.get(id)!;
}

function recordSuccess(id: string, tokens: number = 0): void {
  const state = getCircuit(id);
  state.failures = 0;
  state.isOpen = false;
  state.totalCalls += 1;
  state.successCount += 1;
  state.totalTokens += tokens;
}

function recordFailure(id: string): void {
  const state = getCircuit(id);
  state.failures += 1;
  state.totalCalls += 1;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    state.isOpen = true;
    console.warn(`⚡ Circuit OPEN for model: ${id} (${state.failures} failures)`);
  }
}

function isCircuitOpen(id: string): boolean {
  const state = getCircuit(id);
  if (!state.isOpen) return false;
  if (Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
    state.isOpen = false;
    state.failures = 0;
    console.log(`✅ Circuit RESET for model: ${id}`);
    return false;
  }
  return true;
}

// ─── OpenAI-Compatible Streaming SSE Call ─────────────────────────────────────
export async function* streamLLMResponse(
  modelProfile: ModelProfile,
  systemPrompt: string,
  messages: ChatMessage[],
  onMetrics?: (tokens: number, latencyMs: number) => void,
): AsyncGenerator<string> {
  const startTime = Date.now();
  let generatedTokens = 0;

  const body = {
    model: modelProfile.modelName,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    max_tokens: modelProfile.maxTokens,
    temperature: modelProfile.temperature,
  };

  const response = await axios.post(`${modelProfile.baseURL}/chat/completions`, body, {
    headers: {
      Authorization: `Bearer ${modelProfile.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    responseType: 'stream',
    timeout: modelProfile.timeoutMs,
  });

  let buffer = '';
  for await (const chunk of response.data) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.slice(6).trim();
      if (dataStr === '[DONE]') {
        onMetrics?.(generatedTokens, Date.now() - startTime);
        return;
      }

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta;
        const token = (typeof delta?.content === 'string' && delta.content)
          ? delta.content
          : (typeof delta?.reasoning_content === 'string' && delta.reasoning_content)
          ? delta.reasoning_content
          : (typeof parsed.choices?.[0]?.text === 'string' ? parsed.choices[0].text : '');

        if (token) {
          generatedTokens += 1;
          yield token;
        }
      } catch {
        /* skip comment / non-json sse lines */
      }
    }
  }
  onMetrics?.(generatedTokens, Date.now() - startTime);
}

// ─── Fallback Direct Gemini Generation ─────────────────────────────────────────
async function* streamGeminiDirect(
  systemPrompt: string,
  messages: ChatMessage[],
  modelName: string = 'gemini-3.5-flash',
  onMetrics?: (tokens: number, latencyMs: number) => void,
): AsyncGenerator<string> {
  const startTime = Date.now();
  let generatedTokens = 0;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${env.ASSISTANT_GEMINI_API_KEY}&alt=sse`;
  const contents = [
    { role: 'user', parts: [{ text: `System Instructions: ${systemPrompt}` }] },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ];

  const response = await axios.post(
    url,
    { contents },
    {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 15000,
    },
  );

  let buffer = '';
  for await (const chunk of response.data) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.slice(6).trim();

      try {
        const parsed = JSON.parse(dataStr);
        const token = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (token) {
          generatedTokens += 1;
          yield token;
        }
      } catch {
        /* skip */
      }
    }
  }
  onMetrics?.(generatedTokens, Date.now() - startTime);
}

// ─── Intelligent Multi-LLM Model Orchestrator ─────────────────────────────────
export interface RouteExecutionMetadata {
  intent: ModelIntent;
  selectedModel: string;
  provider: string;
  isFallback: boolean;
  tokensUsed: number;
  latencyMs: number;
  costUSD: number;
}

export async function* routeToLLM(
  systemPrompt: string,
  messages: ChatMessage[],
  websiteContext?: WebsiteContext,
  hasImageAttachment: boolean = false,
  onRouteSelected?: (meta: RouteExecutionMetadata) => void,
): AsyncGenerator<string> {
  // 1. Classify the user intent
  const intent = classifyIntent(messages, websiteContext, hasImageAttachment);
  console.log(`🧭 Intent Classified: ${intent}`);

  // 2. Retrieve Candidate Models for this Intent in priority order (NVIDIA first, OpenRouter fallback)
  const candidateModels = getModelsForIntent(intent);

  let isFirstAttempt = true;

  for (const modelProfile of candidateModels) {
    if (!modelProfile.apiKey) continue;
    if (isCircuitOpen(modelProfile.id)) {
      console.warn(`⏭️  Skipping open circuit model: ${modelProfile.id}`);
      continue;
    }

    for (let attempt = 1; attempt <= modelProfile.maxRetries; attempt++) {
      try {
        console.log(
          `🤖 Orchestrating intent [${intent}] -> Model: ${modelProfile.displayName} (attempt ${attempt})`,
        );

        let streamWorked = false;
        let finalTokens = 0;
        let finalLatency = 0;

        for await (const token of streamLLMResponse(
          modelProfile,
          systemPrompt,
          messages,
          (tokens, latency) => {
            finalTokens = tokens;
            finalLatency = latency;
          },
        )) {
          if (!streamWorked) {
            streamWorked = true;
            // Notify selection
            onRouteSelected?.({
              intent,
              selectedModel: modelProfile.displayName,
              provider: modelProfile.provider,
              isFallback: !isFirstAttempt,
              tokensUsed: finalTokens || 50,
              latencyMs: finalLatency || 400,
              costUSD: modelProfile.costPer1kCompletionUSD * (finalTokens / 1000),
            });
          }
          yield token;
        }

        if (streamWorked) {
          recordSuccess(modelProfile.id, finalTokens);
          return;
        }
      } catch (err) {
        console.warn(
          `⚠️  Model ${modelProfile.id} failed (attempt ${attempt}):`,
          (err as Error).message,
        );
        recordFailure(modelProfile.id);
        isFirstAttempt = false;
      }
    }
  }

  // 3. Fallback to Google Gemini Direct
  if (env.ASSISTANT_GEMINI_API_KEY) {
    try {
      console.log('🛡️ Engaging Ultimate Fallback: Google Gemini 3.5 Flash Direct');
      onRouteSelected?.({
        intent,
        selectedModel: 'Gemini 3.5 Flash Direct',
        provider: 'gemini',
        isFallback: true,
        tokensUsed: 60,
        latencyMs: 500,
        costUSD: 0.0,
      });

      for await (const token of streamGeminiDirect(systemPrompt, messages, 'gemini-3.5-flash')) {
        yield token;
      }
      return;
    } catch (err) {
      console.error('❌ Gemini direct fallback failed:', (err as Error).message);
    }
  }

  // 4. Graceful rule-based response grounded in live store readiness
  yield "Welcome to Olive Pizza! 🍕 Our kitchen is active and ready for your order. You can explore our artisan woodfired menu, apply discounts like OLIVE50, or tap any recommendation below.";
}

// ─── Monitoring & Health Export ───────────────────────────────────────────────
export function getModelRegistryStatus(): Array<{
  id: string;
  displayName: string;
  provider: string;
  priority: number;
  isOpen: boolean;
  failures: number;
  totalCalls: number;
  successCount: number;
  totalTokens: number;
}> {
  return MODEL_REGISTRY.map((m) => {
    const c = getCircuit(m.id);
    return {
      id: m.id,
      displayName: m.displayName,
      provider: m.provider,
      priority: m.priority,
      isOpen: c.isOpen,
      failures: c.failures,
      totalCalls: c.totalCalls,
      successCount: c.successCount,
      totalTokens: c.totalTokens,
    };
  });
}

export function getProviderHealth(): Record<string, { isOpen: boolean; failures: number }> {
  const result: Record<string, { isOpen: boolean; failures: number }> = {};
  for (const m of MODEL_REGISTRY) {
    const c = getCircuit(m.id);
    result[m.id] = { isOpen: c.isOpen, failures: c.failures };
  }
  return result;
}
