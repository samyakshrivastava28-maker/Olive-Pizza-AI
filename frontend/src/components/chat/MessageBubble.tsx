import { motion, AnimatePresence } from 'framer-motion';
import { OvenLoader } from '../oven/OvenLoader';
import type { ChatMessage as ChatMessageType } from '../../store/chatStore';
import { useChatStore } from '../../store/chatStore';
import { ProductCardItem } from './ProductCardItem';

interface MessageBubbleProps {
  message: ChatMessageType;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Clean raw tags for display
function cleanMessageContent(raw: string): string {
  return raw
    .replace(/<action>[\s\S]*?<\/action>/g, '')
    .replace(/<action>[\s\S]*$/g, '')
    .replace(/<product_card>[\s\S]*?<\/product_card>/g, '')
    .replace(/<product_card>[\s\S]*$/g, '')
    .trim();
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const executeAction = useChatStore((s) => s.executeAction);

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, maxWidth: '72%' }}>
          <div className="bubble-user">
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{message.content}</p>
          </div>
          <span className="font-mono-label" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            {formatTime(message.timestamp)}
          </span>
        </div>
      </motion.div>
    );
  }

  // AI message
  const displayContent = cleanMessageContent(message.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ display: 'flex', gap: 10, marginBottom: 4, maxWidth: '82%' }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(124,111,247,0.15)',
          border: '1px solid rgba(124,111,247,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 4,
          fontSize: 16,
        }}
      >
        🍕
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <div className="bubble-ai">
          {message.isStreaming && !displayContent ? (
            <div style={{ display: 'flex', gap: 5, padding: '4px 0' }}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          ) : (
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: 'var(--text-primary)',
              }}
            >
              <SimpleMarkdown text={displayContent} />
              {message.isStreaming && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  style={{
                    display: 'inline-block',
                    width: 2,
                    height: 14,
                    background: 'var(--accent-purple)',
                    borderRadius: 1,
                    marginLeft: 2,
                    verticalAlign: 'middle',
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Product Cards (if any) */}
        {message.productCards && message.productCards.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {message.productCards.map((card, i) => (
              <ProductCardItem
                key={i}
                product={{
                  id: card.productId,
                  name: 'Truffle Mushroom Artisan Pizza',
                  description: 'Wild forest mushrooms, black truffle oil, fresh fior di latte mozzarella on 48h sourdough.',
                  price: 499,
                  originalPrice: 599,
                  isVeg: true,
                  rating: 4.9,
                  reviewsCount: 128,
                  prepTime: '15-20 min',
                  spicyLevel: 1,
                }}
              />
            ))}
          </div>
        )}

        {/* Actions row */}
        {message.actions && message.actions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 2, marginTop: 2 }}>
            {message.actions.map((action, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => executeAction(action)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  background: 'rgba(124,111,247,0.12)',
                  border: '1px solid rgba(124,111,247,0.25)',
                  color: '#c6c0ff',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>⚡</span>
                <span>{action.description || action.type?.replace(/_/g, ' ') || 'Action'}</span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Actions & TTS Speaker Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, paddingLeft: 2 }}>
          {/* TTS Speaker Button (Requirement 13) */}
          <MessageSpeakerButton messageId={message.id} text={displayContent} isStreaming={message.isStreaming} />

          {/* Metadata */}
          {message.metadata?.provider && (
            <span className="font-mono-label" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              {formatTime(message.timestamp)} · {message.metadata.provider}
              {message.metadata.latencyMs ? ` · ${message.metadata.latencyMs}ms` : ''}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Global Audio Singleton for Single Audio Stream ──────────────────────────
let activeAudio: HTMLAudioElement | null = null;

function stopGlobalAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ── TTS Speaker Component for Message Bubbles ────────────────────────────────
import { useState, useEffect } from 'react';

function MessageSpeakerButton({ messageId, text, isStreaming }: { messageId: string; text: string; isStreaming?: boolean }) {
  const currentlyPlayingId = useChatStore((s) => s.currentlyPlayingAudioId);
  const setCurrentlyPlaying = useChatStore((s) => s.setCurrentlyPlayingAudioId);
  const isAutoVoiceEnabled = useChatStore((s) => s.isAutoVoiceEnabled);
  const voiceOptions = useChatStore((s) => s.voiceOptions);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isCurrentMessagePlaying = currentlyPlayingId === messageId;

  // Auto Voice Output Trigger for newly finished AI responses (Requirement 14 & 15)
  useEffect(() => {
    if (!isStreaming && isAutoVoiceEnabled && text && text.trim().length > 0 && !isCurrentMessagePlaying) {
      // Check if message was generated recently (within 5 seconds) to avoid playing old history
      handlePlayTTS();
    }
  }, [isStreaming]);

  const handlePlayTTS = async () => {
    if (isStreaming || !text || text.trim().length === 0) return;

    if (isCurrentMessagePlaying) {
      if (activeAudio) {
        if (activeAudio.paused) {
          activeAudio.play();
          setIsPaused(false);
          setIsPlaying(true);
        } else {
          activeAudio.pause();
          setIsPaused(true);
          setIsPlaying(false);
        }
        return;
      }
    }

    // Stop any previously playing audio
    stopGlobalAudio();
    setCurrentlyPlaying(messageId);
    setIsLoading(true);
    setIsPlaying(false);
    setIsPaused(false);

    try {
      // Request TTS from server (Chatterbox Multilingual / NVIDIA FastPitch)
      const res = await fetch('/api/ai/speech/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.slice(0, 500),
          voice: voiceOptions.voice,
          language: voiceOptions.language,
          speed: voiceOptions.speed,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
          activeAudio = audio;
          audio.onended = () => {
            setCurrentlyPlaying(null);
            setIsPlaying(false);
            setIsPaused(false);
            activeAudio = null;
          };
          audio.onerror = () => {
            fallbackBrowserSpeech(text);
          };
          await audio.play();
          setIsLoading(false);
          setIsPlaying(true);
          return;
        }
      }
      fallbackBrowserSpeech(text);
    } catch {
      fallbackBrowserSpeech(text);
    } finally {
      setIsLoading(false);
    }
  };

  const fallbackBrowserSpeech = (speechText: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setCurrentlyPlaying(null);
      setIsPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText.slice(0, 300));
    utterance.rate = voiceOptions.speed || 1.0;
    utterance.onend = () => {
      setCurrentlyPlaying(null);
      setIsPlaying(false);
    };
    utterance.onerror = () => {
      setCurrentlyPlaying(null);
      setIsPlaying(false);
    };
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={handlePlayTTS}
      disabled={isStreaming || isLoading}
      title={isCurrentMessagePlaying && isPlaying ? 'Pause voice' : 'Play response voice'}
      style={{
        background: isCurrentMessagePlaying ? 'rgba(124,111,247,0.25)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isCurrentMessagePlaying ? 'rgba(124,111,247,0.4)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '50%',
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        cursor: isStreaming ? 'not-allowed' : 'pointer',
        color: 'var(--text-primary)',
        transition: 'all 0.2s',
      }}
    >
      {isLoading ? '⏳' : isCurrentMessagePlaying && isPlaying ? '⏸️' : isCurrentMessagePlaying && isPaused ? '▶️' : '🔊'}
    </motion.button>
  );
}

// ── AI Thinking State ────────────────────────────────────────────────────────
export function ThinkingBubble({ stage, label }: { stage: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{ display: 'flex', gap: 10, maxWidth: '80%' }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(124,111,247,0.15)',
          border: '1px solid rgba(124,111,247,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 4,
          fontSize: 16,
        }}
      >
        🍕
      </div>
      <div className="bubble-ai" style={{ minWidth: 220 }}>
        <OvenLoader stage={stage} label={label} />
      </div>
    </motion.div>
  );
}

// ── Simple Markdown Renderer ──────────────────────────────────────────────────
function SimpleMarkdown({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              style={{
                background: 'rgba(124,111,247,0.12)',
                padding: '1px 5px',
                borderRadius: 4,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                color: '#c6c0ff',
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part === '\n') return <br key={i} />;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
