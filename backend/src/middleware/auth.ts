import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { getFirebaseAuth, getFirestore } from '../config/firebase';

/**
 * Authentication model for Olive Pizza AI
 * ───────────────────────────────────────
 * Two principals can call the gateway:
 *   1. END USER   — a Firebase ID token (verified with Firebase Admin, signature + expiry + revocation).
 *   2. MAIN BACKEND (service) — HMAC (X-AI-Signature / X-AI-Timestamp) signed with AI_GATEWAY_SECRET.
 *
 * Presence of an Authorization header is NEVER treated as authentication.
 * If neither principal can be verified the request is rejected (fail closed) — in every NODE_ENV.
 */

export type AiRole =
  | 'customer' | 'guest'
  | 'owner' | 'platform_owner' | 'admin' | 'developer'
  | 'franchise_owner' | 'franchise_manager' | 'restaurant_manager' | 'manager'
  | 'kitchen_staff' | 'cashier' | 'pos_operator' | 'delivery_partner'
  | string;

export interface AiPrincipal {
  kind: 'user' | 'service';
  uid: string;
  email?: string;
  role: AiRole;
  franchiseId?: string;
  branchId?: string;
  /** Raw (prefix-stripped) Firebase ID token, forwarded to the Main Backend which re-verifies it. */
  idToken?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    principal?: AiPrincipal;
  }
}

// The only accounts allowed to be auto-promoted to owner (existing project RBAC model).
const AUTHORIZED_INTERNAL_EMAILS = ['webhub2811@gmail.com', 'olivepizzarjn@gmail.com'];

// ── Role groups ────────────────────────────────────────────────────────────────
export const ROLE_GROUPS = {
  /** Can use generation / drafting / knowledge tooling (nothing goes live from this group alone). */
  CONTENT_STAFF: ['owner', 'platform_owner', 'admin', 'developer'],
  /** Can publish SDUI, approve generated images — changes live customer content. */
  PUBLISHERS: ['owner', 'platform_owner', 'admin'],
  /** Can ingest/sync knowledge (poisons RAG if abused). */
  KNOWLEDGE_ADMINS: ['owner', 'platform_owner', 'admin', 'developer'],
  /** Telemetry, alerts, model registry, tool registry. */
  DIAGNOSTICS: ['developer', 'platform_owner', 'owner', 'admin'],
} as const;

// ── Firebase ID-token verification ─────────────────────────────────────────────
async function resolveUserPrincipal(idToken: string): Promise<AiPrincipal | null> {
  const auth = getFirebaseAuth();
  if (!auth) {
    console.error('[AI Auth] Firebase Admin not configured — cannot verify ID tokens; rejecting request.');
    return null;
  }

  let decoded;
  try {
    // checkRevoked=true: rejects revoked/disabled accounts, not only expired tokens.
    decoded = await auth.verifyIdToken(idToken, true);
  } catch (err: any) {
    console.warn(`[AI Auth] ID token rejected: ${err?.code || err?.message}`);
    return null;
  }

  let role: AiRole = (decoded.role as string) || 'customer';
  let franchiseId = decoded.franchiseId as string | undefined;
  let branchId = decoded.branchId as string | undefined;
  const email = decoded.email?.toLowerCase();

  if (decoded.role === 'REVOKED' || decoded.status === 'REVOKED') return null;

  if (email && decoded.email_verified !== false && AUTHORIZED_INTERNAL_EMAILS.includes(email)) {
    role = 'owner';
  } else {
    // Role/scope are server-side data, never client-supplied.
    const db = getFirestore();
    if (db) {
      try {
        const snap = await db.collection('users').doc(decoded.uid).get();
        if (snap.exists) {
          const u = snap.data() || {};
          if (u.isActive === false || u.status === 'REVOKED' || u.status === 'suspended' || u.role === 'REVOKED') return null;
          if (u.role) role = u.role;
          if (u.franchiseId) franchiseId = u.franchiseId;
          if (u.branchId) branchId = u.branchId;
        }
      } catch (err: any) {
        console.warn('[AI Auth] Role lookup failed, defaulting to customer scope:', err?.message);
      }
    }
  }

  return { kind: 'user', uid: decoded.uid, email, role, franchiseId, branchId, idToken };
}

