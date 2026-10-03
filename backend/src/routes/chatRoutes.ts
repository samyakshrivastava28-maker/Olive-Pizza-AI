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
import {
  promptInjectionGuard,
  optionalAuth,
  requireAuth,
  requireRole,
  requireService,
  ROLE_GROUPS,
} from '../middleware/auth';

export const apiRouter = Router();

const contentStaff = requireRole(ROLE_GROUPS.CONTENT_STAFF);
const publishers = requireRole(ROLE_GROUPS.PUBLISHERS);
const knowledgeAdmins = requireRole(ROLE_GROUPS.KNOWLEDGE_ADMINS);
const diagnostics = requireRole(ROLE_GROUPS.DIAGNOSTICS);

// ── Access matrix ─────────────────────────────────────────────────────────────
//  PUBLIC (optional valid identity) : chat, menu, recommendations, speech, health(minimal), context
//  AUTHENTICATED USER               : action gateway (Main Backend re-verifies + authorizes every business action)
//  SERVICE (HMAC, Main Backend)     : events webhook, internal heartbeat/keep-alive (own HMAC)
//  CONTENT STAFF                    : knowledge, SDUI/image/email generation, prompt tooling
//  PUBLISHERS                       : SDUI publish, image approve
//  DIAGNOSTICS                      : telemetry, alerts, test-alert, models, tool registry

// 0. Health & Telemetry
apiRouter.get('/health', getHealth);
apiRouter.get('/ai/health', handleHealthCheck);
apiRouter.post('/internal/heartbeat', receiveHeartbeat);
apiRouter.post('/internal/keep-alive', receiveSelfKeepAlive);

// 1. Chat Stream (SSE) with Multi-LLM Intent Routing
apiRouter.post('/chat', optionalAuth, promptInjectionGuard, handleChatStream);
apiRouter.post('/ai/chat', optionalAuth, promptInjectionGuard, handleChatStream);

// 2. Tool Execution Gateway (All Actions) — identity mandatory
apiRouter.post('/ai/action', requireAuth, handleDirectAction);
apiRouter.post('/action', requireAuth, handleDirectAction);

// 3. Live Context Synchronization
apiRouter.post('/ai/context', optionalAuth, handleContextSync);
apiRouter.post('/context', optionalAuth, handleContextSync);

// 4. Live Menu & Search
apiRouter.get('/ai/menu', optionalAuth, handleGetMenu);
apiRouter.get('/menu', optionalAuth, handleGetMenu);

// 5. Live Multi-Surface Recommendations
apiRouter.get('/ai/recommendations', optionalAuth, handleGetRecommendations);
apiRouter.post('/ai/recommendations', optionalAuth, handleGetRecommendations);
apiRouter.post('/recommendations', optionalAuth, handleGetRecommendations);

// Homepage & Dashboard AI Recommendations
apiRouter.get('/ai/recommendations/homepage', optionalAuth, handleHomepageRecommendations);
apiRouter.post('/ai/recommendations/homepage', optionalAuth, handleHomepageRecommendations);
apiRouter.get('/ai/recommendations/dashboard', requireAuth, handleDashboardRecommendations);
apiRouter.post('/ai/recommendations/dashboard', requireAuth, handleDashboardRecommendations);

// 6. Event-Driven Webhook Bus — server-to-server only (HMAC)
apiRouter.post('/ai/events', requireService, handleEventWebhook);
apiRouter.post('/events', requireService, handleEventWebhook);

// 7. Multi-LLM Model Orchestrator Status
apiRouter.get('/ai/models/status', diagnostics, handleGetModelStatus);
apiRouter.get('/models/status', diagnostics, handleGetModelStatus);

// 8. Speech Recognition (STT) & Speech Synthesis (TTS)
apiRouter.post('/ai/speech/stt', optionalAuth, handleSpeechSTT);
apiRouter.post('/speech/stt', optionalAuth, handleSpeechSTT);
apiRouter.post('/ai/speech/tts', optionalAuth, handleSpeechTTS);
apiRouter.post('/speech/tts', optionalAuth, handleSpeechTTS);

// 9. Instant Knowledge Ingest & Synchronization (R2 Download + Memory Index)
apiRouter.post('/ai/knowledge/ingest', knowledgeAdmins, handleInstantKnowledgeIngest);
apiRouter.post('/knowledge/sync', knowledgeAdmins, handleKnowledgeSync);
apiRouter.post('/ai/knowledge/sync', knowledgeAdmins, handleKnowledgeSync);
apiRouter.get('/ai/knowledge/download', knowledgeAdmins, handleDownloadR2Knowledge);
apiRouter.post('/ai/knowledge/download', knowledgeAdmins, handleDownloadR2Knowledge);

// 10. SDUI Designer (Google Stitch Pipeline) — generate ≠ publish
apiRouter.post('/ai/sdui/generate', contentStaff, handleGenerateSDUI);
apiRouter.post('/ai/sdui/publish', publishers, handlePublishSDUI);

// 11. Image Generation Gateway (Preview -> Owner Approve -> Cloudinary) — generate ≠ approve
apiRouter.post('/ai/image/generate', contentStaff, handleGenerateImage);
apiRouter.post('/ai/image/approve', publishers, handleApproveImage);

// 12. Prompt Enhancer & Image Prompt Enhancer
apiRouter.post('/ai/prompt/enhance', contentStaff, handleEnhancePrompt);
apiRouter.post('/ai/image-prompt/enhance', contentStaff, handleEnhanceImagePrompt);

// 13. Specialized AI Capabilities (Email AI, Analytics Explanation)
apiRouter.post('/ai/email/generate', contentStaff, handleGenerateEmail);
apiRouter.post('/ai/analytics/explain', contentStaff, handleExplainAnalytics);

// 14. Dynamic Tool Registry Endpoint
apiRouter.get('/ai/tools/registry', diagnostics, handleGetToolRegistry);

// 15. Telemetry, Metrics & Developer Dashboard
apiRouter.get('/ai/telemetry/dashboard', diagnostics, handleGetFullDashboard);
apiRouter.get('/telemetry/dashboard', diagnostics, handleGetFullDashboard);
apiRouter.get('/telemetry/:sessionId', diagnostics, handleGetMetrics);
apiRouter.get('/ai/telemetry/:sessionId', diagnostics, handleGetMetrics);

// 17. Email Alerting & Diagnostics
apiRouter.get('/ai/alerts', diagnostics, handleGetAlerts);
apiRouter.post('/ai/test-alert', diagnostics, handleTestAlert);

