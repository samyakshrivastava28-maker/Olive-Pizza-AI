import { z } from 'zod';

// ─────────────────────────────────────────────
// Chat & Conversation Types
// ─────────────────────────────────────────────
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().optional().default(() => require('uuid').v4()),
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.number().optional().default(() => Date.now()),
  metadata: z
    .object({
      model: z.string().optional(),
      provider: z.string().optional(),
      latencyMs: z.number().optional(),
      tokensUsed: z.number().optional(),
      retrievedChunks: z.number().optional(),
      similarityScore: z.number().optional(),
      actions: z.array(z.string()).optional(),
    })
    .optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const WebsiteContextSchema = z.object({
  currentPage: z.string().optional(),
  currentCategory: z.string().optional(),
  currentProduct: z.any().optional(),
  cartItems: z.array(z.any()).optional(),
  cartTotal: z.number().optional(),
  checkoutStep: z.string().optional(),
  activeOrderId: z.string().optional(),
  orderStatus: z.any().optional(),
  appliedCoupons: z.array(z.string()).optional(),
  userId: z.string().optional(),
  userEmail: z.string().optional(),
  userName: z.string().optional(),
  userRole: z.string().optional(),
  isAuthenticated: z.boolean().optional(),
  deliveryAddress: z.any().optional(),
  currentLocation: z.any().optional(),
  restaurantStatus: z.object({ isOpen: z.boolean(), nextOpenTime: z.string().optional() }).optional(),
  screenSize: z.object({ width: z.number(), height: z.number() }).optional(),
  platform: z.enum(['web', 'android', 'ios', 'desktop', 'tablet', 'mobile']).optional(),
  language: z.string().optional(),
  theme: z.string().optional(),
  navigationHistory: z.array(z.string()).optional(),
  preferences: z
    .object({
      vegetarianOnly: z.boolean().optional(),
      spicyLevelMax: z.number().optional(),
      budgetLimit: z.number().optional(),
      jain: z.boolean().optional(),
    })
    .optional(),
});
export type WebsiteContext = z.infer<typeof WebsiteContextSchema>;

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  sessionId: z.string(),
  websiteContext: WebsiteContextSchema.optional(),
  voiceMode: z.boolean().optional().default(false),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ─────────────────────────────────────────────
// Vector Retrieval Types
// ─────────────────────────────────────────────
export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, unknown>;
  source: 'pinecone' | 'qdrant' | 'firestore' | 'local_json';
}

export interface RetrievedContext {
  chunks: VectorSearchResult[];
  firestoreFacts: FirestoreFact[];
  totalTokens: number;
  assembledPrompt: string;
  /** IDs of Pinecone docs retrieved */
  documentIds?: string[];
  /** Was Pinecone queried? */
  pineconeQueried: boolean;
  /** Was Firestore queried? */
  firestoreQueried: boolean;
}

export interface FirestoreFact {
  collection: string;
  docId: string;
  data: Record<string, unknown>;
  relevanceScore: number;
}

// ─────────────────────────────────────────────
// CatalogGuard Types
// ─────────────────────────────────────────────
export type CatalogGuardStatus = 'PASS' | 'FLAGGED_HALLUCINATION' | 'SANITIZED' | 'UNAVAILABLE';

export interface CatalogGuardResult {
  status: CatalogGuardStatus;
  /** Items detected in LLM response but NOT in verified catalog */
  flaggedItems: string[];
  /** Final sanitized text (may be same as original if PASS) */
  sanitizedText: string;
  /** Verified product IDs extracted from response */
  verifiedProductIds: string[];
  /** True if restaurant knowledge context was used before LLM call */
  restaurantKnowledgeUsed: boolean;
}

// ─────────────────────────────────────────────
// LLM Provider Types
// ─────────────────────────────────────────────
export type LLMProvider =
  | 'deepseek-v4-flash'
  | 'glm-5.2'
  | 'nemotron-3-super'
  | 'kimi-2.7'
  | 'kimi-2.6'
  | 'openrouter-gemma-4-31b'
  | 'openrouter-gpt-oss-120b'
  | 'openrouter-ling-3-flash'
  | 'openrouter-gemini-flash'
  | 'openrouter-gemini-flash-lite';

export interface LLMProviderConfig {
  id: LLMProvider;
  baseURL: string;
  model: string;
  apiKey: string;
  maxRetries: number;
  timeoutMs: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  priority: number;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  actions?: WebsiteAction[];
}

// ─────────────────────────────────────────────
// Embedding Types
// ─────────────────────────────────────────────
export type EmbeddingProvider =
  | 'bge-m3'
  | 'nv-embedcode-7b-v1'
  | 'nv-embed-v1'
  | 'nemotron-embed-1b'
  | 'llama-nemotron-embed-vl-1b'
  | 'gemini-embedding';

