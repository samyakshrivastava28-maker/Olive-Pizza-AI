import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';

const CHAT_HISTORY_SAMPLE = [
  { icon: '💬', text: 'Spicy BBQ order' },
  { icon: '🍕', text: 'Margherita customization' },
  { icon: '📦', text: 'Order #2847 tracking' },
];

export function Sidebar() {
  const { isSidebarOpen, conversations, startNewConversation, loadConversation, activeConversationId } = useChatStore();

  return (
    <AnimatePresence>
      {isSidebarOpen && (
        <motion.nav
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -280, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 35 }}
          className="glass-sidebar"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            width: 280,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 12px',
            gap: 6,
            zIndex: 40,
            overflowY: 'auto',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 16px' }}>
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-purple-dark))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
                boxShadow: '0 4px 15px rgba(124,111,247,0.3)',
              }}
            >
              🍕
            </motion.div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Olive AI
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Culinary Intelligence</p>
            </div>
          </div>

          {/* New Chat */}
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary"
            onClick={startNewConversation}
            style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
          >
            <span>+</span>
            <span>New Chat</span>
          </motion.button>

          <hr className="divider" />

          {/* Conversation history */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length > 0 ? (
              <>
                <p
                  className="font-mono-label"
                  style={{ color: 'var(--text-muted)', padding: '4px 8px 6px', fontSize: 10, letterSpacing: '0.08em' }}
                >
                  RECENT
                </p>
                {conversations.map((conv) => (
                  <motion.button
                    key={conv.id}
                    whileHover={{ x: 2 }}
                    className={`sidebar-item ${activeConversationId === conv.id ? 'active' : ''}`}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <span style={{ fontSize: 14 }}>💬</span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {conv.title}
                    </span>
                  </motion.button>
                ))}
              </>
            ) : (
              <>
                <p
                  className="font-mono-label"
                  style={{ color: 'var(--text-muted)', padding: '4px 8px 6px', fontSize: 10, letterSpacing: '0.08em' }}
                >
                  EXAMPLES
                </p>
                {CHAT_HISTORY_SAMPLE.map((item) => (
                  <button
                    key={item.text}
                    className="sidebar-item"
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
                  >
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.text}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>

          <hr className="divider" />

          {/* Bottom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-purple), #22C55E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              👤
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Guest</p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>olive-ai-v2</p>
            </div>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
