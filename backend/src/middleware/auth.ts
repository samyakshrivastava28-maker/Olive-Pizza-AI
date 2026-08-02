import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

// Simple token-based auth for developer dashboard
// In production, integrate with Firebase Auth JWT verification
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth in development
  if (env.NODE_ENV === 'development') {
    next();
    return;
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // In production, verify JWT here
  next();
}

// Prompt injection guard — blocks known attack patterns
const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /forget everything/i,
  /you are now/i,
  /disregard your/i,
  /act as if/i,
  /new persona/i,
  /override system/i,
  /jailbreak/i,
  /<script>/i,
  /drop table/i,
  /union select/i,
];

export function promptInjectionGuard(req: Request, res: Response, next: NextFunction): void {
  const body = JSON.stringify(req.body);
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(body)) {
      console.warn(`🛡️  Prompt injection attempt blocked: ${pattern.source}`);
      res.status(400).json({ error: 'Invalid request content' });
      return;
    }
  }
  next();
}

// Request logger
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}