export interface EmbeddingResult {
  vector: number[];
  provider: EmbeddingProvider;
  latencyMs: number;
  dimensions: number;
}

// ─────────────────────────────────────────────
// Website Action Types (All 21 Supported Commands)
// ─────────────────────────────────────────────
export const WebsiteActionTypeSchema = z.enum([
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'UPDATE_QUANTITY',
  'APPLY_COUPON',
  'REMOVE_COUPON',
  'SEARCH_MENU',
  'SEARCH_CATEGORIES',
  'OPEN_CATEGORY',
  'OPEN_PRODUCT',
  'NAVIGATE_PAGE',
  'NAVIGATE',
  'OPEN_CHECKOUT',
  'CHECKOUT',
  'PLACE_ORDER',
  'REPEAT_ORDER',
  'TRACK_ORDER',
  'CANCEL_ORDER',
  'CONTACT_SUPPORT',
  'CALL_RESTAURANT',
  'VIEW_OFFERS',
  'OPEN_NOTIFICATIONS',
  'OPEN_PROFILE',
  'EXPLAIN_CURRENT_PAGE',
  'VOICE_ORDERING',
]);
export type WebsiteActionType = z.infer<typeof WebsiteActionTypeSchema>;

export const WebsiteActionSchema = z.object({
  type: WebsiteActionTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  description: z.string(),
});
export type WebsiteAction = z.infer<typeof WebsiteActionSchema>;

// ─────────────────────────────────────────────
// Event-Driven Ecosystem Types (All 18 Webhook Events)
// ─────────────────────────────────────────────
export const OlivePizzaEventTypeSchema = z.enum([
  'CUSTOMER_LOGGED_IN',
  'CUSTOMER_LOGGED_OUT',
  'ORDER_CREATED',
  'ORDER_UPDATED',
  'ORDER_CANCELLED',
  'CART_UPDATED',
  'COUPON_APPLIED',
  'COUPON_REMOVED',
  'PRODUCT_UPDATED',
  'MENU_UPDATED',
  'STORE_CLOSED',
  'STORE_OPEN',
  'OFFER_UPDATED',
  'PAYMENT_COMPLETED',
  'PAYMENT_FAILED',
  'DELIVERY_ASSIGNED',
  'DELIVERY_COMPLETED',
  'KNOWLEDGE_UPDATED',
]);
export type OlivePizzaEventType = z.infer<typeof OlivePizzaEventTypeSchema>;

export const OlivePizzaEventSchema = z.object({
  eventId: z.string().default(() => `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
  eventType: OlivePizzaEventTypeSchema,
  timestamp: z.number().default(() => Date.now()),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
  signature: z.string().optional(),
});
export type OlivePizzaEvent = z.infer<typeof OlivePizzaEventSchema>;

// ─────────────────────────────────────────────
// Recommendation Surface & Strategy Types
// ─────────────────────────────────────────────
export type RecommendationSurface = 'homepage' | 'dashboard' | 'chat' | 'checkout';

export type HomepageRecommendationType =
  | 'trending'
  | 'combos'
  | 'frequently_bought_together'
  | 'todays_specials'
  | 'late_night'
  | 'because_you_ordered'
  | 'popular_near_you'
  | 'weekend_specials';

export type DashboardRecommendationType =
  | 'personal_favorites'
  | 'reorder'
  | 'suggested_coupons'
  | 'healthy_choices'
  | 'budget_choices'
  | 'premium_choices'
  | 'recently_viewed';

// ─────────────────────────────────────────────
// Telemetry Types
// ─────────────────────────────────────────────
export interface TelemetryEvent {
  sessionId: string;
  timestamp: number;
  stage: 'embedding' | 'retrieval' | 'llm' | 'validation' | 'catalogguard' | 'action' | 'event';
  provider: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
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
  events: TelemetryEvent[];
  // ── Diagnostics expanded ──
  intentClassified?: string;
  embeddingGenerated?: boolean;
  pineconeQueried?: boolean;
  pineconeLatencyMs?: number;
  vectorsRetrieved?: number;
  topSimilarityScore?: number;
  retrievedDocumentIds?: string[];
  firestoreQueried?: boolean;
  firestoreCollectionsAccessed?: string[];
  finalContextLengthChars?: number;
  restaurantKnowledgeUsed?: boolean;
  catalogGuardStatus?: string;
  flaggedHallucinatedItems?: string[];
}

// ─────────────────────────────────────────────
// SSE Stream Event Types
// ─────────────────────────────────────────────
export type SSEEventType =
  | 'thinking'
  | 'chunk'
  | 'action'
  | 'product_card'
  | 'error'
  | 'done'
  | 'telemetry';

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}
