import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { apiRouter } from './routes/chatRoutes';
import { requestLogger } from './middleware/auth';

const app = express();

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        env.CORS_ORIGIN,
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:3050',
        'http://localhost:3000',
        'https://olive-pizza.vercel.app',
      ];
      
      // Allow any Vercel deployment dynamically
      if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Olive-SDK-Version', 'X-Request-ID', 'X-API-Key'],
    credentials: true,
  }),
);

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// ── Rate limiting ──────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api', limiter);

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── Root ───────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'Olive AI Assistant API Gateway',
    version: '2.0.0',
    status: 'online',
    sdk: '@olive-ai/sdk v2.0.0',
    targetClient: 'https://olive-pizza.vercel.app',
    docs: '/api/health',
  });
});

// ── Error handler ──────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('💥 Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

import { knowledgeSyncService } from './services/ai/knowledgeSyncService';
import { localKnowledgeEngine } from './services/retrieval/localKnowledgeEngine';
import { validateStartup } from './utils/startupValidator';
import { SelfKeepAliveJob } from './jobs/SelfKeepAliveJob';

// ── Global Error Handlers ──────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('💥 [Uncaught Exception] Shutting down gracefully...', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [Unhandled Rejection] at:', promise, 'reason:', reason);
  // Do not exit immediately, but log it critically
});

// ── Start ──────────────────────────────────────────────────────────────────────
const server = app.listen(env.PORT, async () => {
  validateStartup();

  console.log(`
🍕 Olive AI Assistant V2 API Gateway
──────────────────────────────────────────
  Port         : ${env.PORT}
  Env          : ${env.NODE_ENV}
  CORS Allowed : ${env.CORS_ORIGIN}, https://olive-pizza.vercel.app
  SDK Version  : @olive-ai/sdk v2.0.0
──────────────────────────────────────────
  `);

  // Load JSON Knowledge Repository into Memory
  await localKnowledgeEngine.loadAll();

  // Start background live sync
  knowledgeSyncService.startSync();

  // Start Self-Pinging Keep-Alive Job
  SelfKeepAliveJob.schedule();
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────────
function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Closing HTTP server...`);
  server.close(() => {
    console.log('✅ HTTP server closed.');
    knowledgeSyncService.stopSync();
    process.exit(0);
  });

  // Force close if it takes too long
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
