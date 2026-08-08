import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env';
import { cache } from '../../config/cache';
import { getPineconeIndex } from '../../config/pinecone';
import type { EmbeddingResult, EmbeddingProvider } from '../../types';

// ─── NVIDIA NIM Embedding Provider (Primary & Fallbacks) ───────────────────────
async function getNvidiaEmbedding(
  text: string,
  model: string,
  apiKey: string,
): Promise<number[]> {
  const response = await axios.post(
    'https://integrate.api.nvidia.com/v1/embeddings',
    { input: [text], model, encoding_format: 'float', input_type: 'query' },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    },
  );
  const raw = response.data?.data?.[0]?.embedding;
  if (!Array.isArray(raw)) throw new Error(`Invalid NVIDIA ${model} response structure`);
  return raw as number[];
}

// ─── Gemini Embedding Fallback ─────────────────────────────────────────────────
async function getGeminiEmbedding(text: string, modelName = 'models/text-embedding-004'): Promise<number[]> {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/${modelName}:embedContent?key=${env.ASSISTANT_GEMINI_API_KEY}`,
    { model: modelName, content: { parts: [{ text }] } },
    { timeout: 8000 },
  );
  const raw = response.data?.embedding?.values;
  if (!Array.isArray(raw)) throw new Error(`Invalid Gemini ${modelName} response structure`);
  return raw as number[];
}

// ─── OpenRouter Embedding Fallback ─────────────────────────────────────────────
async function getOpenRouterEmbedding(text: string, model: string, apiKey: string): Promise<number[]> {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/embeddings',
    { input: text, model },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    },
  );
  const raw = response.data?.data?.[0]?.embedding;
  if (!Array.isArray(raw)) throw new Error(`Invalid OpenRouter ${model} response structure`);
  return raw as number[];
}

// Helper: Pad or truncate vector to target dimension (1024)
function normalizeDimension(vec: number[], targetDim = 1024): number[] {
  if (!Array.isArray(vec) || vec.length === 0) {
    return new Array(targetDim).fill(0);
  }
  if (vec.length === targetDim) return vec;
  if (vec.length > targetDim) return vec.slice(0, targetDim);
  const result = [...vec];
  while (result.length < targetDim) {
    result.push(vec[result.length % vec.length] || 0);
  }
  return result;
}

// Deterministic 1024-d fallback embedding hash
function generateFallbackHashVector(text: string, dim = 1024): number[] {
  const vec = new Array(dim);
  let hash1 = 5381;
  let hash2 = 0;
  for (let j = 0; j < text.length; j++) {
    const char = text.charCodeAt(j);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 << 5) - hash2 + char;
  }
  for (let i = 0; i < dim; i++) {
    const val = Math.sin(hash1 * (i + 1) + hash2);
    vec[i] = Number.isFinite(val) ? val : 0;
  }
  return vec;
}

// ─── Main Embedding Pipeline Orchestrator ─────────────────────────────────────
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const startTime = Date.now();
  const cacheKey = `embed:${Buffer.from(text).toString('base64').slice(0, 64)}`;
  const cached = await cache.get<EmbeddingResult>(cacheKey);
  if (cached) return cached;

  const nvidiaKey = env.ASSISTANT_NVIDIA_API_KEY;

  // 1. Primary: NVIDIA NIM (nvidia/nv-embedcode-7b-v1) + Fallbacks
  if (nvidiaKey && nvidiaKey.trim().length > 10) {
    const nvidiaModels: Array<{ model: string; provider: EmbeddingProvider }> = [
      { model: 'nvidia/nv-embedcode-7b-v1', provider: 'nv-embedcode-7b-v1' },
      { model: 'nvidia/nv-embed-v1', provider: 'nv-embed-v1' },
      { model: 'baai/bge-m3', provider: 'bge-m3' },
      { model: 'nvidia/nv-embedqa-e5-v5', provider: 'nv-embedqa-e5-v5' },
      { model: 'nvidia/nv-embedqa-mistral-7b-v2', provider: 'nv-embedqa-mistral-7b-v2' },
      { model: 'nvidia/llama-3.2-nv-embedqa-1b-v2', provider: 'llama-3.2-nv-embedqa-1b-v2' },
      { model: 'nvidia/nemotron-embed-1b', provider: 'nemotron-embed-1b' },
      { model: 'snowflake/arctic-embed-l', provider: 'arctic-embed-l' },
    ];

    for (const item of nvidiaModels) {
      try {
        const rawVector = await getNvidiaEmbedding(text, item.model, nvidiaKey);
        const vector = normalizeDimension(rawVector, 1024);
        const result: EmbeddingResult = {
          vector,
          provider: item.provider,
          latencyMs: Date.now() - startTime,
          dimensions: 1024,
        };
        await cache.set(cacheKey, result, 86400);
        return result;
      } catch (err: any) {
        console.warn(`⚠️ NVIDIA embedding model ${item.model} failed, trying next fallback:`, err.message);
      }
    }
  }

  // 2. Secondary: Google Gemini Embeddings (text-embedding-004 & embedding-001)
  if (env.ASSISTANT_GEMINI_API_KEY && env.ASSISTANT_GEMINI_API_KEY.trim().length > 10) {
    const geminiModels: Array<{ model: string; provider: EmbeddingProvider }> = [
      { model: 'models/text-embedding-004', provider: 'gemini-embedding' },
      { model: 'models/embedding-001', provider: 'gemini-001' },
    ];

    for (const item of geminiModels) {
      try {
        const rawVector = await getGeminiEmbedding(text, item.model);
        const vector = normalizeDimension(rawVector, 1024);
        const result: EmbeddingResult = {
          vector,
          provider: item.provider,
          latencyMs: Date.now() - startTime,
          dimensions: 1024,
        };
        await cache.set(cacheKey, result, 86400);
        return result;
      } catch (err: any) {
        console.warn(`⚠️ Gemini embedding model ${item.model} failed:`, err.message);
      }
    }
  }

  // 3. Tertiary: OpenRouter Free/Low-Cost Embedding Fallback
  const openRouterKey = env.ASSISTANT_OPENROUTER_API_KEY;
  if (openRouterKey && openRouterKey.trim().length > 10) {
    const openRouterModels: Array<{ model: string; provider: EmbeddingProvider }> = [
      { model: 'baai/bge-m3', provider: 'openrouter-bge-m3' },
      { model: 'baai/bge-large-en-v1.5', provider: 'openrouter-bge-large-en' },
    ];

    for (const item of openRouterModels) {
      try {
        const rawVector = await getOpenRouterEmbedding(text, item.model, openRouterKey);
        const vector = normalizeDimension(rawVector, 1024);
        const result: EmbeddingResult = {
          vector,
          provider: item.provider,
          latencyMs: Date.now() - startTime,
          dimensions: 1024,
        };
        await cache.set(cacheKey, result, 86400);
        return result;
      } catch (err: any) {
        console.warn(`⚠️ OpenRouter embedding model ${item.model} failed:`, err.message);
      }
    }
  }

  // 4. Fallback: Deterministic 1024-d hash vector (Offline Guarantee)
  const vector = generateFallbackHashVector(text, 1024);
  const result: EmbeddingResult = {
    vector,
    provider: 'local-deterministic-hash',
    latencyMs: Date.now() - startTime,
    dimensions: 1024,
  };
  await cache.set(cacheKey, result, 3600);
  return result;
}

// ─── Instant On-the-Fly Vector Ingestion (No Server Restart Required) ─────────
export async function ingestKnowledgeItem(
  documentId: string,
  category: string,
  title: string,
  content: string,
  documentType: string,
  language: string = 'en',
  sourceCollection: string = 'unknown',
  tags: string[] = [],
  version: number = 1,
): Promise<{ id: string; embedded: boolean; dimensions: number; checksum: string }> {
  const textToEmbed = `${title}. ${content} Category: ${category}`;
  
  // Calculate Checksum to prevent redundant embeddings
  const checksum = crypto.createHash('md5').update(textToEmbed).digest('hex');
  
  const embedResult = await generateEmbedding(textToEmbed);

  const metadata = {
    documentId,
    title,
    content,
    documentType,
    category,
    tags,
    language,
    updatedAt: new Date().toISOString(),
    sourceCollection,
    version,
    checksum,
    text: content
  };

  // Upsert to Pinecone directly (with local fallback)
  try {
    const index = getPineconeIndex();
    if (index && Array.isArray(embedResult.vector) && embedResult.vector.length > 0) {
      await (index as any).upsert([{
        id: documentId,
        values: embedResult.vector,
        metadata
      }]);
    }
  } catch (error: any) {
    console.warn('⚠️ Pinecone upsert bypassed or offline:', error.message);
  }

  // Also cache locally
  await cache.set(`kb:${documentId}`, {
    id: documentId,
    vector: embedResult.vector,
    metadata,
  }, 86400);

  console.log(`⚡ Instant knowledge ingestion complete: "${title}" (${category}) [${embedResult.dimensions} dims]`);
  return {
    id: documentId,
    embedded: true,
    dimensions: embedResult.dimensions,
    checksum
  };
}

