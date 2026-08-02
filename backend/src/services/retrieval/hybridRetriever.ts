import { getPineconeIndex } from '../../config/pinecone';
import { getFirestore } from '../../config/firebase';
import { cache } from '../../config/cache';
import { formatLiveMenuPrompt } from '../menu/liveMenuService';
import type { VectorSearchResult, FirestoreFact, RetrievedContext } from '../../types';

// ─── Similarity Threshold & Result Limits ─────────────────────────────────────
const MIN_SIMILARITY = 0.50;       // Lower threshold to capture more relevant chunks
const MAX_CHUNKS = 10;              // More chunks for richer grounding
const PINECONE_TOP_K = 12;         // Retrieve more, filter after

// ─── Firestore Collection Map ─────────────────────────────────────────────────
const FIRESTORE_COLLECTIONS = [
  'products',
  'menu_items',
  'categories',
  'offers',
  'coupons',
  'faq',
  'faqs',
  'policies',
  'store_info',
  'delivery_areas',
  'restaurant',
  'settings',
];

// Keyword-based collection relevance mapping
const COLLECTION_KEYWORDS: Record<string, string[]> = {
  products: ['pizza', 'menu', 'item', 'food', 'price', 'topping', 'crust', 'size', 'burger', 'drink', 'show', 'list', 'what', 'available'],
  menu_items: ['pizza', 'menu', 'item', 'food', 'price', 'garlic bread', 'burger', 'pasta'],
  categories: ['category', 'type', 'kind', 'section', 'browse'],
  offers: ['offer', 'deal', 'discount', 'sale', 'promo', 'special'],
  coupons: ['coupon', 'code', 'voucher', 'promo code', 'save', 'discount code'],
  faq: ['how', 'what', 'when', 'where', 'why', 'can', 'do', 'help', 'question'],
  faqs: ['how', 'what', 'when', 'where', 'why', 'can', 'do', 'help', 'question'],
  policies: ['policy', 'return', 'refund', 'cancel', 'privacy', 'terms', 'legal', 'rule', 'condition'],
  store_info: ['time', 'hour', 'open', 'close', 'location', 'address', 'phone', 'contact', 'when'],
  delivery_areas: ['deliver', 'area', 'zone', 'location', 'pin', 'where', 'reach'],
  restaurant: ['restaurant', 'store', 'info', 'about', 'address', 'contact'],
  settings: ['timing', 'hour', 'setting', 'config'],
};

// ─── Pinecone Search (Mandatory for restaurant queries) ────────────────────────
interface PineconeSearchResult {
  results: VectorSearchResult[];
  documentIds: string[];
  latencyMs: number;
  queried: boolean;
}

async function searchPinecone(
  vector: number[],
  topK = PINECONE_TOP_K,
): Promise<PineconeSearchResult> {
  const startTime = Date.now();
  try {
    const index = getPineconeIndex();
    const queryResult = await index.query({
      vector,
      topK,
      includeMetadata: true,
      includeValues: false,
    });

    const matches = queryResult.matches ?? [];
    const filtered = matches
      .filter((m) => (m.score ?? 0) >= MIN_SIMILARITY)
      .map((m) => ({
        id: m.id,
        score: m.score ?? 0,
        content: String(m.metadata?.content ?? m.metadata?.text ?? ''),
        metadata: (m.metadata as Record<string, unknown>) ?? {},
        source: 'pinecone' as const,
      }));

    const documentIds = matches
      .filter((m) => (m.score ?? 0) >= MIN_SIMILARITY)
      .map((m) => String(m.metadata?.documentId ?? m.id));

    return {
      results: filtered,
      documentIds,
      latencyMs: Date.now() - startTime,
      queried: true,
    };
  } catch (err) {
    console.warn('⚠️  Pinecone search failed:', (err as Error).message);
    return { results: [], documentIds: [], latencyMs: Date.now() - startTime, queried: false };
  }
}

// ─── Firestore Knowledge Retrieval ────────────────────────────────────────────
interface FirestoreResult {
  facts: FirestoreFact[];
  collectionsAccessed: string[];
  queried: boolean;
}

