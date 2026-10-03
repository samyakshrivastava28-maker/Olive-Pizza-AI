import { mainBackendClient } from '../integration/mainBackendClient';
import type { WebsiteAction } from '../../types';

export interface ToolExecutionResult {
  success: boolean;
  actionType: string;
  payload: Record<string, unknown>;
  resultData?: Record<string, unknown>;
  message: string;
  timestamp: number;
  code?: string;
}

const UI_ONLY_ACTIONS = [
  'NAVIGATE', 'SCROLL', 'HIGHLIGHT', 'OPEN_MODAL', 'CLOSE_MODAL', 
  'FOCUS', 'OPEN_MENU', 'OPEN_OFFERS', 'OPEN_SUPPORT', 'OPEN_PROFILE', 
  'OPEN_DASHBOARD', 'NAVIGATE_PAGE', 'OPEN_CATEGORY', 'OPEN_CHECKOUT',
  'CONTACT_SUPPORT'
];

/**
 * Business actions are executed ONLY by the Main Backend, under the caller's verified Firebase identity.
 * The AI layer never authorizes an action because the prompt asked for it, and never substitutes a
 * placeholder identity: no verified token => the business action is refused.
 */
export async function executeToolAction(
  action: WebsiteAction,
  verifiedIdToken?: string,
): Promise<ToolExecutionResult> {
  const normType = action.type.toUpperCase();
  const timestamp = Date.now();

  try {
    // 1. Purely frontend UI action — no business effect
    if (UI_ONLY_ACTIONS.includes(normType)) {
      return {
        success: true,
        actionType: normType,
        payload: action.payload as any,
        message: `Executed UI action: ${normType}`,
        timestamp,
      };
    }

    // 2. Business action — requires a verified end-user identity
    if (!verifiedIdToken) {
      return {
        success: false,
        actionType: normType,
        payload: action.payload as any,
        message: 'Please sign in to perform this action.',
        code: 'AUTH_REQUIRED',
        timestamp,
      };
    }

    const response = await mainBackendClient.executeAction(verifiedIdToken, normType, action.payload);

    if (response && response.success !== false) {
      return {
        success: true,
        actionType: normType,
        payload: action.payload as any,
        resultData: response.data,
        message: response.message || `Action ${normType} completed by the Main Backend.`,
        timestamp,
      };
    }

    // Real failure from the Main Backend — surface it, never pretend it was acknowledged.
    return {
      success: false,
      actionType: normType,
      payload: action.payload as any,
      message: response?.error || `Main Backend rejected ${normType}.`,
      code: response?.code ? String(response.code) : 'MAIN_BACKEND_REJECTED',
      timestamp,
    };
  } catch (error: any) {
    console.error(`[ToolExecutor] Error executing ${normType}:`, error);
    return {
      success: false,
      actionType: normType,
      payload: action.payload as any,
      message: `System error while executing ${normType}.`,
      timestamp,
    };
  }
}
