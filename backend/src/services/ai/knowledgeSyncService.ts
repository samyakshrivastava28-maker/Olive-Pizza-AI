import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getFirestore } from '../../config/firebase';
import { ingestKnowledgeItem } from '../embeddings/embeddingPipeline';
import { cache } from '../../config/cache';
import { localKnowledgeEngine } from '@/services/retrieval/localKnowledgeEngine';

const COLLECTIONS_TO_SYNC = [
  { name: 'products', type: 'menu_item' },
  { name: 'categories', type: 'category' },
  { name: 'offers', type: 'offer' },
  { name: 'coupons', type: 'coupon' },
  { name: 'policies', type: 'policy' },
  { name: 'store_info', type: 'restaurant_info' },
  { name: 'settings', type: 'settings' },
  { name: 'faq', type: 'faq' }
];

const KNOWLEDGE_DIR = path.resolve(process.cwd(), 'knowledge');

export class KnowledgeSyncService {
  private db = getFirestore();
  private unsubscribers: (() => void)[] = [];

  public async startSync() {
    if (!this.db) {
      console.warn('⚠️ Firestore not initialized. Knowledge Sync aborted.');
      return;
    }
    
    // Ensure knowledge directory exists
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
    console.log(`📁 Knowledge Repository active at: ${KNOWLEDGE_DIR}`);

    console.log('🔄 Starting Live Knowledge Synchronization (Firestore -> Local JSON -> Pinecone)');
    
    for (const { name, type } of COLLECTIONS_TO_SYNC) {
      const unsubscribe = this.db.collection(name).onSnapshot(
        async (snapshot) => {
          
          // 1. DUMP ENTIRE COLLECTION TO LOCAL JSON (Phase 2)
          try {
            const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const jsonPath = path.join(KNOWLEDGE_DIR, `${name}.json`);
            await fs.writeFile(jsonPath, JSON.stringify(allDocs, null, 2), 'utf-8');
            console.log(`💾 Knowledge Repositiory Updated: ${name}.json (${allDocs.length} items)`);
            
            // Reload engine instantly without restart
            await localKnowledgeEngine.reloadCollection(name);
          } catch (err: any) {
            console.error(`⚠️ Failed to write ${name}.json to knowledge repository:`, err.message);
          }

          // 2. EMBED & SYNC TO PINECONE (Phase 3 & 4)
          for (const change of snapshot.docChanges()) {
            const docId = change.doc.id;
            const data = change.doc.data();
            
            if (change.type === 'added' || change.type === 'modified') {
              try {
                // Ensure data is structured
                const title = data.name || data.title || data.question || `Document ${docId}`;
                const content = data.description || data.content || data.answer || JSON.stringify(data);
                const category = data.category || name;
                
                // Compare checksum (via cache) to avoid unnecessary Pinecone upserts
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
                    data.version || 1
                  );
                  await cache.set(cacheKey, md5, 86400 * 30); // Cache for 30 days
                }
              } catch (error: any) {
                console.error(`[Sync] Failed to process ${name}/${docId}:`, error.message);
              }
            } else if (change.type === 'removed') {
              console.log(`[Sync] Document removed: ${name}/${docId}. (Deletion from Pinecone pending)`);
            }
          }
        },
        (error) => {
          console.error(`[Sync] Snapshot listener error on ${name}:`, error.message);
        }
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
