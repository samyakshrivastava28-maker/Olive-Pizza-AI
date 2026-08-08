import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';

// Track heartbeat statistics
let lastHeartbeat: string | null = null;
let totalHeartbeatsToday = 0;
let missedHeartbeats = 0;
let lastHeartbeatTime = Date.now();

export function getHealth(req: Request, res: Response) {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    aiStatus: 'online',
    heartbeatStats: {
      lastHeartbeat,
      totalHeartbeatsToday,
      missedHeartbeats,
      timeSinceLastHeartbeatMs: Date.now() - lastHeartbeatTime
    }
  });
}

export function receiveHeartbeat(req: Request, res: Response) {
  const { timestamp, nonce, signature } = req.body;

  if (!timestamp || !nonce || !signature) {
    res.status(400).json({ error: 'Missing heartbeat parameters' });
    return;
  }

  // 1. Prevent Replay Attacks (Timestamp > 5 mins old)
  const timeDiff = Date.now() - parseInt(timestamp, 10);
  if (timeDiff > 5 * 60 * 1000 || timeDiff < -60000) {
    console.warn(`⚠️ [Heartbeat] Stale or invalid timestamp received from client.`);
    res.status(401).json({ error: 'Stale heartbeat timestamp' });
    return;
  }

  // 2. Validate HMAC Signature
  const payload = `${timestamp}:${nonce}`;
  const secret = process.env.TRACKING_TOKEN_SECRET || 'fallback-secret-do-not-use-in-prod';
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.warn(`🚨 [Heartbeat] SECURITY ALERT: Invalid HMAC signature.`);
    res.status(403).json({ error: 'Invalid HMAC signature' });
    return;
  }

  // 3. Heartbeat Accepted
  lastHeartbeat = new Date().toISOString();
  lastHeartbeatTime = Date.now();
  totalHeartbeatsToday++;

  console.log(`💓 [Heartbeat] Received valid keep-alive ping. Total today: ${totalHeartbeatsToday}`);

  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    message: 'Heartbeat acknowledged'
  });
}

export function receiveSelfKeepAlive(req: Request, res: Response) {
  const { timestamp, nonce, signature } = req.body;

  if (!timestamp || !nonce || !signature) {
    res.status(400).json({ error: 'Missing keep-alive parameters' });
    return;
  }

  // 1. Prevent Replay Attacks (Timestamp > 2 mins old)
  const timeDiff = Date.now() - parseInt(timestamp, 10);
  if (timeDiff > 2 * 60 * 1000 || timeDiff < -60000) {
    console.warn(`⚠️ [Self-Ping] Stale or invalid timestamp received.`);
    res.status(401).json({ error: 'Stale keep-alive timestamp' });
    return;
  }

  // 2. Validate HMAC Signature
  const payload = `${timestamp}:${nonce}`;
  const secret = process.env.INTERNAL_SECRET || process.env.TRACKING_TOKEN_SECRET || 'fallback-secret-do-not-use-in-prod';
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.warn(`🚨 [Self-Ping] SECURITY ALERT: Invalid HMAC signature.`);
    res.status(403).json({ error: 'Invalid HMAC signature' });
    return;
  }

  console.log(`💓 [Self-Ping] Received valid self keep-alive ping.`);

  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    message: 'Self Keep-alive acknowledged'
  });
}
