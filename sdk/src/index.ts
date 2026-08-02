// ──────────────────────────────────────────────────────────────────────────────
// Official @olive-ai/sdk v2.0.0 — Client Integration SDK for Olive Pizza
// ──────────────────────────────────────────────────────────────────────────────

export interface OliveSDKOptions {
  gatewayUrl?: string; // default: http://localhost:3051
  apiKey?: string;
  authToken?: string;
  autoReconnect?: boolean;
  onEvent?: (event: OliveSDKEvent) => void;
  onStateSync?: (state: WebsiteContextState) => void;
}

export interface WebsiteContextState {
  currentPage?: string;
  currentCategory?: string;
  currentProduct?: unknown;
  cartItems?: Array<{ productId: string; name?: string; category?: string; price?: number; quantity?: number }>;
  cartTotal?: number;
  checkoutStep?: string;
  activeOrderId?: string;
  orderStatus?: unknown;
  appliedCoupons?: string[];
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: 'customer' | 'owner' | 'developer' | 'delivery_partner' | 'guest' | string;
  isAuthenticated?: boolean;
  preferences?: {
    vegetarianOnly?: boolean;
    spicyLevelMax?: number;
    budgetLimit?: number;
    jain?: boolean;
  };
  deliveryAddress?: unknown;
  currentLocation?: unknown;
  restaurantStatus?: { isOpen: boolean; nextOpenTime?: string };
  language?: string;
  theme?: 'light' | 'dark' | 'system' | string;
  platform?: 'web' | 'android' | 'ios' | 'desktop' | 'tablet' | 'mobile';
  screenSize?: { width: number; height: number };
  navigationHistory?: string[];
  networkStatus?: 'online' | 'offline';
}

export type WebsiteActionType =
  | 'ADD_TO_CART'
  | 'REMOVE_FROM_CART'
  | 'UPDATE_QUANTITY'
  | 'APPLY_COUPON'
  | 'REMOVE_COUPON'
  | 'SEARCH_MENU'
  | 'SEARCH_CATEGORIES'
  | 'OPEN_CATEGORY'
  | 'OPEN_PRODUCT'
  | 'NAVIGATE_PAGE'
  | 'NAVIGATE'
  | 'OPEN_CHECKOUT'
  | 'CHECKOUT'
  | 'PLACE_ORDER'
  | 'REPEAT_ORDER'
  | 'TRACK_ORDER'
  | 'CANCEL_ORDER'
  | 'CONTACT_SUPPORT'
  | 'CALL_RESTAURANT'
  | 'VIEW_OFFERS'
  | 'OPEN_NOTIFICATIONS'
  | 'OPEN_PROFILE'
  | 'EXPLAIN_CURRENT_PAGE'
  | 'VOICE_ORDERING'
  | string;

export interface WebsiteActionPayload {
  type: WebsiteActionType;
  payload: Record<string, unknown>;
  description: string;
  executionSuccess?: boolean;
}

export type OlivePizzaEventType =
  | 'CUSTOMER_LOGGED_IN'
  | 'CUSTOMER_LOGGED_OUT'
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_CANCELLED'
  | 'CART_UPDATED'
  | 'COUPON_APPLIED'
  | 'COUPON_REMOVED'
  | 'PRODUCT_UPDATED'
  | 'MENU_UPDATED'
  | 'STORE_CLOSED'
  | 'STORE_OPEN'
  | 'OFFER_UPDATED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'DELIVERY_ASSIGNED'
  | 'DELIVERY_COMPLETED'
  | 'KNOWLEDGE_UPDATED';

export type OliveSDKEventType =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'THINKING'
  | 'TOKEN'
  | 'ACTION'
  | 'PRODUCT_CARD'
  | 'TELEMETRY'
  | 'ERROR'
  | 'KNOWLEDGE_UPDATED'
  | 'ALERT';

export interface OliveSDKEvent {
  type: OliveSDKEventType;
  data: unknown;
  timestamp: number;
}

