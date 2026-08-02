import cron from 'node-cron';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { mainBackendClient } from '../services/integration/mainBackendClient';

const AI_VERSION = '2.0.0'; // Keep in sync with root package.json

export class SelfKeepAliveJob {
  private static retryCount = 0;
  private static backoffDelays = [30000, 60000, 120000, 300000]; // 30s, 1m, 2m, 5m

  public static schedule() {
    console.log('⏰ Scheduling Self-Pinging Keep-Alive Job (every 10 minutes)');
    
    // Run every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
      await SelfKeepAliveJob.sendHeartbeat();
    });
  }

  private static async sendHeartbeat() {
    const timestamp = Date.now().toString();
    const nonce = uuidv4();
    const payload = `${timestamp}:${nonce}`;
    
    // Use TRACKING_TOKEN_SECRET or a fallback internal secret
    const secret = process.env.INTERNAL_SECRET || process.env.TRACKING_TOKEN_SECRET || 'fallback-secret-do-not-use-in-prod';
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    try {
      // 1. Self-ping to keep Render from sleeping
      const url = `http://localhost:${env.PORT}/api/internal/keep-alive`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp, nonce, signature }),
      });

      if (!response.ok) {
        throw new Error(`Self-Ping returned ${response.status}`);
      }

      console.log(`💓 [Self-Ping] Successfully kept the service alive.`);
      SelfKeepAliveJob.retryCount = 0; // Reset on success

      // 2. Report heartbeat to Main Backend (non-blocking, fire-and-forget)
      mainBackendClient.reportHeartbeat(AI_VERSION, 0, {}).catch(() => {});

    } catch (error: any) {
      console.warn(`⚠️ [Self-Ping] Ping failed: ${error.message}`);
      SelfKeepAliveJob.handleFailure();
    }
  }

  private static handleFailure() {
    if (SelfKeepAliveJob.retryCount < SelfKeepAliveJob.backoffDelays.length) {
      const delay = SelfKeepAliveJob.backoffDelays[SelfKeepAliveJob.retryCount];
      console.log(`⏳ [Self-Ping] Retrying in ${delay / 1000} seconds (Attempt ${SelfKeepAliveJob.retryCount + 1})...`);
      
      setTimeout(async () => {
        SelfKeepAliveJob.retryCount++;
        await SelfKeepAliveJob.sendHeartbeat();
      }, delay);
    } else {
      console.error(`🚨 [Self-Ping] CRITICAL: Self-ping failed after all retries!`);
      SelfKeepAliveJob.retryCount = 0; // Reset for the next 10-minute cron window
    }
  }
}
