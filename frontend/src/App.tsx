import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './components/chat/Sidebar';
import { ChatContainer } from './components/chat/ChatContainer';
import { TelemetryPanel } from './components/dashboard/TelemetryPanel';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Full-screen dark layout */}
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
        <ChatContainer />

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