export class OliveAISDK {
  private gatewayUrl: string;
  private apiKey?: string;
  private authToken?: string;
  private autoReconnect: boolean;
  private isConnected: boolean = false;
  private eventListeners: Map<OliveSDKEventType, Array<(data: unknown) => void>> = new Map();
  private contextState: WebsiteContextState = {};
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(options: OliveSDKOptions = {}) {
    this.gatewayUrl = options.gatewayUrl || 'http://localhost:3051';
    this.apiKey = options.apiKey;
    this.authToken = options.authToken;
    this.autoReconnect = options.autoReconnect ?? true;
  }

  // ── Authentication & Identity Synchronization ──────────────────────────────
  public authenticate(token: string): void {
    this.authToken = token;
    this.contextState.isAuthenticated = true;
    this.emitEvent('CONNECTED', { authenticated: true, tokenSnippet: token.slice(0, 10) });
  }

  public setUserProfile(user: { id: string; email?: string; name?: string; role?: string }): void {
    this.contextState.userId = user.id;
    this.contextState.userEmail = user.email;
    this.contextState.userName = user.name;
    this.contextState.userRole = user.role;
    this.contextState.isAuthenticated = Boolean(user.id && user.id !== 'guest');
    this.syncContextToServer();
  }

  // ── Connection Management ───────────────────────────────────────────────────
  public async connect(): Promise<boolean> {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/health`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emitEvent('CONNECTED', { gatewayUrl: this.gatewayUrl });
        return true;
      }
    } catch {
      this.handleDisconnect();
    }
    return false;
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.emitEvent('DISCONNECTED', { attempts: this.reconnectAttempts });

    if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      this.emitEvent('RECONNECTING', { attempt: this.reconnectAttempts, delayMs: delay });
      setTimeout(() => this.connect(), delay);
    }
  }

  // ── Live Context Synchronization ───────────────────────────────────────────
  public syncState(newState: Partial<WebsiteContextState>): void {
    this.contextState = { ...this.contextState, ...newState };
  }

  public setPage(pagePath: string, category?: string): void {
    const history = this.contextState.navigationHistory || [];
    history.push(pagePath);
    this.syncState({
      currentPage: pagePath,
      currentCategory: category || this.contextState.currentCategory,
      navigationHistory: history.slice(-10),
    });
    this.syncContextToServer();
  }

  public syncCart(cartItems: any[], total?: number): void {
    const computedTotal = total ?? cartItems.reduce((acc, i) => acc + (i.price || 0) * (i.quantity || 1), 0);
    this.syncState({ cartItems, cartTotal: computedTotal });
    this.syncContextToServer();
  }

  public getState(): WebsiteContextState {
    return { ...this.contextState };
  }

  private async syncContextToServer(): Promise<void> {
    try {
      await fetch(`${this.gatewayUrl}/api/ai/context`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          sessionId: this.contextState.userId || 'guest_session',
          websiteContext: this.contextState,
        }),
      });
    } catch {
      /* ignore context sync error in background */
    }
  }

  // ── Live Menu & Product Retrieval ───────────────────────────────────────────
  public async fetchMenu(filters: { category?: string; veg?: boolean; search?: string } = {}): Promise<any> {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.veg !== undefined) params.set('veg', String(filters.veg));
    if (filters.search) params.set('q', filters.search);

    const res = await fetch(`${this.gatewayUrl}/api/ai/menu?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  // ── Tool Execution Gateway (All 21 Actions) ─────────────────────────────────
  public async executeAction(action: WebsiteActionPayload): Promise<any> {
    const res = await fetch(`${this.gatewayUrl}/api/ai/action`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ action, websiteContext: this.contextState }),
    });
    const result = await res.json();
    this.emitEvent('ACTION', result);
    return result;
  }

  // ── Page Explanation & Voice Ordering Helpers ───────────────────────────────
  public async explainCurrentPage(pagePath?: string): Promise<string> {
    const targetPage = pagePath || this.contextState.currentPage || '/';
    const result = await this.executeAction({
      type: 'EXPLAIN_CURRENT_PAGE',
      payload: { page: targetPage },
      description: `Explain page: ${targetPage}`,
    });
    return result?.payload?.explanation || result?.message || 'Artisan Olive Pizza platform.';
  }

  public async processVoiceOrder(transcript: string): Promise<any> {
    return this.executeAction({
      type: 'VOICE_ORDERING',
      payload: { transcript },
      description: `Voice order: "${transcript}"`,
    });
  }

  // ── Streaming Chat ──────────────────────────────────────────────────────────
  public async stream(
    messages: Array<{ role: string; content: string }>,
    sessionId: string,
    onChunk: (token: string) => void,
    onAction?: (action: WebsiteActionPayload) => void,
    onDone?: (metadata: unknown) => void,
  ): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const response = await fetch(`${this.gatewayUrl}/api/ai/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        messages,
        sessionId,
        websiteContext: this.contextState,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`AI Gateway Error ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);

          if (parsed.type === 'thinking') {
            this.emitEvent('THINKING', parsed.data);
          } else if (parsed.type === 'chunk') {
            onChunk(parsed.data.token);
            this.emitEvent('TOKEN', parsed.data);
          } else if (parsed.type === 'action') {
            onAction?.(parsed.data as WebsiteActionPayload);
            this.emitEvent('ACTION', parsed.data);
          } else if (parsed.type === 'product_card') {
            this.emitEvent('PRODUCT_CARD', parsed.data);
          } else if (parsed.type === 'telemetry') {
            this.emitEvent('TELEMETRY', parsed.data);
          } else if (parsed.type === 'done') {
            onDone?.(parsed.data);
          } else if (parsed.type === 'error') {
            this.emitEvent('ERROR', parsed.data);
          }
        } catch {
          /* skip */
        }
      }
    }
  }

  // ── Event Webhook Dispatcher ────────────────────────────────────────────────
  public async emitEventWebhook(eventType: OlivePizzaEventType, data: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/ai/events`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          eventType,
          userId: this.contextState.userId,
          sessionId: this.contextState.userId ? `session_${this.contextState.userId}` : undefined,
          data,
          timestamp: Date.now(),
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Knowledge Sync Webhook Trigger ──────────────────────────────────────────
  public async syncKnowledge(category: string, data: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/ai/knowledge/sync`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ category, data, timestamp: Date.now() }),
      });
      if (res.ok) {
        this.emitEvent('KNOWLEDGE_UPDATED', { category, count: Object.keys(data).length });
        return true;
      }
    } catch (err) {
      console.error('❌ Knowledge sync failed:', (err as Error).message);
    }
    return false;
  }

  // ── Recommendations (Multi-Surface) ─────────────────────────────────────────
  public async getRecommendations(userPreferences?: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${this.gatewayUrl}/api/ai/recommendations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ preferences: userPreferences, context: this.contextState }),
    });
    return res.json();
  }

  public async getHomepageRecommendations(params: { weather?: string; timeOfDay?: string; isVeg?: boolean } = {}): Promise<any> {
    const res = await fetch(`${this.gatewayUrl}/api/ai/recommendations/homepage`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...params, userId: this.contextState.userId }),
    });
    return res.json();
  }

  public async getDashboardRecommendations(params: { isVeg?: boolean } = {}): Promise<any> {
    const res = await fetch(`${this.gatewayUrl}/api/ai/recommendations/dashboard`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...params, userId: this.contextState.userId, userRole: this.contextState.userRole }),
    });
    return res.json();
  }

  // ── Event Emitter ───────────────────────────────────────────────────────────
  public on(event: OliveSDKEventType, listener: (data: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
    return () => {
      const list = this.eventListeners.get(event);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
      }
    };
  }

  private emitEvent(type: OliveSDKEventType, data: unknown): void {
    const listeners = this.eventListeners.get(type) ?? [];
    listeners.forEach((fn) => fn(data));
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Olive-SDK-Version': '2.0.0',
      'X-Request-ID': `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    return headers;
  }
}

export const oliveAI = new OliveAISDK();
