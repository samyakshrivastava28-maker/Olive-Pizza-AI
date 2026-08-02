import axios from 'axios';
import { env } from '../../config/env';

const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL || 'http://localhost:5000';

class MainBackendClient {
  private getHeaders(token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public async getCustomerContext(token: string) {
    try {
      const response = await axios.get(`${MAIN_BACKEND_URL}/api/integration/ai/customer`, {
        headers: this.getHeaders(token),
        timeout: 5000,
      });
      return response.data;
    } catch (error: any) {
      console.error('[MainBackendClient] Failed to fetch customer context:', error.response?.data || error.message);
      return null;
    }
  }

  public async getLiveMenu(token: string) {
    try {
      const response = await axios.get(`${MAIN_BACKEND_URL}/api/integration/ai/menu`, {
        headers: this.getHeaders(token),
        timeout: 5000,
      });
      return response.data?.menu;
    } catch (error: any) {
      console.error('[MainBackendClient] Failed to fetch live menu:', error.response?.data || error.message);
      return null;
    }
  }

  public async executeAction(token: string, actionType: string, payload: any = {}) {
    try {
      const response = await axios.post(
        `${MAIN_BACKEND_URL}/api/integration/ai/actions`,
        { actionType, payload },
        { headers: this.getHeaders(token), timeout: 8000 }
      );
      return response.data;
    } catch (error: any) {
      console.error(`[MainBackendClient] Action ${actionType} failed:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        code: error.response?.status || 500
      };
    }
  }
}

export const mainBackendClient = new MainBackendClient();
