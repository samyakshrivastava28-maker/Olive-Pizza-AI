import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';

const OLIVE_PIZZA_URL = import.meta.env.VITE_OLIVE_PIZZA_URL || 'https://olive-pizza.vercel.app';

// Developer whitelist
const DEVELOPER_EMAILS = ['webhub2811@gmail.com', 'olivepizzarjn@gmail.com'];

interface WebsitePanelProps {
  onClose: () => void;
}

export function WebsitePanel({ onClose }: WebsitePanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { websiteContext } = useChatStore();
  const [currentUrl, setCurrentUrl] = useState(OLIVE_PIZZA_URL);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLog, setActionLog] = useState<string[]>([]);

  const isDeveloper = DEVELOPER_EMAILS.includes(websiteContext?.userEmail || '');

  // Listen for AI actions and apply them to the iframe
  useEffect(() => {
    const handleAIAction = (e: CustomEvent) => {
      const action = e.detail;
      if (!action) return;

      const normType = String(action.type).toUpperCase();
      let logMsg = '';

      if (normType === 'NAVIGATE_PAGE') {
        const path = String(action.payload?.url || action.payload?.page || '/');
        const newUrl = `${OLIVE_PIZZA_URL}${path}`;
        setCurrentUrl(newUrl);
        setIsLoading(true);
        logMsg = `🧭 Navigating to ${path}`;
      } else if (normType === 'OPEN_CATEGORY') {
        const category = String(action.payload?.category || '');
        const newUrl = `${OLIVE_PIZZA_URL}/menu?category=${encodeURIComponent(category)}`;
        setCurrentUrl(newUrl);
        setIsLoading(true);
        logMsg = `📂 Opening category: ${category}`;
      } else if (normType === 'OPEN_PRODUCT') {
        const productId = String(action.payload?.productId || '');
        const newUrl = `${OLIVE_PIZZA_URL}/product/${productId}`;
        setCurrentUrl(newUrl);
        setIsLoading(true);
        logMsg = `🍕 Opening product: ${productId}`;
      } else if (normType === 'SEARCH_MENU') {
        const query = String(action.payload?.query || '');
        const newUrl = `${OLIVE_PIZZA_URL}/menu?q=${encodeURIComponent(query)}`;
        setCurrentUrl(newUrl);
        setIsLoading(true);
        logMsg = `🔍 Searching: ${query}`;
      } else if (['ADD_TO_CART', 'APPLY_COUPON', 'REMOVE_COUPON', 'UPDATE_QUANTITY'].includes(normType)) {
        // Forward cart actions to iframe via postMessage
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'OLIVE_AI_ACTION', payload: action },
          OLIVE_PIZZA_URL
        );
        logMsg = `🛒 ${action.description || normType}`;
      }

      if (logMsg) {
        setActionLog(prev => [logMsg, ...prev].slice(0, 5));
      }
    };

    window.addEventListener('olive-ai-action', handleAIAction as EventListener);
    return () => window.removeEventListener('olive-ai-action', handleAIAction as EventListener);
  }, []);

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
      }}
    >
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(18,16,26,0.95)',
        gap: 12,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {/* Status dot */}
          {isLoading ? (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block', flexShrink: 0 }} />
          ) : (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block', flexShrink: 0 }} />
          )}
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
            🍕 Olive Pizza
          </span>
          <span style={{ 
            color: 'rgba(255,255,255,0.3)', 
            fontSize: 11, 
            fontFamily: 'monospace', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0
          }}>
            {currentUrl.replace(OLIVE_PIZZA_URL, '')}
          </span>
        </div>

        {/* Action Log (last action taken) */}
        {actionLog.length > 0 && (
          <span style={{
            fontSize: 11,
            color: '#A78BFA',
            fontFamily: 'Inter, sans-serif',
            flexShrink: 0,
            background: 'rgba(167,139,250,0.1)',
            borderRadius: 6,
            padding: '2px 8px',
          }}>
            {actionLog[0]}
          </span>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: 'none',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            padding: '4px 10px',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 44,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #7C3AED, #A78BFA)',
          zIndex: 10,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}

      {/* Developer action log (only visible to devs) */}
      {isDeveloper && actionLog.length > 0 && (
        <div style={{
          padding: '4px 16px',
          background: 'rgba(124,58,237,0.08)',
          borderBottom: '1px solid rgba(124,58,237,0.15)',
          flexShrink: 0,
        }}>
          {actionLog.map((log, i) => (
            <p key={i} style={{ margin: 0, fontSize: 10, color: 'rgba(167,139,250,0.7)', fontFamily: 'monospace' }}>
              {log}
            </p>
          ))}
        </div>
      )}

      {/* The Live Website iframe */}
      <iframe
        ref={iframeRef}
        src={currentUrl}
        id="olive-pizza-frame"
        title="Olive Pizza"
        onLoad={() => setIsLoading(false)}
        style={{
          flex: 1,
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
        }}
        allow="payment *"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </motion.div>
  );
}
