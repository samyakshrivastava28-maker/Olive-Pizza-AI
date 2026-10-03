import { Request, Response } from 'express';
import crypto from 'crypto';
import { getHeartbeatSecret, getInternalSecret } from '../config/secrets';

// Track heartbeat statistics
let lastHeartbeat: string | null = null;
let totalHeartbeatsToday = 0;
let lastHeartbeatTime = Date.now();

/** Public liveness probe: deliberately exposes no memory, uptime or heartbeat internals. */
export function getHealth(_req: Request, res: Response) {
  res.json({
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
}

function signedPingValid(
  req: Request,
  res: Response,
  secret: string | undefined,
  maxAgeMs: number,
  label: string,
): boolean {
  const { timestamp, nonce, signature } = req.body ?? {};

  if (!secret) {
    console.error(`[${label}] No signing secret configured — rejecting (fail closed).`);
    res.status(503).json({ error: 'Heartbeat verification not configured' });
    return false;
  }
  if (!timestamp || !nonce || !signature) {
    res.status(400).json({ error: 'Missing parameters' });
    return false;
  }

  const timeDiff = Date.now() - parseInt(String(timestamp), 10);
  if (!Number.isFinite(timeDiff) || timeDiff > maxAgeMs || timeDiff < -60000) {
    res.status(401).json({ error: 'Stale timestamp' });
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}:${nonce}`).digest('hex');
  let ok = false;
  try {
    const a = Buffer.from(String(signature), 'hex');
    const b = Buffer.from(expected, 'hex');
    ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    ok = false;
  }
  if (!ok) {
    console.warn(`🚨 [${label}] Invalid HMAC signature.`);
    res.status(403).json({ error: 'Invalid HMAC signature' });
    return false;
  }
  return true;
}

export function receiveHeartbeat(req: Request, res: Response) {
  if (!signedPingValid(req, res, getHeartbeatSecret(), 5 * 60 * 1000, 'Heartbeat')) return;

  lastHeartbeat = new Date().toISOString();
  lastHeartbeatTime = Date.now();
  totalHeartbeatsToday++;

  res.json({ status: 'alive', timestamp: new Date().toISOString(), message: 'Heartbeat acknowledged' });
}

export function receiveSelfKeepAlive(req: Request, res: Response) {
  if (!signedPingValid(req, res, getInternalSecret(), 2 * 60 * 1000, 'Self-Ping')) return;

  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString(), message: 'Self Keep-alive acknowledged' });
}

/** Internal diagnostics for the DIAGNOSTICS-role telemetry dashboard (not publicly routed). */
export function getHeartbeatStats() {
  return { lastHeartbeat, totalHeartbeatsToday, timeSinceLastHeartbeatMs: Date.now() - lastHeartbeatTime };
}
