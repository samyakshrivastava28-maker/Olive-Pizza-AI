import { useChatStore } from '../store/chatStore';
import type { ChatMessage, WebsiteAction, TelemetryMetrics, ThinkingStage } from '../store/chatStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function streamChat(
  messages: ChatMessage[],
  sessionId: string,
  websiteContext: Record<string, unknown>,
): Promise<void> {
  const store = useChatStore.getState();

  // Notify store that user message is sent
  store.sendMessage(messages.at(-1)?.content ?? '');

  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, sessionId, websiteContext }),
  });

  if (!response.ok || !response.body) {
    store.clearError();
    throw new Error(`API error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const accumulatedActions: WebsiteAction[] = [];
  const accumulatedCards: any[] = []; // Using any to avoid type errors with ProductCard if it's not imported

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
        const event = JSON.parse(raw) as {
          type: string;
          data: Record<string, unknown>;
        };
        handleSSEEvent(event, accumulatedActions, accumulatedCards);
      } catch {
        /* skip malformed */
      }
    }
  }
}

function handleSSEEvent(
  event: { type: string; data: Record<string, unknown> },
  accumulatedActions: WebsiteAction[],
  accumulatedCards: any[]
): void {
  const store = useChatStore.getState();

  switch (event.type) {
    case 'thinking':
      store.setThinking(
        event.data.stage as unknown as ThinkingStage,
        (event.data.label as string) || '',
      );
      break;

    case 'chunk':
      store.appendToken((event.data.token as string) || '');
      store.setThinking(null);
      break;

    case 'action':
      const action = event.data as unknown as WebsiteAction;
      accumulatedActions.push(action);
      store.executeAction(action);
      break;

    case 'product_card':
      accumulatedCards.push(event.data);
      break;

    case 'telemetry':
      store.setTelemetry(event.data as unknown as TelemetryMetrics);
      break;

    case 'done':
      store.finalizeMessage(
        { provider: event.data.provider as string, latencyMs: event.data.latencyMs as number },
        accumulatedActions,
        accumulatedCards,
      );
      break;

    case 'error':
      console.error('AI Stream Error:', event.data.message);
      store.finalizeMessage();
      break;
  }
}

export async function checkHealth(): Promise<{ status: string; providers: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
