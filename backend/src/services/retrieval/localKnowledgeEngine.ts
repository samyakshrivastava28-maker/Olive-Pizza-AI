import fs from 'fs/promises';
import path from 'path';

const KNOWLEDGE_DIR = path.resolve(process.cwd(), 'knowledge');

interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, unknown>;
  source: 'local_json';
}

export class LocalKnowledgeEngine {
  private collections: Map<string, any[]> = new Map();

  public async reloadCollection(name: string) {
    try {
      const jsonPath = path.join(KNOWLEDGE_DIR, `${name}.json`);
      const fileData = await fs.readFile(jsonPath, 'utf-8');
      const data = JSON.parse(fileData);
      this.collections.set(name, data);
      console.log(`[LocalEngine] Loaded ${name}.json (${data.length} items) into memory.`);
    } catch (err: any) {
      console.warn(`[LocalEngine] Could not load ${name}.json:`, err.message);
    }
  }

  public async loadAll() {
    console.log('[LocalEngine] Bootstrapping all JSON knowledge...');
    const collections = ['products', 'categories', 'offers', 'coupons', 'policies', 'store_info', 'settings', 'faq'];
    await Promise.all(collections.map(c => this.reloadCollection(c)));
  }

  public search(query: string, limit = 5): SearchResult[] {
    const start = Date.now();
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter(t => t.length > 2);
    
    if (terms.length === 0) return [];

    const results: SearchResult[] = [];

    for (const [colName, items] of this.collections.entries()) {
      for (const item of items) {
        const title = (item.name || item.title || item.question || '').toLowerCase();
        const content = (item.description || item.content || item.answer || '').toLowerCase();
        
        let score = 0;
        let matchCount = 0;

        for (const term of terms) {
          if (title.includes(term)) { score += 0.6; matchCount++; }
          else if (content.includes(term)) { score += 0.3; matchCount++; }
        }

        if (matchCount > 0) {
          // Boost exact title matches heavily
          if (title === queryLower) score += 2.0;

          results.push({
            id: item.id,
            score,
            content: `${item.name || item.title || item.question || ''}. ${item.description || item.content || item.answer || ''}`,
            metadata: {
              title: item.name || item.title || item.question,
              documentType: colName,
              category: item.category || colName,
              ...item
            },
            source: 'local_json'
          });
        }
      }
    }

    // Sort by score and take top K
    const topResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`[LocalEngine] Search for "${query}" yielded ${topResults.length} results in ${Date.now() - start}ms`);
    return topResults;
  }
}

export const localKnowledgeEngine = new LocalKnowledgeEngine();
