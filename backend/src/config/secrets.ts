import { env } from './env';

/**
 * Internal HMAC secret for heartbeat / self keep-alive signing.
 * Returns undefined when nothing is configured — callers must fail closed (no default secret exists).
 */
export function getInternalSecret(): string | undefined {
  return env.INTERNAL_SECRET || env.TRACKING_TOKEN_SECRET || undefined;
}

/** Secret the Main Backend uses to sign /internal/heartbeat. */
export function getHeartbeatSecret(): string | undefined {
  return env.TRACKING_TOKEN_SECRET || undefined;
}
