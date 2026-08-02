import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './components/chat/Sidebar';
import { ChatContainer } from './components/chat/ChatContainer';
import { TelemetryPanel } from './components/dashboard/TelemetryPanel';
import { WebsitePanel } from './components/website/WebsitePanel';
import { useEffect, useState } from 'react';
import { useChatStore } from './store/chatStore';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function App() {
  const { setWebsiteContext, websiteContext } = useChatStore();
  const [isWebsitePanelOpen, setIsWebsitePanelOpen] = useState(false);

  useEffect(() => {
    // Listen for auth sync and action results from the main Olive Pizza app
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'OLIVE_AI_AUTH_SYNC') {
        setWebsiteContext({
          isAuthenticated: e.data.payload.isAuthenticated,
          userId: e.data.payload.userId,
          userEmail: e.data.payload.userEmail,
          userName: e.data.payload.userName,
        });
      }
      // Listen for payment success signal from the main app
      if (e.data?.type === 'OLIVE_AI_PAYMENT_SUCCESS') {
        // This would trigger a confirmation message in the chat
        window.dispatchEvent(new CustomEvent('olive-payment-confirmed', {
          detail: e.data.payload
        }));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setWebsiteContext]);

  // Listen for NAVIGATE_PAGE actions to open the website panel automatically
  useEffect(() => {
    const handleOliveAction = (e: CustomEvent) => {
      const action = e.detail;
      if (action?.type === 'NAVIGATE_PAGE' || action?.type === 'OPEN_CATEGORY' || action?.type === 'OPEN_PRODUCT') {
        setIsWebsitePanelOpen(true);
      }
    };
    window.addEventListener('olive-ai-action', handleOliveAction as EventListener);
    return () => window.removeEventListener('olive-ai-action', handleOliveAction as EventListener);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
          background: 'var(--bg-base)',
          position: 'relative',
        }}
      >
        {/* ── Sidebar ─────────────────────────────────────── */}
        <Sidebar />

        {/* ── Main Chat Area ──────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ 
            flex: isWebsitePanelOpen ? '0 0 40%' : '1', 
            overflow: 'hidden',
            transition: 'flex 0.3s ease',
            minWidth: 0
          }}>
            <ChatContainer onOpenWebsite={() => setIsWebsitePanelOpen(true)} />
          </div>

          {/* ── Live Website Panel ─────────────────────────── */}
          {isWebsitePanelOpen && (
            <div style={{ 
              flex: '0 0 60%', 
              overflow: 'hidden', 
              borderLeft: '1px solid rgba(255,255,255,0.06)',
              position: 'relative'
            }}>
              <WebsitePanel onClose={() => setIsWebsitePanelOpen(false)} />
            </div>
          )}
        </div>

        {/* ── Telemetry Panel ─────────────────────────────── */}
        <TelemetryPanel />
      </div>

      {/* ── Toast Notifications ─────────────────────────── */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'rgba(28, 26, 36, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#F1F5F9',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            borderRadius: 12,
            padding: '10px 16px',
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
