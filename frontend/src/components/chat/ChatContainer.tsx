import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { MessageBubble, ThinkingBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';

const SUGGESTIONS = [
  { icon: '🍕', text: 'What pizzas do you have?' },
  { icon: '🎁', text: 'Show me today\'s offers' },
  { icon: '📦', text: 'Track my order' },
  { icon: '🥦', text: 'Vegetarian options' },
  { icon: '🔥', text: 'Most popular items' },
];

export function ChatContainer() {
  const { messages, isThinking, thinkingStage, thinkingLabel, isSidebarOpen, isTelemetryOpen } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(true);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Hide welcome on first message
  useEffect(() => {
    if (messages.length > 0) setShowWelcome(false);
  }, [messages.length]);

  const handleSuggestion = useCallback((text: string) => {
    useChatStore.getState().setInputValue(text);
  }, []);

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        marginLeft: isSidebarOpen ? 280 : 0,
        marginRight: isTelemetryOpen ? 300 : 0,
        transition: 'margin 0.3s ease',
        background: 'var(--bg-base)',
      }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <TopBar />

      {/* ── Ambient Glow ────────────────────────────────────────────── */}
      <div
        className="ambient-glow"
        style={{
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 500,
          height: 300,
          background: 'var(--accent-purple)',
        }}
      />

      {/* ── Messages Area ───────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingBottom: 180,
        }}
      >
        {/* Welcome state */}
        <AnimatePresence>
          {showWelcome && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                gap: 16,
                paddingTop: 60,
                textAlign: 'center',
              }}
            >
              {/* Logo mark */}
              <motion.div
                animate={{ rotate: [0, 3, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ fontSize: 56, lineHeight: 1 }}
              >
                🍕
              </motion.div>
              <div>
                <h2
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                    marginBottom: 8,
                  }}
                >
                  Good evening. I'm{' '}
                  <span style={{ color: 'var(--accent-purple)' }}>Olive</span>.
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 360 }}>
                  Your AI concierge for Olive Pizza. Ask me anything — from menu recommendations to placing your order.
                </p>
              </div>

              {/* Suggestion chips in welcome */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <motion.button
                    key={s.text}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="suggestion-chip"
                    onClick={() => handleSuggestion(s.text)}
                  >
                    <span>{s.icon}</span>
                    <span>{s.text}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Date separator */}
        {messages.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <span
              className="font-mono-label"
              style={{
                color: 'rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '3px 12px',
                borderRadius: 99,
                fontSize: 10,
              }}
            >
              TODAY
            </span>
          </div>
        )}

        {/* Message list */}
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>

        {/* Thinking oven */}
        <AnimatePresence>
          {isThinking && thinkingStage && (
            <ThinkingBubble stage={thinkingStage} label={thinkingLabel} />
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* ── Input Area ──────────────────────────────────────────────── */}
      <ChatInput suggestions={SUGGESTIONS} />
    </main>
  );
}

// ── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar() {
  const { toggleTelemetry, toggleSidebar } = useChatStore();

  return (
    <header
      className="glass"
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn-icon" onClick={toggleSidebar} title="Toggle sidebar" style={{ color: 'var(--text-secondary)' }}>
          ☰
        </button>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          Olive AI
          {/* Online dot */}
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <span
              style={{
                position: 'absolute',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--accent-green)',
                animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                opacity: 0.6,
              }}
            />
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--accent-green)',
                boxShadow: '0 0 8px rgba(34,197,94,0.6)',
              }}
            />
          </span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          className="btn-icon"
          onClick={toggleTelemetry}
          title="Toggle telemetry"
          style={{ fontSize: 16, color: 'var(--text-secondary)' }}
        >
          📊
        </button>
        <button className="btn-icon" title="Settings" style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
          ⚙️
        </button>
      </div>
    </header>
  );
}