// ── Service (HMAC) verification ────────────────────────────────────────────────
const SIGNATURE_WINDOW_MS = 2 * 60 * 1000;
const seenSignatures = new Map<string, number>(); // replay cache within the validity window

function pruneSeen(now: number) {
  for (const [sig, ts] of seenSignatures) if (now - ts > SIGNATURE_WINDOW_MS) seenSignatures.delete(sig);
}

export function verifyServiceSignature(req: Request): boolean {
  const secret = env.AI_GATEWAY_SECRET;
  if (!secret) return false; // no secret configured => service auth disabled, never a default

  const signature = req.headers['x-ai-signature'];
  const timestamp = req.headers['x-ai-timestamp'];
  if (typeof signature !== 'string' || typeof timestamp !== 'string') return false;

  const now = Date.now();
  const age = now - parseInt(timestamp, 10);
  if (!Number.isFinite(age) || age > SIGNATURE_WINDOW_MS || age < -30_000) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}:${JSON.stringify(req.body ?? {})}`)
    .digest('hex');

  let ok = false;
  try {
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');
    ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    ok = false;
  }
  if (!ok) return false;

  pruneSeen(now);
  if (seenSignatures.has(signature)) return false; // replay
  seenSignatures.set(signature, now);
  return true;
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !/^Bearer\s+\S+/i.test(h)) return null;
  return h.replace(/^Bearer\s+/i, '').trim();
}

/** Resolve whoever is calling (if verifiable) and attach it to req.principal. Never rejects. */
async function attachPrincipal(req: Request): Promise<{ attempted: boolean }> {
  if (req.principal) return { attempted: true };

  if (verifyServiceSignature(req)) {
    req.principal = { kind: 'service', uid: 'service:olive-main-backend', role: 'service' };
    // A service call may carry the end-user's token for per-user actions; verify it too.
    const t = bearer(req);
    if (t) {
      const user = await resolveUserPrincipal(t);
      if (user) req.principal = { ...user, kind: 'service' };
    }
    return { attempted: true };
  }

  const token = bearer(req);
  if (!token) return { attempted: false };
  const user = await resolveUserPrincipal(token);
  if (user) req.principal = user;
  return { attempted: true };
}

/** Public route that personalises when a VALID identity is present. Invalid token => 401 (not silently guest). */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { attempted } = await attachPrincipal(req);
  if (attempted && !req.principal) {
    res.status(401).json({ error: 'Invalid or expired credentials', code: 'AUTH_INVALID' });
    return;
  }
  next();
}

/** Valid Firebase user (or trusted service) required. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  await attachPrincipal(req);
  if (!req.principal) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }
  next();
}

/** Valid identity AND role in the allowed list. The trusted Main Backend service is allowed on staff routes. */
export function requireRole(roles: readonly string[], opts: { allowService?: boolean } = { allowService: true }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await attachPrincipal(req);
    const p = req.principal;
    if (!p) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }
    const isPureService = p.kind === 'service' && p.role === 'service';
    const allowed = isPureService ? opts.allowService !== false : roles.includes(p.role);
    if (!allowed) {
      console.warn(`[AI Auth] 403 role=${p.role} uid=${p.uid} ${req.method} ${req.path}`);
      res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}

/** Server-to-server only (webhooks). End-user tokens are NOT accepted. */
export function requireService(req: Request, res: Response, next: NextFunction): void {
  if (!verifyServiceSignature(req)) {
    res.status(401).json({ error: 'Valid service signature required', code: 'SERVICE_AUTH_REQUIRED' });
    return;
  }
  req.principal = { kind: 'service', uid: 'service:olive-main-backend', role: 'service' };
  next();
}

/**
 * Prompt-injection guard — a cheap *noise filter only*, NOT a security boundary.
 * Authorization is enforced by authenticated identity, role checks and server-side tool permissions.
 */
const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /forget everything/i,
  /disregard your/i,
  /override system/i,
  /jailbreak/i,
  /<script>/i,
];

export function promptInjectionGuard(req: Request, res: Response, next: NextFunction): void {
  const body = JSON.stringify(req.body);
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(body)) {
      console.warn(`🛡️  Suspicious prompt blocked (noise filter): ${pattern.source}`);
      res.status(400).json({ error: 'Invalid request content' });
      return;
    }
  }
  next();
}

// Request logger (never logs headers/tokens/bodies)
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}
