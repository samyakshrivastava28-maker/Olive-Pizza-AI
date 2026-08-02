import axios from 'axios';
import { env } from '../../config/env';
import { cache } from '../../config/cache';
import type { EmbeddingResult, EmbeddingProvider } from '../../types';

// ─── NVIDIA NIM Embedding Provider (Primary) ───────────────────────────────────
async function getNvidiaEmbedding(
  text: string,
  model:
    | 'baai/bge-m3'
    | 'nvidia/nv-embed-v1'
    | 'nvidia/nemotron-embed-1b'
    | 'nvidia/llama-nemotron-embed-vl-1b',
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
  return response.data.data[0].embedding as number[];
}

// ─── Gemini Embedding Fallback ─────────────────────────────────────────────────
async function getGeminiEmbedding(text: string): Promise<number[]> {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${env.ASSISTANT_GEMINI_API_KEY}`,
    { model: 'models/text-embedding-004', content: { parts: [{ text }] } },
    { timeout: 8000 },
  );
  return response.data.embedding.values as number[];
}

// ─── Main Embedding Pipeline Orchestrator ─────────────────────────────────────
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const cacheKey = `embed:${Buffer.from(text).toString('base64').slice(0, 64)}`;
  const cached = await cache.get<EmbeddingResult>(cacheKey);
  if (cached) return cached;

  const providers: Array<{
    id: EmbeddingProvider;
    fn: () => Promise<number[]>;
  }> = [
    {
      id: 'bge-m3',
      fn: () =>
        getNvidiaEmbedding(
          text,
          'baai/bge-m3',
          env.ASSISTANT_NVIDIA_API_KEY,
        ),
    },
    {
      id: 'nv-embed-v1',
      fn: () =>
        getNvidiaEmbedding(
          text,
          'nvidia/nv-embed-v1',
          env.ASSISTANT_NVIDIA_API_KEY,
        ),
    },
    {
      id: 'nemotron-embed-1b',
      fn: () =>
        getNvidiaEmbedding(
          text,
          'nvidia/nemotron-embed-1b',
          env.ASSISTANT_NVIDIA_API_KEY,
        ),
    },
    {
      id: 'llama-nemotron-embed-vl-1b',
      fn: () =>
        getNvidiaEmbedding(
          text,
          'nvidia/llama-nemotron-embed-vl-1b',
          env.ASSISTANT_NVIDIA_API_KEY,
        ),
    },
    {
      id: 'gemini-embedding',
      fn: () => getGeminiEmbedding(text),
    },
  ];

  for (const provider of providers) {
    try {
      const start = Date.now();
      const vector = await provider.fn();
      const result: EmbeddingResult = {
        vector,
        provider: provider.id,
        latencyMs: Date.now() - start,
        dimensions: vector.length,
      };
      // Cache for 10 minutes
      await cache.set(cacheKey, result, 600);
      console.log(`✅ Embedding generated via ${provider.id} (${result.dimensions}d, ${result.latencyMs}ms)`);
      return result;
    } catch (err) {
      console.warn(`⚠️  Embedding provider ${provider.id} failed:`, (err as Error).message);
    }
  }

  throw new Error('All embedding providers failed');
}

import crypto from 'crypto';
import { getPineconeIndex } from '../../config/pinecone';

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
    text: content // Legacy fallback
  };

  // Upsert to Pinecone directly
  try {
    const index = getPineconeIndex();
    await index.upsert([{
      id: documentId,
      values: embedResult.vector,
      metadata
    }] as any);
  } catch (error: any) {
    console.error('⚠️ Failed to upsert vector to Pinecone:', error.message);
    throw new Error('Pinecone Upsert Failed: ' + error.message);
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
