import { env } from './env';

// ──────────────────────────────────────────────────────────────────────────────
// Multi-LLM Provider & Model Orchestrator Configuration
// ──────────────────────────────────────────────────────────────────────────────

export type ModelIntent =
  | 'RESTAURANT_KNOWLEDGE'
  | 'PRODUCT_RECOMMENDATION'
  | 'GENERAL_CONVERSATION'
  | 'TOOL_CALLING'
  | 'LONG_CONTEXT'
  | 'VISION'
  | 'SPEECH_STT'
  | 'SPEECH_TTS'
  | 'EMBEDDINGS';

export interface ModelProfile {
  id: string;
  provider: 'nvidia' | 'openrouter' | 'gemini' | 'groq' | 'ollama' | 'deepinfra' | 'together' | 'openai';
  modelName: string;
  displayName: string;
  intentTargets: ModelIntent[];
  baseURL: string;
  apiKey: string;
  priority: number; // 1 = Highest (NVIDIA primary)
  maxTokens: number;
  contextWindow: number;
  temperature: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  costPer1kPromptUSD: number; // 0 for free NVIDIA tier
  costPer1kCompletionUSD: number;
  timeoutMs: number;
  maxRetries: number;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  description: string;
  defaultBaseURL: string;
  envKeyName: string;
  isPrimary: boolean;
  enabled: boolean;
}

// ─── Supported Provider Definitions (Modular & Extensible) ───────────────────
export const SUPPORTED_PROVIDERS: Record<string, ProviderDefinition> = {
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM API',
    description: 'Primary high-performance free model tier',
    defaultBaseURL: 'https://integrate.api.nvidia.com/v1',
    envKeyName: 'ASSISTANT_NVIDIA_API_KEY',
    isPrimary: true,
    enabled: true,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter API',
    description: 'Secondary automatic failover & specialized model tier',
    defaultBaseURL: 'https://openrouter.ai/api/v1',
    envKeyName: 'ASSISTANT_OPENROUTER_API_KEY',
    isPrimary: false,
    enabled: true,
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini Direct',
    description: 'Direct Google AI fallback & embedding provider',
    defaultBaseURL: 'https://generativelanguage.googleapis.com/v1beta',
    envKeyName: 'ASSISTANT_GEMINI_API_KEY',
    isPrimary: false,
    enabled: true,
  },
  groq: {
    id: 'groq',
    name: 'Groq LPU Inference',
    description: 'Ultra-fast LPU inference (Future Expansion)',
    defaultBaseURL: 'https://api.groq.com/openai/v1',
    envKeyName: 'GROQ_API_KEY',
    isPrimary: false,
    enabled: false,
  },
  ollama: {
    id: 'ollama',
    name: 'Local Ollama Instance',
    description: 'Local on-premises private model inference (Future Expansion)',
    defaultBaseURL: 'http://localhost:11434/v1',
    envKeyName: 'OLLAMA_API_KEY',
    isPrimary: false,
    enabled: false,
  },
};

