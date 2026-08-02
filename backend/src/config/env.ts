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
  OLIVE_PIZZA_BACKEND_URL: z.string().default('https://olive-pizza-backend.onrender.com'),

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

  // JWT & Auth
  JWT_SECRET: z.string().default('olive-ai-jwt-secret-dev-change-in-prod'),

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

export const env = {
  ...parsed.data,
  PORT: parseInt(parsed.data.PORT, 10),
  RATE_LIMIT_WINDOW_MS: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS, 10),
  RATE_LIMIT_MAX: parseInt(parsed.data.RATE_LIMIT_MAX, 10),
  TELEMETRY_ENABLED: parsed.data.TELEMETRY_ENABLED === 'true',
  SMTP_PORT: parseInt(parsed.data.SMTP_PORT, 10),
} as const;

export type Env = typeof env;
