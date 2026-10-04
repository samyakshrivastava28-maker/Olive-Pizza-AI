import NodeCache from 'node-cache';
import { env } from './env';

// In-memory cache as Redis fallback (TTL in seconds)
const memCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

let _redisClient: any = null;

async function tryConnectRedis(): Promise<boolean> {
  if (!env.REDIS_URL) return false;
  try {
    // Dynamic import to allow running in environments without ioredis installed
    const ioredisModule: any = await import('ioredis' as string);
    const Redis = ioredisModule.default || ioredisModule;
    _redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await _redisClient.connect();
    console.log('✅ Redis connected');
    return true;
  } catch {
    console.warn('⚠️  Redis unavailable, using in-memory cache');
    _redisClient = null;
    return false;
  }
}

tryConnectRedis();

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (_redisClient) {
      try {
        const val = await _redisClient.get(key);
        return val ? (JSON.parse(val) as T) : null;
      } catch {
        /* fallback to memory */
      }
    }
    return (memCache.get<T>(key) as T) ?? null;
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (_redisClient) {
      try {
        await _redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch {
        /* fallback to memory */
      }
    }
    memCache.set(key, value, ttlSeconds);
  },

  async del(key: string): Promise<void> {
    if (_redisClient) {
      try {
        await _redisClient.del(key);
      } catch {
        /* fallback */
      }
    }
    memCache.del(key);
  },

  async flush(): Promise<void> {
    if (_redisClient) {
      try {
        await _redisClient.flushdb();
      } catch {
        /* fallback */
      }
    }
    memCache.flushAll();
  },

  /**
   * Distributed atomic replay protection nonce using Redis SET ... NX EX.
   * Enforces FAIL CLOSED: If Redis is unavailable, returns false (rejects request).
   */
  async acquireReplayNonce(signature: string, ttlSeconds = 120): Promise<boolean> {
    if (!_redisClient) {
      // In development/test mode without REDIS_URL configured, allow fallback if explicitly in test
      if (process.env.NODE_ENV === 'test' && !env.REDIS_URL) {
        const key = `replay:ai:${signature}`;
        if (memCache.get(key)) return false;
        memCache.set(key, 1, ttlSeconds);
        return true;
      }
      console.error('[AI Auth Replay] Shared Redis is required for service HMAC replay prevention. Failing closed.');
      return false; // FAIL CLOSED
    }
    try {
      const res = await _redisClient.set(`replay:ai:${signature}`, '1', 'EX', ttlSeconds, 'NX');
      return res === 'OK';
    } catch (err: any) {
      console.error('[AI Auth Replay] Redis error during atomic nonce acquisition. Failing closed:', err?.message);
      return false; // FAIL CLOSED
    }
  },
};
