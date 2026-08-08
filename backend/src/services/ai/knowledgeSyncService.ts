import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getFirestore } from '../../config/firebase';
import { ingestKnowledgeItem } from '../embeddings/embeddingPipeline';
import { cache } from '../../config/cache';
import { localKnowledgeEngine } from '@/services/retrieval/localKnowledgeEngine';

import axios from 'axios';
import { env } from '../../config/env';

const COLLECTIONS_TO_SYNC = [
  { name: 'products', type: 'menu_item' },
  { name: 'combos', type: 'combo' },
  { name: 'offers', type: 'offer' },
  { name: 'ads', type: 'advertisement' },
  { name: 'restaurant', type: 'restaurant_info' },
  { name: 'categories', type: 'category' },
  { name: 'coupons', type: 'coupon' },
  { name: 'policies', type: 'policy' },
  { name: 'store_info', type: 'restaurant_info' },
  { name: 'settings', type: 'settings' },
  { name: 'faq', type: 'faq' }
];

const KNOWLEDGE_DIR = path.resolve(process.cwd(), 'knowledge');
const R2_BASE_URL = process.env.CLOUDFLARE_R2_URL || env.OLIVE_PIZZA_BACKEND_URL || 'https://olive-pizza-backend.onrender.com';

interface VersionManifest {
  version: string;
  updatedAt: string;
  collections: Record<string, { hash: string; updatedAt: string }>;
}

export class KnowledgeSyncService {
  private db = getFirestore();
  private unsubscribers: (() => void)[] = [];
  private currentVersionManifest: VersionManifest | null = null;

  /**
   * Main Project -> Cloudflare R2 -> version.json -> Check version -> Download only changed JSON -> knowledge/ -> Local Cache -> Memory Index
   */
  public async checkAndDownloadR2Knowledge(): Promise<{ synced: boolean; updatedCollections: string[] }> {
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
    const updatedCollections: string[] = [];

    try {
      console.log('📡 Checking Cloudflare R2 version.json for Knowledge Updates...');
      const versionRes = await axios.get<VersionManifest>(`${R2_BASE_URL}/knowledge/version.json`, { timeout: 5000 });
      const remoteManifest = versionRes.data;

      // Load local version manifest if exists
      const localManifestPath = path.join(KNOWLEDGE_DIR, 'version.json');
      let localManifest: VersionManifest | null = null;
      try {
        const localData = await fs.readFile(localManifestPath, 'utf-8');
        localManifest = JSON.parse(localData);
      } catch {
        localManifest = null;
      }

      for (const { name } of COLLECTIONS_TO_SYNC) {
        const remoteColMeta = remoteManifest.collections?.[name];
        const localColMeta = localManifest?.collections?.[name];

        // Download if remote is newer or local file missing
        const localFilePath = path.join(KNOWLEDGE_DIR, `${name}.json`);
        let localExists = false;
        try {
          await fs.access(localFilePath);
          localExists = true;
        } catch {
          localExists = false;
        }

        if (!localExists || !localColMeta || (remoteColMeta && localColMeta.hash !== remoteColMeta.hash)) {
          console.log(`⬇️ Downloading updated knowledge from R2: ${name}.json`);
          try {
            const fileRes = await axios.get(`${R2_BASE_URL}/knowledge/${name}.json`, { timeout: 8000 });
            const payload = fileRes.data;

            // Validate payload before atomic save
            if (!payload || typeof payload !== 'object') {
              throw new Error('Downloaded JSON payload is empty or invalid');
            }

            const tmpPath = path.join(KNOWLEDGE_DIR, `${name}.json.tmp`);
            const finalPath = path.join(KNOWLEDGE_DIR, `${name}.json`);
            
            await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
            // Atomic rename so corrupted writes never overwrite good cache
            await fs.rename(tmpPath, finalPath);

            await localKnowledgeEngine.reloadCollection(name);
            updatedCollections.push(name);
          } catch (err: any) {
            console.warn(`⚠️ Failed to download/save ${name}.json from R2:`, err.message);
          }
        }
      }

      // Save updated version manifest locally
      await fs.writeFile(localManifestPath, JSON.stringify(remoteManifest, null, 2), 'utf-8');
      this.currentVersionManifest = remoteManifest;

      console.log(`✅ R2 Knowledge Sync Complete. ${updatedCollections.length} collections updated.`);
      return { synced: true, updatedCollections };
    } catch (err: any) {
      console.warn('⚠️ Cloudflare R2 version check unavailable, using local cache:', err.message);
      return { synced: false, updatedCollections: [] };
    }
  }

  public async startSync() {
    // Ensure knowledge directory exists
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
    console.log(`📁 Knowledge Repository active at: ${KNOWLEDGE_DIR}`);

    // 1. Initial R2 Knowledge Download Check
    await this.checkAndDownloadR2Knowledge();

    if (!this.db) {
      console.warn('⚠️ Firestore listener not initialized. Local JSON cache active.');
      return;
    }

    console.log('🔄 Starting Live Knowledge Listener (Firestore -> Local JSON -> Memory Index)');

    for (const { name, type } of COLLECTIONS_TO_SYNC) {
      const unsubscribe = this.db.collection(name).onSnapshot(
        async (snapshot) => {
          try {
            const allDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const jsonPath = path.join(KNOWLEDGE_DIR, `${name}.json`);
            await fs.writeFile(jsonPath, JSON.stringify(allDocs, null, 2), 'utf-8');
            console.log(`💾 Knowledge Repository Updated: ${name}.json (${allDocs.length} items)`);
            await localKnowledgeEngine.reloadCollection(name);
          } catch (err: any) {
            console.error(`⚠️ Failed to write ${name}.json to knowledge repository:`, err.message);
          }

          for (const change of snapshot.docChanges()) {
            const docId = change.doc.id;
            const data = change.doc.data();

            if (change.type === 'added' || change.type === 'modified') {
              try {
                const title = data.name || data.title || data.question || `Document ${docId}`;
                const content = data.description || data.content || data.answer || JSON.stringify(data);
                const category = data.category || name;

                const textToEmbed = `${title}. ${content} Category: ${category}`;
                const md5 = crypto.createHash('md5').update(textToEmbed).digest('hex');
                const cacheKey = `checksum:${name}:${docId}`;
                const prevMd5 = await cache.get<string>(cacheKey);

                if (prevMd5 !== md5) {
                  console.log(`[Sync] Triggering Pinecone Upsert for ${name}/${docId} (${change.type})`);
                  await ingestKnowledgeItem(
                    docId,
                    category,
                    title,
                    content,
                    type,
                    data.language || 'en',
                    name,
                    data.tags || [],
                    data.version || 1,
                  );
                  await cache.set(cacheKey, md5, 86400 * 30);
                }
              } catch (error: any) {
                console.error(`[Sync] Failed to process ${name}/${docId}:`, error.message);
              }
            }
          }
        },
        (error) => {
          console.error(`[Sync] Snapshot listener error on ${name}:`, error.message);
        },
      );
      this.unsubscribers.push(unsubscribe);
    }
  }

  public stopSync() {
    console.log('🛑 Stopping Knowledge Synchronization');
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }
}

export const knowledgeSyncService = new KnowledgeSyncService();

