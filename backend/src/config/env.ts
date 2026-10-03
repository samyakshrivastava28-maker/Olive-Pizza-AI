import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Walk up directories to find .env
function findEnvFile(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return path.join(process.cwd(), '.env');
}

dotenv.config({ path: findEnvFile() });

const envSchema = z.object({
  // Server
  PORT: z.string().default('3051'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Olive Pizza Backend Single Source of Truth URL
  OLIVE_PIZZA_BACKEND_URL: z.string().default('https://olive-pizza-backend.onrender.app'),

  // AI Keys - Dedicated Assistant
  ASSISTANT_NVIDIA_API_KEY: z.string().default(''),
  ASSISTANT_OPENROUTER_API_KEY: z.string().default(''),
  ASSISTANT_GEMINI_API_KEY: z.string().default(''),

  // Pinecone
  PINECONE_API_KEY: z.string().default(''),
  PINECONE_INDEX_HOST: z.string().default(''),
  PINECONE_INDEX_NAME: z.string().default('olive-pizza-qhdsm46'),

  // Firebase
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().default(''),
  VITE_FIREBASE_PROJECT_ID: z.string().default('olive-pizza-production'),

  // Database & Redis
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // Service-to-service trust (NO defaults — missing secret = HMAC auth fails closed)
  AI_GATEWAY_SECRET: z.string().optional(),
  TRACKING_TOKEN_SECRET: z.string().optional(),
  INTERNAL_SECRET: z.string().optional(),

  // Explicit browser-origin allowlist (comma separated). Wildcard hosts are never accepted.
  ALLOWED_ORIGINS: z.string().default(''),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX: z.string().default('60'),

  // Telemetry
  TELEMETRY_ENABLED: z.string().default('true'),

  // Automatic Email Alerts
  DEVELOPER_EMAIL: z.string().default('webhub2811@gmail.com'),
  OWNER_EMAIL: z.string().default('owner@olivepizza.com'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Production must never boot with missing / placeholder trust secrets.
if (parsed.data.NODE_ENV === 'production') {
  const KNOWN_PLACEHOLDERS = [
    'olive-ai-gateway-secret-change-in-prod',
    'fallback-secret-do-not-use-in-prod',
    'olive-tracking-secret-change-me',
    'olive-ai-jwt-secret-dev-change-in-prod',
  ];
  const requiredProd: Array<[string, string | undefined]> = [
    ['AI_GATEWAY_SECRET', parsed.data.AI_GATEWAY_SECRET],
    ['TRACKING_TOKEN_SECRET', parsed.data.TRACKING_TOKEN_SECRET],
    ['FIREBASE_SERVICE_ACCOUNT_BASE64', parsed.data.FIREBASE_SERVICE_ACCOUNT_BASE64],
  ];
  const problems = requiredProd
    .filter(([, v]) => !v || KNOWN_PLACEHOLDERS.includes(v.trim()) || (v.length < 16))
    .map(([k]) => k);
  if (problems.length > 0) {
    console.error(`❌ CRITICAL PRODUCTION SECURITY ERROR: missing/placeholder/too-short secrets: ${problems.join(', ')}`);
    process.exit(1);
  }
  if (!parsed.data.ALLOWED_ORIGINS.trim() && !parsed.data.CORS_ORIGIN.trim()) {
    console.error('❌ CRITICAL PRODUCTION SECURITY ERROR: ALLOWED_ORIGINS (explicit CORS allowlist) is required.');
    process.exit(1);
  }
}

export const env = {
  ...parsed.data,
  PORT: parseInt(parsed.data.PORT, 10),
  RATE_LIMIT_WINDOW_MS: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS, 10),
  RATE_LIMIT_MAX: parseInt(parsed.data.RATE_LIMIT_MAX, 10),
  TELEMETRY_ENABLED: parsed.data.TELEMETRY_ENABLED === 'true',
  SMTP_PORT: parseInt(parsed.data.SMTP_PORT, 10),
} as const;

export type Env = typeof env;