// ─── Production Model Registry (Allocated by Intent) ───────────────────────────
export const MODEL_REGISTRY: ModelProfile[] = [
  // ── 1. NVIDIA Tier (Primary Provider - Priority 1 & 2) ─────────────────────
  {
    id: 'nvidia-deepseek-v4-flash',
    provider: 'nvidia',
    modelName: 'deepseek-ai/deepseek-v4-flash',
    displayName: 'DeepSeek V4 Flash',
    intentTargets: ['RESTAURANT_KNOWLEDGE', 'PRODUCT_RECOMMENDATION', 'TOOL_CALLING'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 1,
    maxTokens: 1200,
    contextWindow: 64000,
    temperature: 0.3,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 12000,
    maxRetries: 2,
  },
  {
    id: 'nvidia-glm-5-2',
    provider: 'nvidia',
    modelName: 'zhipuai/glm-5.2',
    displayName: 'GLM 5.2 Reasoning',
    intentTargets: ['GENERAL_CONVERSATION', 'TOOL_CALLING'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 1,
    maxTokens: 1500,
    contextWindow: 128000,
    temperature: 0.5,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 12000,
    maxRetries: 2,
  },
  {
    id: 'nvidia-nemotron-3-super',
    provider: 'nvidia',
    modelName: 'nvidia/nemotron-3-super',
    displayName: 'Nemotron 3 Super',
    intentTargets: ['GENERAL_CONVERSATION'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 2,
    maxTokens: 1500,
    contextWindow: 128000,
    temperature: 0.4,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 10000,
    maxRetries: 2,
  },
  {
    id: 'nvidia-kimi-2-7',
    provider: 'nvidia',
    modelName: 'moonshotai/kimi-2.7',
    displayName: 'Kimi 2.7 Long Context',
    intentTargets: ['LONG_CONTEXT'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 1,
    maxTokens: 2500,
    contextWindow: 200000,
    temperature: 0.2,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 15000,
    maxRetries: 2,
  },
  {
    id: 'nvidia-kimi-2-6',
    provider: 'nvidia',
    modelName: 'moonshotai/kimi-2.6',
    displayName: 'Kimi 2.6 Long Context (Secondary)',
    intentTargets: ['LONG_CONTEXT'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 2,
    maxTokens: 2500,
    contextWindow: 200000,
    temperature: 0.2,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 15000,
    maxRetries: 2,
  },
  {
    id: 'nvidia-llama-vision',
    provider: 'nvidia',
    modelName: 'meta/llama-3.2-11b-vision-instruct',
    displayName: 'Llama 3.2 Vision (NVIDIA)',
    intentTargets: ['VISION'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 1,
    maxTokens: 1200,
    contextWindow: 128000,
    temperature: 0.2,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: true,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 15000,
    maxRetries: 2,
  },

  // ── 2. OpenRouter Tier (Secondary / Automatic Failover) ──────────────────────
  {
    id: 'openrouter-gemma-4-31b',
    provider: 'openrouter',
    modelName: 'google/gemma-4-31b',
    displayName: 'Gemma 4 31B (OpenRouter)',
    intentTargets: ['RESTAURANT_KNOWLEDGE', 'LONG_CONTEXT'],
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.ASSISTANT_OPENROUTER_API_KEY,
    priority: 10,
    maxTokens: 1200,
    contextWindow: 32768,
    temperature: 0.4,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    costPer1kPromptUSD: 0.0001,
    costPer1kCompletionUSD: 0.0001,
    timeoutMs: 12000,
    maxRetries: 2,
  },
  {
    id: 'openrouter-gpt-oss-120b',
    provider: 'openrouter',
    modelName: 'openai/gpt-oss-120b',
    displayName: 'GPT OSS 120B (OpenRouter)',
    intentTargets: ['GENERAL_CONVERSATION', 'TOOL_CALLING'],
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.ASSISTANT_OPENROUTER_API_KEY,
    priority: 11,
    maxTokens: 2000,
    contextWindow: 128000,
    temperature: 0.3,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costPer1kPromptUSD: 0.00015,
    costPer1kCompletionUSD: 0.0006,
    timeoutMs: 15000,
    maxRetries: 2,
  },
  {
    id: 'openrouter-ling-3-flash',
    provider: 'openrouter',
    modelName: 'lingai/ling-3.0-flash',
    displayName: 'Ling 3.0 Flash (OpenRouter)',
    intentTargets: ['RESTAURANT_KNOWLEDGE', 'PRODUCT_RECOMMENDATION'],
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.ASSISTANT_OPENROUTER_API_KEY,
    priority: 12,
    maxTokens: 1200,
    contextWindow: 128000,
    temperature: 0.3,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costPer1kPromptUSD: 0.0001,
    costPer1kCompletionUSD: 0.0002,
    timeoutMs: 12000,
    maxRetries: 2,
  },

  // ── 3. Gemini API Tier (Direct / Ultimate Fallback) ─────────────────────────
  {
    id: 'gemini-3-5-flash',
    provider: 'gemini',
    modelName: 'gemini-3.5-flash',
    displayName: 'Gemini 3.5 Flash',
    intentTargets: ['RESTAURANT_KNOWLEDGE', 'LONG_CONTEXT'],
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: env.ASSISTANT_GEMINI_API_KEY,
    priority: 20,
    maxTokens: 2500,
    contextWindow: 1048576,
    temperature: 0.2,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 15000,
    maxRetries: 2,
  },
  {
    id: 'gemini-3-5-flash-lite',
    provider: 'gemini',
    modelName: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash Lite',
    intentTargets: ['GENERAL_CONVERSATION', 'PRODUCT_RECOMMENDATION'],
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: env.ASSISTANT_GEMINI_API_KEY,
    priority: 21,
    maxTokens: 1500,
    contextWindow: 1048576,
    temperature: 0.3,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 12000,
    maxRetries: 2,
  },
];

// ─── Speech Model Registry ───────────────────────────────────────────────────
export const SPEECH_MODELS = {
  stt: {
    primary: {
      provider: 'nvidia',
      modelName: 'nvidia/whisper-large-v3',
      endpoint: 'https://integrate.api.nvidia.com/v1/audio/transcriptions',
      apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    },
    fallback: {
      provider: 'nvidia',
      modelName: 'nvidia/canary-1b',
      endpoint: 'https://integrate.api.nvidia.com/v1/audio/transcriptions',
      apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    },
  },
  tts: {
    primary: {
      provider: 'nvidia',
      modelName: 'nvidia/fastpitch-hifigan',
      endpoint: 'https://integrate.api.nvidia.com/v1/audio/speech',
      apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    },
  },
};

// ─── Helper: Get Candidate Models for an Intent ─────────────────────────────
export function getModelsForIntent(intent: ModelIntent): ModelProfile[] {
  return MODEL_REGISTRY.filter((m) => m.intentTargets.includes(intent) && Boolean(m.apiKey)).sort(
    (a, b) => a.priority - b.priority,
  );
}
