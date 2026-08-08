import { Router } from 'express';
import {
  handleChatStream,
  handleDirectAction,
  handleContextSync,
  handleGetMenu,
  handleGetRecommendations,
  handleHomepageRecommendations,
  handleDashboardRecommendations,
  handleEventWebhook,
  handleGetModelStatus,
  handleSpeechSTT,
  handleSpeechTTS,
  handleInstantKnowledgeIngest,
  handleKnowledgeSync,
  handleHealthCheck,
  handleGetMetrics,
  handleGetFullDashboard,
  handleGetAlerts,
  handleTestAlert,
  handleGenerateSDUI,
  handlePublishSDUI,
  handleGenerateImage,
  handleApproveImage,
  handleEnhancePrompt,
  handleEnhanceImagePrompt,
  handleGenerateEmail,
  handleExplainAnalytics,
  handleGetToolRegistry,
  handleDownloadR2Knowledge,
} from '../controllers/chatController';
import { getHealth, receiveHeartbeat, receiveSelfKeepAlive } from '../controllers/healthController';
import { promptInjectionGuard } from '../middleware/auth';

export const apiRouter = Router();

// ── Official AI Gateway Endpoints ─────────────────────────────────────────────

// 0. Health & Telemetry
apiRouter.get('/health', getHealth);
apiRouter.get('/ai/health', handleHealthCheck);
apiRouter.post('/internal/heartbeat', receiveHeartbeat);
apiRouter.post('/internal/keep-alive', receiveSelfKeepAlive);

// 1. Chat Stream (SSE) with Multi-LLM Intent Routing
apiRouter.post('/chat', promptInjectionGuard, handleChatStream);
apiRouter.post('/ai/chat', promptInjectionGuard, handleChatStream);

// 2. Tool Execution Gateway (All Actions)
apiRouter.post('/ai/action', handleDirectAction);
apiRouter.post('/action', handleDirectAction);

// 3. Live Context Synchronization
apiRouter.post('/ai/context', handleContextSync);
apiRouter.post('/context', handleContextSync);

// 4. Live Menu & Search
apiRouter.get('/ai/menu', handleGetMenu);
apiRouter.get('/menu', handleGetMenu);

// 5. Live Multi-Surface Recommendations
apiRouter.get('/ai/recommendations', handleGetRecommendations);
apiRouter.post('/ai/recommendations', handleGetRecommendations);
apiRouter.post('/recommendations', handleGetRecommendations);

// Homepage & Dashboard AI Recommendations
apiRouter.get('/ai/recommendations/homepage', handleHomepageRecommendations);
apiRouter.post('/ai/recommendations/homepage', handleHomepageRecommendations);
apiRouter.get('/ai/recommendations/dashboard', handleDashboardRecommendations);
apiRouter.post('/ai/recommendations/dashboard', handleDashboardRecommendations);

// 6. Event-Driven Webhook Bus
apiRouter.post('/ai/events', handleEventWebhook);
apiRouter.post('/events', handleEventWebhook);

// 7. Multi-LLM Model Orchestrator Status
apiRouter.get('/ai/models/status', handleGetModelStatus);
apiRouter.get('/models/status', handleGetModelStatus);

// 8. Speech Recognition (STT) & Speech Synthesis (TTS)
apiRouter.post('/ai/speech/stt', handleSpeechSTT);
apiRouter.post('/speech/stt', handleSpeechSTT);
apiRouter.post('/ai/speech/tts', handleSpeechTTS);
apiRouter.post('/speech/tts', handleSpeechTTS);

// 9. Instant Knowledge Ingest & Synchronization (R2 Download + Memory Index)
apiRouter.post('/ai/knowledge/ingest', handleInstantKnowledgeIngest);
apiRouter.post('/knowledge/sync', handleKnowledgeSync);
apiRouter.post('/ai/knowledge/sync', handleKnowledgeSync);
apiRouter.get('/ai/knowledge/download', handleDownloadR2Knowledge);
apiRouter.post('/ai/knowledge/download', handleDownloadR2Knowledge);

// 10. SDUI Designer (Google Stitch Pipeline)
apiRouter.post('/ai/sdui/generate', handleGenerateSDUI);
apiRouter.post('/ai/sdui/publish', handlePublishSDUI);

// 11. Image Generation Gateway (Preview -> Owner Approve -> Cloudinary)
apiRouter.post('/ai/image/generate', handleGenerateImage);
apiRouter.post('/ai/image/approve', handleApproveImage);

// 12. Prompt Enhancer & Image Prompt Enhancer
apiRouter.post('/ai/prompt/enhance', handleEnhancePrompt);
apiRouter.post('/ai/image-prompt/enhance', handleEnhanceImagePrompt);

// 13. Specialized AI Capabilities (Email AI, Analytics Explanation)
apiRouter.post('/ai/email/generate', handleGenerateEmail);
apiRouter.post('/ai/analytics/explain', handleExplainAnalytics);

// 14. Dynamic Tool Registry Endpoint
apiRouter.get('/ai/tools/registry', handleGetToolRegistry);

// 15. Telemetry, Metrics & Developer Dashboard
apiRouter.get('/ai/telemetry/dashboard', handleGetFullDashboard);
apiRouter.get('/telemetry/dashboard', handleGetFullDashboard);
apiRouter.get('/telemetry/:sessionId', handleGetMetrics);
apiRouter.get('/ai/telemetry/:sessionId', handleGetMetrics);

// 16. Connection Heartbeat & Diagnostics
apiRouter.get('/health', handleHealthCheck);
apiRouter.get('/ai/health', handleHealthCheck);

// 17. Email Alerting & Diagnostics
apiRouter.get('/ai/alerts', handleGetAlerts);
apiRouter.post('/ai/test-alert', handleTestAlert);

