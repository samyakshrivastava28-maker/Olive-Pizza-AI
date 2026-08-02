import axios from 'axios';
import { env } from '../../config/env';
import { SPEECH_MODELS } from '../../config/modelsConfig';

export interface TranscriptionResult {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
  isFallback: boolean;
  confidence?: number;
}

export interface SpeechSynthesisResult {
  audioBuffer?: Buffer;
  audioBase64?: string;
  format: 'mp3' | 'wav' | 'browser_fallback';
  provider: string;
  latencyMs: number;
}

// ─── Speech-to-Text (STT) Service ─────────────────────────────────────────────
export async function transcribeAudio(
  audioBase64OrBuffer: string | Buffer,
  contentType: string = 'audio/wav',
): Promise<TranscriptionResult> {
  const startTime = Date.now();

  // Strip data URI prefixes if passed from browser MediaRecorder
  let audioBuffer: Buffer;
  if (typeof audioBase64OrBuffer === 'string') {
    const cleanBase64 = audioBase64OrBuffer.replace(/^data:audio\/[a-zA-Z0-9.-]+;base64,/, '');
    audioBuffer = Buffer.from(cleanBase64, 'base64');
  } else {
    audioBuffer = audioBase64OrBuffer;
  }

  // 1. Primary: NVIDIA Whisper Large V3
  if (SPEECH_MODELS.stt.primary.apiKey && audioBuffer.length > 0) {
    try {
      const form = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: contentType });
      form.append('file', blob, 'audio.wav');
      form.append('model', SPEECH_MODELS.stt.primary.modelName);
      form.append('language', 'en');

      const res = await axios.post(
        SPEECH_MODELS.stt.primary.endpoint,
        form,
        {
          headers: {
            Authorization: `Bearer ${SPEECH_MODELS.stt.primary.apiKey}`,
          },
          timeout: 10000,
        },
      );

      if (res.data?.text) {
        return {
          text: res.data.text.trim(),
          provider: 'nvidia',
          model: SPEECH_MODELS.stt.primary.modelName,
          latencyMs: Date.now() - startTime,
          isFallback: false,
          confidence: 0.98,
        };
      }
    } catch (err) {
      console.warn('⚠️ Primary NVIDIA Whisper failed, trying Canary fallback:', (err as Error).message);
    }
  }

  // 2. Fallback: NVIDIA Canary
  if (SPEECH_MODELS.stt.fallback.apiKey && audioBuffer.length > 0) {
    try {
      const form = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: contentType });
      form.append('file', blob, 'audio.wav');
      form.append('model', SPEECH_MODELS.stt.fallback.modelName);

      const res = await axios.post(
        SPEECH_MODELS.stt.fallback.endpoint,
        form,
        {
          headers: {
            Authorization: `Bearer ${SPEECH_MODELS.stt.fallback.apiKey}`,
          },
          timeout: 10000,
        },
      );

      if (res.data?.text) {
        return {
          text: res.data.text.trim(),
          provider: 'nvidia',
          model: SPEECH_MODELS.stt.fallback.modelName,
          latencyMs: Date.now() - startTime,
          isFallback: true,
          confidence: 0.92,
        };
      }
    } catch (err) {
      console.warn('⚠️ NVIDIA Canary STT failed:', (err as Error).message);
    }
  }

  // 3. Last fallback: Instruct client to use Browser Web Speech API
  return {
    text: '',
    provider: 'browser_web_speech',
    model: 'webkitSpeechRecognition',
    latencyMs: Date.now() - startTime,
    isFallback: true,
    confidence: 0.85,
  };
}

// ─── Text-to-Speech (TTS) Service ─────────────────────────────────────────────
export async function synthesizeSpeech(
  text: string,
  voice: string = 'alloy',
): Promise<SpeechSynthesisResult> {
  const startTime = Date.now();

  if (SPEECH_MODELS.tts.primary.apiKey) {
    try {
      const res = await axios.post(
        SPEECH_MODELS.tts.primary.endpoint,
        {
          model: SPEECH_MODELS.tts.primary.modelName,
          input: text,
          voice,
          response_format: 'mp3',
        },
        {
          headers: {
            Authorization: `Bearer ${SPEECH_MODELS.tts.primary.apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 8000,
        },
      );

      const buffer = Buffer.from(res.data);
      return {
        audioBuffer: buffer,
        audioBase64: buffer.toString('base64'),
        format: 'mp3',
        provider: 'nvidia',
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      console.warn('⚠️ NVIDIA TTS failed, instructing client to use browser synthesis:', (err as Error).message);
    }
  }

  return {
    format: 'browser_fallback',
    provider: 'browser_speech_synthesis',
    latencyMs: Date.now() - startTime,
  };
}
