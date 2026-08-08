/**
 * mainBackendClient.ts — Secure Client for Olive Pizza AI → Main Backend
 *
 * Every request is signed with an HMAC (X-AI-Signature + X-AI-Timestamp headers)
 * so the Main Backend knows the request originated from the trusted AI server,
 * not a random attacker who stole a user's Firebase token.
 */

import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env';

const MAIN_BACKEND_URL = env.OLIVE_PIZZA_BACKEND_URL || 'https://olive-pizza-backend.onrender.com';
const AI_GATEWAY_SECRET = process.env.AI_GATEWAY_SECRET || 'olive-ai-gateway-secret-change-in-prod';

class MainBackendClient {

  // ── HMAC Signature Generation ──────────────────────────────────────────────
  private buildSignedHeaders(body: any): Record<string, string> {
    const timestamp = Date.now().toString();
    const payload = `${timestamp}:${JSON.stringify(body)}`;
    const signature = crypto
      .createHmac('sha256', AI_GATEWAY_SECRET)
      .update(payload)
      .digest('hex');
    return { 'X-AI-Signature': signature, 'X-AI-Timestamp': timestamp };
  }

  private getAuthHeaders(token?: string, body: any = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.buildSignedHeaders(body),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  // ── SSO: Sync auth token with Main Backend ──────────────────────────────────
  public async syncAuth(token: string) {
    try {
      const body = {};
      const response = await axios.post(
        `${MAIN_BACKEND_URL}/api/integration/ai/auth/sync`,
        body,
        { headers: this.getAuthHeaders(token, body), timeout: 5000 }
      );
      return response.data;
    } catch (error: any) {
      console.error('[MainBackendClient] Auth sync failed:', error.response?.data || error.message);
      return null;
    }
  }

  // ── Customer Context ────────────────────────────────────────────────────────
  public async getCustomerContext(token: string) {
    try {
      const response = await axios.get(
        `${MAIN_BACKEND_URL}/api/integration/ai/customer`,
        { headers: this.getAuthHeaders(token), timeout: 5000 }
      );
      return response.data;
    } catch (error: any) {
      console.error('[MainBackendClient] Failed to fetch customer context:', error.response?.data || error.message);
      return null;
    }
  }

  // ── Live Menu ───────────────────────────────────────────────────────────────
  public async getLiveMenu(token: string) {
    try {
      const response = await axios.get(
        `${MAIN_BACKEND_URL}/api/integration/ai/menu`,
        { headers: this.getAuthHeaders(token), timeout: 5000 }
      );
      return response.data?.menu;
    } catch (error: any) {
      console.error('[MainBackendClient] Failed to fetch live menu:', error.response?.data || error.message);
      return null;
    }
  }

  // ── Execute Action ──────────────────────────────────────────────────────────
  public async executeAction(token: string, actionType: string, payload: any = {}) {
    const body = { actionType, payload };
    try {
      const response = await axios.post(
        `${MAIN_BACKEND_URL}/api/integration/ai/actions`,
        body,
        { headers: this.getAuthHeaders(token, body), timeout: 8000 }
      );
      return response.data;
    } catch (error: any) {
      console.error(`[MainBackendClient] Action ${actionType} failed:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || error.message, code: error.response?.status || 500 };
    }
  }

  // ── Heartbeat Reporter ──────────────────────────────────────────────────────
  // Called by the AI app's SelfKeepAliveJob every 5 minutes to tell the
  // Main Backend that Olive Pizza AI is alive and healthy.
  public async reportHeartbeat(version: string, activeUsers: number, modelStatus: Record<string, unknown>) {
    const body = { version, activeUsers, modelStatus };
    try {
      await axios.post(
        `${MAIN_BACKEND_URL}/api/integration/ai/heartbeat`,
        body,
        { headers: this.getAuthHeaders(undefined, body), timeout: 5000 }
      );
    } catch (error: any) {
      console.warn('[MainBackendClient] Heartbeat report failed:', error.message);
    }
  }

  // ── Alert Relay ─────────────────────────────────────────────────────────────
  // Forwards production error alerts to the Main Backend email system
  public async relayAlert(to: string[], subject: string, htmlBody: string) {
    const body = { to, subject, htmlBody };
    try {
      const response = await axios.post(
        `${MAIN_BACKEND_URL}/api/integration/ai/alert`,
        body,
        { headers: this.getAuthHeaders(undefined, body), timeout: 8000 }
      );
      return response.status === 200;
    } catch (error: any) {
      console.error('[MainBackendClient] Alert relay failed:', error.message);
      return false;
    }
  }

  // ── Send Event (analytics / cache invalidation) ─────────────────────────────
  public async sendEvent(token: string, eventType: string, context: Record<string, unknown> = {}) {
    const body = { eventType, context };
    try {
      await axios.post(
        `${MAIN_BACKEND_URL}/api/integration/ai/events`,
        body,
        { headers: this.getAuthHeaders(token, body), timeout: 4000 }
      );
    } catch (error: any) {
      console.warn(`[MainBackendClient] Event ${eventType} failed:`, error.message);
    }
  }

  // ── Dynamic Tool Registry Download ──────────────────────────────────────────
  public async fetchToolRegistry() {
    try {
      const response = await axios.get(
        `${MAIN_BACKEND_URL}/api/integration/ai/tools/registry`,
        { headers: this.getAuthHeaders(), timeout: 5000 }
      );
      return response.data?.tools || [];
    } catch (error: any) {
      console.warn('[MainBackendClient] Dynamic tool registry fetch failed, using cached/fallback tools:', error.message);
      return [
        { name: 'ADD_TO_CART', description: 'Add item to user cart', parameters: { productId: 'string', quantity: 'number' } },
        { name: 'APPLY_COUPON', description: 'Apply discount coupon to order', parameters: { couponCode: 'string' } },
        { name: 'PLACE_ORDER', description: 'Place checkout order', parameters: { paymentMethod: 'string' } },
        { name: 'TRACK_ORDER', description: 'Track live order status', parameters: { orderId: 'string' } },
        { name: 'CANCEL_ORDER', description: 'Cancel active order', parameters: { orderId: 'string', reason: 'string' } },
        { name: 'PUBLISH_SDUI', description: 'Publish approved SDUI layout schema to main website', parameters: { sduiSchema: 'object' } },
        { name: 'GENERATE_REPORT', description: 'Generate monthly performance analytics report', parameters: { month: 'string' } },
        { name: 'CREATE_BANNER', description: 'Create and publish promotional website banner', parameters: { bannerData: 'object' } },
        { name: 'SEND_NOTIFICATION', description: 'Send customer/owner push notification', parameters: { targetUserId: 'string', message: 'string' } },
        { name: 'CHANGE_SETTINGS', description: 'Update system or store settings', parameters: { key: 'string', value: 'any' } },
      ];
    }
  }
}

export const mainBackendClient = new MainBackendClient();



