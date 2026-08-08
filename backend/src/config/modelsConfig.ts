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

export interface ImageModelProfile {
  id: string;
  provider: 'nvidia' | 'openrouter' | 'black-forest-labs' | 'stability';
  modelName: string;
  displayName: string;
  baseURL: string;
  apiKey: string;
  priority: number;
}

// ─── Production Model Registry (Strictly per Olive-Pizza-AI-Final-Architecture.md) ───
export const MODEL_REGISTRY: ModelProfile[] = [
  {
    id: 'nvidia-glm-5-2',
    provider: 'nvidia',
    modelName: 'zhipuai/glm-5.2',
    displayName: 'GLM 5.2',
    intentTargets: ['GENERAL_CONVERSATION', 'TOOL_CALLING', 'LONG_CONTEXT'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 1,
    maxTokens: 2000,
    contextWindow: 128000,
    temperature: 0.5,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 800,
    maxRetries: 1,
  },
  {
    id: 'nvidia-deepseek-v4-pro',
    provider: 'nvidia',
    modelName: 'deepseek-ai/deepseek-v4-pro',
    displayName: 'DeepSeek V4 Pro',
    intentTargets: ['RESTAURANT_KNOWLEDGE', 'TOOL_CALLING', 'LONG_CONTEXT'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 1,
    maxTokens: 2000,
    contextWindow: 128000,
    temperature: 0.3,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 800,
    maxRetries: 1,
  },
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
    timeoutMs: 800,
    maxRetries: 1,
  },
  {
    id: 'nvidia-kimi-2-6',
    provider: 'nvidia',
    modelName: 'moonshotai/kimi-2.6',
    displayName: 'Kimi 2.6',
    intentTargets: ['LONG_CONTEXT', 'RESTAURANT_KNOWLEDGE'],
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
    timeoutMs: 800,
    maxRetries: 1,
  },
  {
    id: 'nvidia-qwen-3',
    provider: 'nvidia',
    modelName: 'qwen/qwen-3',
    displayName: 'Qwen 3',
    intentTargets: ['PRODUCT_RECOMMENDATION', 'GENERAL_CONVERSATION'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 1,
    maxTokens: 2000,
    contextWindow: 128000,
    temperature: 0.4,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 800,
    maxRetries: 1,
  },
  {
    id: 'nvidia-gemma-4',
    provider: 'nvidia',
    modelName: 'google/gemma-4-31b',
    displayName: 'Gemma 4',
    intentTargets: ['RESTAURANT_KNOWLEDGE', 'GENERAL_CONVERSATION'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 1,
    maxTokens: 1500,
    contextWindow: 32768,
    temperature: 0.4,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 800,
    maxRetries: 1,
  },
  {
    id: 'nvidia-gpt-oss-120b',
    provider: 'nvidia',
    modelName: 'openai/gpt-oss-120b',
    displayName: 'GPT OSS 120B',
    intentTargets: ['GENERAL_CONVERSATION', 'TOOL_CALLING'],
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 1,
    maxTokens: 2000,
    contextWindow: 128000,
    temperature: 0.3,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costPer1kPromptUSD: 0.0,
    costPer1kCompletionUSD: 0.0,
    timeoutMs: 800,
    maxRetries: 1,
  },
];

// ─── Image Model Registry (Strictly per Olive-Pizza-AI-Final-Architecture.md) ───
export const IMAGE_MODEL_REGISTRY: ImageModelProfile[] = [
  {
    id: 'qwen-image',
    provider: 'nvidia',
    modelName: 'qwen/qwen-image',
    displayName: 'Qwen Image',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 1,
  },
  {
    id: 'flux-1-dev',
    provider: 'black-forest-labs',
    modelName: 'black-forest-labs/flux-1-dev',
    displayName: 'FLUX.1-dev',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 2,
  },
  {
    id: 'flux-1-kontext-dev',
    provider: 'black-forest-labs',
    modelName: 'black-forest-labs/flux-1-kontext-dev',
    displayName: 'FLUX.1-kontext-dev',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 3,
  },
  {
    id: 'flux-1-schnell',
    provider: 'black-forest-labs',
    modelName: 'black-forest-labs/flux-1-schnell',
    displayName: 'FLUX.1-schnell',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 4,
  },
  {
    id: 'sd-3-5-large',
    provider: 'stability',
    modelName: 'stabilityai/stable-diffusion-3.5-large',
    displayName: 'Stable Diffusion 3.5 Large',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    priority: 5,
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
      modelName: 'nvidia/chatterbox-multilingual',
      displayName: 'Chatterbox TTS Multilingual',
      endpoint: 'https://integrate.api.nvidia.com/v1/audio/speech',
      apiKey: env.ASSISTANT_NVIDIA_API_KEY,
    },
    fallback: {
      provider: 'nvidia',
      modelName: 'nvidia/fastpitch-hifigan',
      displayName: 'FastPitch HiFi-GAN',
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

