import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// ── Types ────────────────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system';
export type ThinkingStage = 'embedding' | 'retrieval' | 'generating' | null;

export interface ProductCard {
  productId: string;
}

export interface WebsiteAction {
  type: string;
  payload: Record<string, unknown>;
  description: string;
  executionSuccess?: boolean;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  productCards?: ProductCard[];
  actions?: WebsiteAction[];
  metadata?: {
    model?: string;
    provider?: string;
    latencyMs?: number;
    tokensUsed?: number;
    retrievedChunks?: number;
    similarityScore?: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface TelemetryMetrics {
  activeModel: string;
  activeEmbeddingModel: string;
  activeVectorDB: string;
  avgLatencyMs: number;
  tokenCount: number;
  estimatedCostUSD: number;
  retrievedChunks: number;
  similarityScore: number;
  contextSizeChars: number;
  fallbacksTriggered: number;
  errorsCount: number;
  // Extended Diagnostics
  intentClassified?: string;
  embeddingGenerated?: boolean;
  pineconeQueried?: boolean;
  pineconeLatencyMs?: number;
  vectorsRetrieved?: number;
  topSimilarityScore?: number;
  retrievedDocumentIds?: string[];
  firestoreQueried?: boolean;
  finalContextLengthChars?: number;
  restaurantKnowledgeUsed?: boolean;
  catalogGuardStatus?: string;
  flaggedHallucinatedItems?: string[];
}

export interface WebsiteContext {
  currentPage?: string;
  cartItems?: any[];
  userId?: string;
  userEmail?: string;
  userRole?: string;
  isAuthenticated?: boolean;
  appliedCoupons?: string[];
  selectedAddress?: unknown;
  currentProduct?: unknown;
  orderStatus?: unknown;
  language?: string;
  theme?: string;
}

interface ChatStore {
  // Session
  sessionId: string;

  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;

  // Active conversation messages
  messages: ChatMessage[];

  // UI State
  isThinking: boolean;
  thinkingStage: ThinkingStage;
  thinkingLabel: string;
  isVoiceActive: boolean;
  isTelemetryOpen: boolean;
  isSidebarOpen: boolean;

  // Telemetry
  telemetry: TelemetryMetrics | null;

  // Website context (set by host app)
  websiteContext: WebsiteContext;

  // Input
  inputValue: string;

  // Actions
  setInputValue: (val: string) => void;
  sendMessage: (content: string) => void;
  appendToken: (token: string) => void;
  finalizeMessage: (metadata?: ChatMessage['metadata'], actions?: WebsiteAction[], productCards?: ProductCard[]) => void;
  setThinking: (stage: ThinkingStage, label?: string) => void;
  setTelemetry: (metrics: TelemetryMetrics) => void;
  setVoiceActive: (active: boolean) => void;
  toggleTelemetry: () => void;
  toggleSidebar: () => void;
  startNewConversation: () => void;
  setWebsiteContext: (ctx: Partial<WebsiteContext>) => void;
  executeAction: (action: WebsiteAction) => Promise<void>;
  loadConversation: (id: string) => void;
  clearError: () => void;
}

// ── Store ────────────────────────────────────────────────────────────────────
export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessionId: uuidv4(),
  conversations: [],
  activeConversationId: null,
  messages: [],
  isThinking: false,
  thinkingStage: null,
  thinkingLabel: '',
  isVoiceActive: false,
  isTelemetryOpen: false,
  isSidebarOpen: true,
  telemetry: null,
  websiteContext: {
    cartItems: [],
    appliedCoupons: [],
    currentPage: '/',
    isAuthenticated: false,
  },
  inputValue: '',

  setInputValue: (val) => set({ inputValue: val }),

  sendMessage: (content) => {
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    const placeholderMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    set((s) => ({
      messages: [...s.messages, userMessage, placeholderMessage],
      inputValue: '',
      isThinking: true,
      thinkingStage: 'embedding',
      thinkingLabel: 'Generating query embedding…',
    }));
  },

  appendToken: (token) => {
    set((s) => {
      const messages = [...s.messages];
      const lastIdx = messages.length - 1;
      if (messages[lastIdx]?.isStreaming) {
        messages[lastIdx] = {
          ...messages[lastIdx],
          content: messages[lastIdx].content + token,
        };
      }
      return { messages };
    });
  },

  finalizeMessage: (metadata, actions, productCards) => {
    set((s) => {
      const messages = [...s.messages];
      const lastIdx = messages.length - 1;
      if (messages[lastIdx]?.isStreaming) {
        messages[lastIdx] = {
          ...messages[lastIdx],
          isStreaming: false,
          metadata,
          actions,
          productCards,
        };
      }

      // Auto-save conversation to history
      const state = get();
      const title =
        state.messages.find((m) => m.role === 'user')?.content.slice(0, 40) ??
        'New Chat';
      const existing = state.conversations.find(
        (c) => c.id === state.activeConversationId,
      );
      const conversations = existing
        ? state.conversations.map((c) =>
            c.id === state.activeConversationId
              ? { ...c, messages, updatedAt: Date.now() }
              : c,
          )
        : [
            {
              id: state.sessionId,
              title,
              messages,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            ...state.conversations,
          ];

      return {
        messages,
        isThinking: false,
        thinkingStage: null,
        conversations,
        activeConversationId: state.activeConversationId ?? state.sessionId,
      };
    });
  },

  setThinking: (stage, label = '') =>
    set({ isThinking: !!stage, thinkingStage: stage, thinkingLabel: label }),

  setTelemetry: (metrics) => set({ telemetry: metrics }),

  setVoiceActive: (active) => set({ isVoiceActive: active }),

  toggleTelemetry: () => set((s) => ({ isTelemetryOpen: !s.isTelemetryOpen })),

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  startNewConversation: () =>
    set({
      messages: [],
      sessionId: uuidv4(),
      activeConversationId: null,
      isThinking: false,
      thinkingStage: null,
      telemetry: null,
    }),

  setWebsiteContext: (ctx) =>
    set((s) => ({ websiteContext: { ...s.websiteContext, ...ctx } })),

  executeAction: async (action) => {
    const normType = action.type.toUpperCase();
    const currentCtx = get().websiteContext;

    // Mutate internal state for immediate snappy UI feedback
    if (normType === 'ADD_TO_CART') {
      const items = [...(currentCtx.cartItems || [])];
      items.push(action.payload);
      set({ websiteContext: { ...currentCtx, cartItems: items } });
    } else if (normType === 'APPLY_COUPON') {
      const code = String(action.payload.code || '').toUpperCase();
      const coupons = Array.from(new Set([...(currentCtx.appliedCoupons || []), code]));
      set({ websiteContext: { ...currentCtx, appliedCoupons: coupons } });
    } else if (normType === 'REMOVE_COUPON') {
      set({ websiteContext: { ...currentCtx, appliedCoupons: [] } });
    } else if (normType === 'NAVIGATE_PAGE') {
      // Allow AI to trigger page navigation in the host app
      set({ websiteContext: { ...currentCtx, currentPage: String(action.payload.url || action.payload.page || '/') } });
    }

    // Call backend action executor
    try {
      await fetch('/api/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, websiteContext: currentCtx }),
      });
    } catch {
      /* Handled locally */
    }

    // Dispatch DOM event for host website (if not embedded)
    window.dispatchEvent(
      new CustomEvent('olive-ai-action', { detail: action, bubbles: true }),
    );

    // If embedded via iframe, dispatch to parent window
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'OLIVE_AI_ACTION', payload: action }, '*');
    }

    console.log('🎬 AI Action executed & dispatched:', normType, action.payload);
  },

  loadConversation: (id) => {
    const conv = get().conversations.find((c) => c.id === id);
    if (conv) {
      set({
        messages: conv.messages,
        activeConversationId: id,
        sessionId: id,
        isThinking: false,
      });
    }
  },

  clearError: () => set((s) => {
    const messages = [...s.messages];
    const lastIdx = messages.length - 1;
    if (messages[lastIdx]?.isStreaming) {
      messages[lastIdx] = {
        ...messages[lastIdx],
        isStreaming: false,
        content: "⚠️ Network Error: Unable to reach the AI Backend. If you are on Vercel, please check your VITE_API_URL and ensure your domain is added to the backend's CORS_ORIGIN environment variable on Render."
      };
    }
    return { isThinking: false, thinkingStage: null, messages };
  }),
    }),
    {
      name: 'olive-ai-chat-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
      partialize: (state) => ({ 
        messages: state.messages, 
        conversations: state.conversations, 
        activeConversationId: state.activeConversationId, 
        sessionId: state.sessionId,
        websiteContext: state.websiteContext
      }), // Only persist these keys
    }
  )
);
