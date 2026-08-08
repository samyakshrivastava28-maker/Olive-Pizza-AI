import { useRef, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { streamChat } from '../../services/chatApi';

interface SuggestionItem {
  icon: string;
  text: string;
}

interface ChatInputProps {
  suggestions: SuggestionItem[];
}

export function ChatInput({ suggestions }: ChatInputProps) {
  const { inputValue, setInputValue, messages, sessionId, websiteContext, isThinking, isVoiceActive, setVoiceActive } =
    useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [inputValue]);

  const handleSubmit = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || isThinking || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const allMessages = [
        ...messages.map((m) => ({ ...m })),
        { id: 'pending', role: 'user' as const, content, timestamp: Date.now() },
      ];
      await streamChat(allMessages, sessionId, websiteContext as Record<string, unknown>);
    } catch (err) {
      console.error('Chat error:', err);
      useChatStore.getState().clearError();
    } finally {
      setIsSubmitting(false);
    }
  }, [inputValue, isThinking, isSubmitting, messages, sessionId, websiteContext]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Voice STT
  const handleVoiceToggle = useCallback(() => {
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isVoiceActive) {
      recognitionRef.current?.stop();
      setVoiceActive(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setInputValue(transcript);
    };

    recognition.onend = () => {
      setVoiceActive(false);
    };

    recognition.onerror = () => {
      setVoiceActive(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setVoiceActive(true);
  }, [isVoiceActive, setVoiceActive, setInputValue]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 24px 24px',
        background: 'linear-gradient(to top, var(--bg-base) 70%, transparent)',
      }}
    >
      {/* Suggestion chips */}
      <AnimatePresence>
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 10,
              paddingRight: 4,
            }}
          >
            {suggestions.map((s) => (
              <motion.button
                key={s.text}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="suggestion-chip"
                onClick={() => setInputValue(s.text)}
              >
                <span>{s.icon}</span>
                <span>{s.text}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="chat-input-bar" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, padding: '6px 8px' }}>
        {/* Voice STT button (Requirement 9) */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          className={`btn-icon ${isVoiceActive ? 'voice-active' : ''}`}
          onClick={handleVoiceToggle}
          title={isVoiceActive ? 'Stop listening (click to cancel)' : 'Start voice input (speak in Hindi or English)'}
          style={{
            flexShrink: 0,
            fontSize: 18,
            marginBottom: 4,
            border: isVoiceActive ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid transparent',
            background: isVoiceActive ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
            borderRadius: 10,
            transition: 'all 0.2s',
          }}
        >
          {isVoiceActive ? '🔴' : '🎤'}
        </motion.button>

        {/* Auto Voice Output Toggle Button (Requirement 14) */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => useChatStore.getState().setAutoVoiceEnabled(!useChatStore.getState().isAutoVoiceEnabled)}
          title="Toggle Automatic Voice Output for new AI responses"
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 500,
            fontFamily: 'JetBrains Mono, monospace',
            marginBottom: 4,
            padding: '4px 8px',
            border: useChatStore((s) => s.isAutoVoiceEnabled)
              ? '1px solid rgba(124, 111, 247, 0.5)'
              : '1px solid rgba(255, 255, 255, 0.1)',
            background: useChatStore((s) => s.isAutoVoiceEnabled)
              ? 'rgba(124, 111, 247, 0.2)'
              : 'rgba(0, 0, 0, 0.2)',
            color: useChatStore((s) => s.isAutoVoiceEnabled) ? '#c6c0ff' : 'var(--text-muted)',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.2s',
          }}
        >
          <span>{useChatStore((s) => s.isAutoVoiceEnabled) ? '🔊' : '🔈'}</span>
          <span>{useChatStore((s) => s.isAutoVoiceEnabled) ? 'Auto Voice: ON' : 'Auto Voice: OFF'}</span>
        </motion.button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Olive anything…"
          rows={1}
          disabled={isThinking}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'none',
            fontFamily: 'Inter, sans-serif',
            padding: '10px 8px',
            maxHeight: 140,
            overflowY: 'auto',
          }}
        />

        {/* Send button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!inputValue.trim() || isThinking}
          style={{
            flexShrink: 0,
            minWidth: 42,
            height: 42,
            padding: '0 14px',
            marginBottom: 2,
            opacity: !inputValue.trim() || isThinking ? 0.4 : 1,
            cursor: !inputValue.trim() || isThinking ? 'not-allowed' : 'pointer',
            fontSize: 18,
          }}
        >
          {isThinking ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-block', fontSize: 14 }}
            >
              ⏳
            </motion.span>
          ) : (
            '↑'
          )}
        </motion.button>
      </div>

      {/* Bottom hint */}
      <p
        className="font-mono-label"
        style={{
          textAlign: 'center',
          color: 'rgba(255,255,255,0.2)',
          marginTop: 8,
          fontSize: 10,
          letterSpacing: '0.08em',
        }}
      >
        OLIVE AI V2 · RETRIEVAL-FIRST · PRESS ENTER TO SEND
      </p>
    </div>
  );
}
