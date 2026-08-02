import type { MenuItem } from '../menu/liveMenuService';
import type { CatalogGuardResult } from '../../types';
import { fetchLiveMenu } from '../menu/liveMenuService';

// ─── Known Hallucination Patterns (items LLMs commonly invent for pizza brands) ─
// These are non-Olive-Pizza items often fabricated by pretrained models.
const WELL_KNOWN_HALLUCINATIONS = [
  // Non-veg items Olive Pizza cannot serve (100% Pure Vegetarian brand)
  /pepperoni\s*pizza/i,
  /buffalo\s*chicken/i,
  /bbq\s*chicken/i,
  /meat\s*lov(er|a)s?/i,
  /seafood\s*pizza/i,
  /bacon\s*pizza/i,
  /hawaiian\s*pizza/i,
  /chicken\s*tikka\s*pizza/i,
  /mutton\s*pizza/i,
  /egg\s*pizza/i,
  /prawn\s*pizza/i,
  /fish\s*pizza/i,
  // Generic made-up price signals not backed by live data
  /\$\d+\.\d{2}/,
  // Fake coupon codes that are invented
  /coupon\s*code:\s*(PIZZA\d{2,}|DEAL\d{2,}|SAVE\d{3,}|FLAT\d{3,})/i,
];

// Extract all food item names / product references mentioned in a response.
function extractFoodEntityMentions(text: string): string[] {
  // Match patterns like "X Pizza", "X Burger", "X Garlic Bread", "X Pasta", etc.
  const patterns = [
    /[\w\s\-&']+\bpizza\b/gi,
    /[\w\s\-&']+\bburger\b/gi,
    /[\w\s\-&']+\bpasta\b/gi,
    /[\w\s\-&']+\bgarlic bread\b/gi,
    /[\w\s\-&']+\bcombo\b/gi,
    /[\w\s\-&']+\bdessert\b/gi,
    /[\w\s\-&']+\blava cake\b/gi,
    /[\w\s\-&']+\bwrap\b/gi,
    /[\w\s\-&']+\bsandwich\b/gi,
    /[\w\s\-&']+\bnachos\b/gi,
  ];

  const results = new Set<string>();
  for (const pat of patterns) {
    const matches = text.match(pat) || [];
    for (const m of matches) {
      const cleaned = m.trim().replace(/^[-\s•*]+/, '').replace(/\s{2,}/g, ' ');
      if (cleaned.length > 3 && cleaned.length < 80) {
        results.add(cleaned.toLowerCase());
      }
    }
  }
  return [...results];
}

// Build a fast lookup set from the live menu
function buildCatalogLookup(menu: MenuItem[]): Set<string> {
  const lookup = new Set<string>();
  for (const item of menu) {
    // Add full name
    lookup.add(item.name.toLowerCase());
    // Add individual words of 4+ chars for fuzzy matching
    const words = item.name.toLowerCase().split(/\s+/);
    for (const w of words) {
      if (w.length >= 4) lookup.add(w);
    }
    // Add tags
    for (const tag of item.tags || []) {
      lookup.add(tag.toLowerCase());
    }
    // Add the id itself
    lookup.add(item.id.toLowerCase());
  }
  return lookup;
}

// Check if an entity mention is plausibly covered by the live catalog
function isEntityVerified(entity: string, catalogLookup: Set<string>, menu: MenuItem[]): boolean {
  // Exact name match
  if (catalogLookup.has(entity)) return true;

  // Partial/fuzzy: does entity significantly overlap with any catalog item name?
  for (const item of menu) {
    const itemName = item.name.toLowerCase();
    // If the entity contains the core name or vice versa
    if (itemName.includes(entity) || entity.includes(itemName)) return true;

    // Token overlap: entity tokens that appear in item name
    const entityTokens = entity.split(/\s+/).filter((t) => t.length >= 4);
    const itemTokens = itemName.split(/\s+/).filter((t) => t.length >= 4);
    const overlap = entityTokens.filter((t) => itemTokens.includes(t));
    if (overlap.length >= 2 && overlap.length >= entityTokens.length * 0.6) return true;
  }
  return false;
}

// Extract product IDs from LLM response that match the live catalog
function extractVerifiedProductIds(text: string, menu: MenuItem[]): string[] {
  const verifiedIds: string[] = [];
  for (const item of menu) {
    // Match by product ID embedded in tags or text
    if (text.toLowerCase().includes(item.id.toLowerCase())) {
      verifiedIds.push(item.id);
      continue;
    }
    // Match by name (at least 80% of name present in text)
    const nameLower = item.name.toLowerCase();
    const nameWords = nameLower.split(/\s+/).filter((w) => w.length >= 4);
    const matchedWords = nameWords.filter((w) => text.toLowerCase().includes(w));
    if (nameWords.length > 0 && matchedWords.length / nameWords.length >= 0.8) {
      verifiedIds.push(item.id);
    }
  }
  return [...new Set(verifiedIds)];
}

// ─── Main CatalogGuard Validator ─────────────────────────────────────────────
export async function runCatalogGuard(
  llmResponse: string,
  restaurantKnowledgeUsed: boolean,
  menu?: MenuItem[],
): Promise<CatalogGuardResult> {
  // Skip guard for non-restaurant responses (general conversation)
  if (!restaurantKnowledgeUsed) {
    return {
      status: 'PASS',
      flaggedItems: [],
      sanitizedText: llmResponse,
      verifiedProductIds: [],
      restaurantKnowledgeUsed: false,
    };
  }

  const liveMenu = menu || (await fetchLiveMenu());

  // 1. Check for well-known hallucination patterns (non-veg items, fake prices, etc.)
  const patternFlags: string[] = [];
  for (const pattern of WELL_KNOWN_HALLUCINATIONS) {
    const match = llmResponse.match(pattern);
    if (match) {
      patternFlags.push(match[0]);
    }
  }

  // 2. Extract food entity mentions from the response
  const entityMentions = extractFoodEntityMentions(llmResponse);
  const catalogLookup = buildCatalogLookup(liveMenu);

  // 3. Find entities not in the live catalog
  const unverifiedEntities = entityMentions.filter(
    (entity) => !isEntityVerified(entity, catalogLookup, liveMenu),
  );

  const allFlaggedItems = [...new Set([...patternFlags, ...unverifiedEntities])];

  // 4. Extract verified product IDs for frontend product card rendering
  const verifiedProductIds = extractVerifiedProductIds(llmResponse, liveMenu);

  if (allFlaggedItems.length === 0) {
    return {
      status: 'PASS',
      flaggedItems: [],
      sanitizedText: llmResponse,
      verifiedProductIds,
      restaurantKnowledgeUsed: true,
    };
  }

  // 5. Sanitize: replace unverified entity references with disclaimer
  let sanitizedText = llmResponse;

  // Replace non-veg pattern matches with veg-friendly note
  for (const pattern of WELL_KNOWN_HALLUCINATIONS) {
    sanitizedText = sanitizedText.replace(
      pattern,
      '[Olive Pizza is 100% Pure Vegetarian — this item is not available]',
    );
  }

  console.warn(`🛡️ CatalogGuard FLAGGED ${allFlaggedItems.length} unverified items:`, allFlaggedItems);

  return {
    status: 'SANITIZED',
    flaggedItems: allFlaggedItems,
    sanitizedText,
    verifiedProductIds,
    restaurantKnowledgeUsed: true,
  };
}

// ─── Strict No-Knowledge Guard ────────────────────────────────────────────────
// If no restaurant data was retrieved and this is a restaurant query,
// block the LLM response entirely and return the safe fallback.
export function buildKnowledgeUnavailableResponse(query: string): string {
  const lowerQ = query.toLowerCase();

  // Detect what kind of query this is for a more specific response
  if (/pizza|menu|burger|pasta|garlic bread|side|dessert|drink|beverage/i.test(lowerQ)) {
    return `I couldn't find product information in the Olive Pizza knowledge base at this moment. 🍕 Please browse our live menu directly on the Olive Pizza app, or try asking me again in a moment.`;
  }
  if (/coupon|promo|discount|offer|deal/i.test(lowerQ)) {
    return `I couldn't retrieve current offers and coupons from the Olive Pizza knowledge base right now. Please check the Offers section in the app for the latest deals.`;
  }
  if (/time|hour|open|close|timing/i.test(lowerQ)) {
    return `Store timing information is currently unavailable from the knowledge base. Please contact Olive Pizza directly or check the restaurant information page in the app.`;
  }
  if (/deliver|area|zone|location/i.test(lowerQ)) {
    return `Delivery zone information is temporarily unavailable from the knowledge base. Please check the Olive Pizza app for your area coverage.`;
  }
  return `I couldn't find this information in the Olive Pizza knowledge base. The requested data is temporarily unavailable. Please try again or contact Olive Pizza support directly.`;
}

// ─── Hard Restaurant Intent Trigger Detector ────────────────────────────────
const RESTAURANT_INTENT_TERMS = [
  'menu', 'pizza', 'burger', 'pasta', 'garlic bread', 'side', 'beverage', 'drink', 'coke',
  'dessert', 'lava cake', 'combo', 'price', 'cost', 'how much', 'offer', 'coupon', 'deal',
  'discount', 'promo', 'timing', 'open', 'close', 'delivery', 'deliver', 'address', 'location',
  'phone', 'contact', 'faq', 'policy', 'refund', 'return', 'cancel', 'jain', 'vegetarian',
  'veg', 'non-veg', 'vegan', 'topping', 'crust', 'size', 'large', 'medium', 'small',
  'bestseller', 'trending', 'popular', 'paneer', 'margherita', 'truffle', 'mushroom',
  'available', 'stock', 'item', 'product', 'food', 'eat', 'order',
];

export function isRestaurantQuery(query: string): boolean {
  const lowerQ = query.toLowerCase();
  return RESTAURANT_INTENT_TERMS.some((term) => lowerQ.includes(term));
}
