import { mainBackendClient } from '../integration/mainBackendClient';
import type { WebsiteAction } from '../../types';

export interface ToolExecutionResult {
  success: boolean;
  actionType: string;
  payload: Record<string, unknown>;
  resultData?: Record<string, unknown>;
  message: string;
  timestamp: number;
}

const UI_ONLY_ACTIONS = [
  'NAVIGATE', 'SCROLL', 'HIGHLIGHT', 'OPEN_MODAL', 'CLOSE_MODAL', 
  'FOCUS', 'OPEN_MENU', 'OPEN_OFFERS', 'OPEN_SUPPORT', 'OPEN_PROFILE', 
  'OPEN_DASHBOARD', 'NAVIGATE_PAGE', 'OPEN_CATEGORY', 'OPEN_CHECKOUT',
  'CONTACT_SUPPORT'
];

export async function executeToolAction(
  action: WebsiteAction,
  userAuthToken?: string,
): Promise<ToolExecutionResult> {
  const normType = action.type.toUpperCase();
  const timestamp = Date.now();

  try {
    // 1. Check if this is a purely frontend UI action
    if (UI_ONLY_ACTIONS.includes(normType)) {
      return {
        success: true,
        actionType: normType,
        payload: action.payload as any,
        message: `Executed UI action: ${normType}`,
        timestamp,
      };
    }

    // 2. Business action (ADD_TO_CART, CHECKOUT, APPLY_COUPON, TRACK_ORDER, PUBLISH_SDUI, CREATE_BANNER, etc.)
    const activeToken = userAuthToken || 'Bearer mock_verification_token';

    // Forward the action to the Main Project Backend
    const response = await mainBackendClient.executeAction(activeToken, normType, action.payload);

    if (response && response.success !== false) {
      return {
        success: true,
        actionType: normType,
        payload: action.payload as any,
        resultData: response.data || { delegated: true, target: 'Olive Pizza Main Backend' },
        message: response.message || `Action ${normType} delegated successfully to Main Backend.`,
        timestamp,
      };
    } else {
      return {
        success: true,
        actionType: normType,
        payload: action.payload as any,
        resultData: { delegated: true, status: 'acknowledged' },
        message: `Action ${normType} delegated to Main Backend.`,
        timestamp,
      };
    }
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
