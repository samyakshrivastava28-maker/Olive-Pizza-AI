import type { TelemetryEvent, TelemetryMetrics } from '../../types';
import { getModelRegistryStatus, getProviderHealth } from '../llm/modelRouter';

// Session-scoped telemetry store (in-memory)
const sessions = new Map<string, TelemetryEvent[]>();

export function recordEvent(event: TelemetryEvent): void {
  if (!sessions.has(event.sessionId)) {
    sessions.set(event.sessionId, []);
  }
  const events = sessions.get(event.sessionId)!;
  events.push(event);
  // Keep last 200 events per session
  if (events.length > 200) events.shift();
}

export function getMetrics(sessionId: string): TelemetryMetrics {
  const events = sessions.get(sessionId) ?? [];
  const modelStatus = getModelRegistryStatus();

  if (events.length === 0) {
    return {
      activeModel: 'DeepSeek V4 Flash (NVIDIA)',
      activeEmbeddingModel: 'nv-embedcode-7b-v1',
      activeVectorDB: 'pinecone+firestore',
      avgLatencyMs: 0,
      tokenCount: 0,
      estimatedCostUSD: 0,
      retrievedChunks: 0,
      similarityScore: 0,
      contextSizeChars: 0,
      fallbacksTriggered: 0,
      errorsCount: 0,
      events: [],
    };
  }

  const llmEvents = events.filter((e) => e.stage === 'llm');
  const embeddingEvents = events.filter((e) => e.stage === 'embedding');
  const errors = events.filter((e) => !e.success);
  const fallbacks = llmEvents.filter((e) => e.metadata?.isFallback);
  const avgLatency =
    events.reduce((s, e) => s + e.latencyMs, 0) / events.length;

  const lastLLM = llmEvents.at(-1);
  const lastEmbed = embeddingEvents.at(-1);

  return {
    activeModel: (lastLLM?.metadata?.selectedModel as string) || lastLLM?.provider || 'DeepSeek V4 Flash (NVIDIA)',
    activeEmbeddingModel: lastEmbed?.provider || 'nv-embedcode-7b-v1',
    activeVectorDB: 'pinecone+firestore',
    avgLatencyMs: Math.round(avgLatency),
    tokenCount: (lastLLM?.metadata?.tokensUsed as number) || 0,
    estimatedCostUSD: estimateCost(llmEvents),
    retrievedChunks: (lastLLM?.metadata?.retrievedChunks as number) || 0,
    similarityScore: (lastLLM?.metadata?.similarityScore as number) || 0,
    contextSizeChars: (lastLLM?.metadata?.contextSizeChars as number) || 0,
    fallbacksTriggered: fallbacks.length,
    errorsCount: errors.length,
    events: events.slice(-50),
  };
}

function estimateCost(llmEvents: TelemetryEvent[]): number {
  let totalCost = 0;
  for (const event of llmEvents) {
    const provider = event.provider?.toLowerCase() || '';
    const tokens = (event.metadata?.tokensUsed as number) || 0;
    // NVIDIA NIM is free tier ($0)
    if (provider.includes('nvidia')) {
      continue;
    }
    // OpenRouter average $0.0003 per 1K tokens
    if (provider.includes('openrouter')) {
      totalCost += (tokens / 1000) * 0.0003;
    } else {
      totalCost += (tokens / 1000) * 0.00015;
    }
  }
  return parseFloat(totalCost.toFixed(6));
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getAllActiveSessions(): string[] {
  return [...sessions.keys()];
}

export function getFullTelemetryDashboard() {
  const modelStatus = getModelRegistryStatus();
  const providerHealth = getProviderHealth();
  return {
    timestamp: new Date().toISOString(),
    primaryProvider: 'nvidia',
    secondaryProvider: 'openrouter',
    models: modelStatus,
    providerHealth,
    totalTrackedSessions: sessions.size,
  };
}