async function getFirestoreFacts(query: string): Promise<FirestoreResult> {
  const cacheKey = `firestore:facts:${query.slice(0, 80)}`;
  const cached = await cache.get<{ facts: FirestoreFact[]; collectionsAccessed: string[]; queried: boolean }>(cacheKey);
  if (cached) return cached;

  const db = getFirestore();
  if (!db) return { facts: [], collectionsAccessed: [], queried: false };

  const facts: FirestoreFact[] = [];
  const collectionsAccessed: string[] = [];
  const queryLower = query.toLowerCase();

  // Determine relevant collections based on keywords — for restaurant queries fetch products always
  const isMenuQuery = /pizza|menu|burger|food|item|product|price|eat|show|list|what.*have|available/.test(queryLower);
  const relevantCollections = FIRESTORE_COLLECTIONS.filter((col) => {
    if (isMenuQuery && (col === 'products' || col === 'menu_items')) return true;
    const keywords = COLLECTION_KEYWORDS[col] || [];
    return keywords.some((kw) => queryLower.includes(kw));
  });

  // Always include store_info for context
  if (!relevantCollections.includes('store_info')) {
    relevantCollections.push('store_info');
  }

  await Promise.allSettled(
    relevantCollections.map(async (col) => {
      try {
        const snap = await db.collection(col).limit(10).get();
        if (!snap.empty) {
          collectionsAccessed.push(col);
          snap.docs.forEach((doc: any) => {
            facts.push({
              collection: col,
              docId: doc.id,
              data: doc.data() as Record<string, unknown>,
              relevanceScore: 0.8,
            });
          });
        }
      } catch {
        /* collection may not exist — skip */
      }
    }),
  );

  const result = { facts, collectionsAccessed, queried: true };
  await cache.set(cacheKey, result, 60); // Cache for 1 min (shorter for live data freshness)
  return result;
}

// ─── Deduplication & Re-ranking ───────────────────────────────────────────────
function deduplicateChunks(chunks: VectorSearchResult[]): VectorSearchResult[] {
  const seen = new Set<string>();
  return chunks
    .sort((a, b) => b.score - a.score)
    .filter((chunk) => {
      const key = chunk.content.slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_CHUNKS);
}

// ─── Context Assembler ────────────────────────────────────────────────────────
function assembleContext(
  chunks: VectorSearchResult[],
  facts: FirestoreFact[],
  liveMenuText: string,
  query: string,
): string {
  const sections: string[] = [];

  sections.push('--- OLIVE PIZZA KNOWLEDGE BASE (STRICT RAG CONTEXT) ---');
  
  if (liveMenuText) {
    sections.push('\n[LIVE MENU STATUS]');
    sections.push(liveMenuText);
  }

  if (chunks.length > 0) {
    sections.push('\n[RETRIEVED PINECONE CHUNKS]');
    chunks.forEach((chunk, i) => {
      const title = String(chunk.metadata?.title || 'Unknown Document');
      const docType = String(chunk.metadata?.documentType || 'General');
      sections.push(
        `--- Chunk ${i + 1} (Type: ${docType}, Title: ${title}) ---\n${chunk.content}`
      );
    });
  }

  if (facts.length > 0) {
    sections.push('\n[LIVE FIRESTORE ENTITIES]');
    facts.forEach((fact) => {
      const preview = JSON.stringify(fact.data).slice(0, 600);
      sections.push(`[${fact.collection}/${fact.docId}]: ${preview}`);
    });
  }

  sections.push(
    '\n=== STRICT RAG DIRECTIVE ===',
    '1. Use ONLY the provided knowledge context to answer restaurant-related questions.',
    '2. Do NOT invent menu items, prices, offers, policies, or restaurant details.',
    '3. If the answer is not present in the supplied context, EXPLICITLY STATE that the information is unavailable rather than guessing.',
    '4. Olive Pizza is 100% Pure Vegetarian. Never mention non-veg items.',
    `\n=== USER QUERY ===\n${query}`,
  );

  return sections.join('\n');
}

import { localKnowledgeEngine } from './localKnowledgeEngine';

// ─── Main Hybrid Retrieval Entry ──────────────────────────────────────────────
export async function hybridRetrieve(
  query: string,
  embedding?: number[],
): Promise<RetrievedContext> {
  // Phase 5: Local Knowledge Repository takes absolute priority.
  const localResults = localKnowledgeEngine.search(query, MAX_CHUNKS);
  
  let pineconeResult: PineconeSearchResult = { results: [], documentIds: [], latencyMs: 0, queried: false };
  
  // Only query Pinecone if local JSON failed to find high confidence matches or embedding exists
  if (localResults.length < 2 && embedding && embedding.length > 0) {
    pineconeResult = await searchPinecone(embedding);
  }

  // Still fetch live Firestore facts for active cart/orders context if needed
  const [firestoreResult, liveMenuText] = await Promise.all([
    getFirestoreFacts(query),
    formatLiveMenuPrompt(query),
  ]);

  // Merge Local JSON and Pinecone chunks
  const mergedChunks = [...localResults, ...pineconeResult.results];
  const allChunks = deduplicateChunks(mergedChunks);

  const assembledPrompt = assembleContext(
    allChunks,
    firestoreResult.facts,
    liveMenuText,
    query,
  );

  return {
    chunks: allChunks,
    firestoreFacts: firestoreResult.facts,
    totalTokens: Math.ceil(assembledPrompt.length / 4),
    assembledPrompt,
    documentIds: [...localResults.map(l => String(l.id)), ...pineconeResult.documentIds],
    pineconeQueried: pineconeResult.queried,
    firestoreQueried: firestoreResult.queried,
  };
}

// ─── Diagnostics Export ───────────────────────────────────────────────────────
export type { PineconeSearchResult, FirestoreResult };
