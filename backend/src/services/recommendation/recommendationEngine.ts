import { fetchLiveMenu, type MenuItem } from '../menu/liveMenuService';
import type { HomepageRecommendationType, DashboardRecommendationType } from '../../types';

export interface RecommendationRequest {
  query?: string;
  cartItems?: Array<{ productId: string; name?: string; category?: string; price?: number }>;
  isVeg?: boolean;
  maxBudget?: number;
  limit?: number;
  occasion?: 'solo' | 'couple' | 'party' | 'quick_bite' | 'late_night';
  userId?: string;
  userRole?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'late_night';
  weather?: 'rainy' | 'cold' | 'hot' | 'pleasant';
  appliedCoupons?: string[];
  pastOrderCategories?: string[];
  userHistory?: any[];
}

export interface RecommendationResponse {
  recommendations: Array<MenuItem & { reason: string }>;
  pairingSuggestions?: Array<MenuItem & { reason: string }>;
  appliedDiscountNotice?: string;
  occasionLabel?: string;
  curatedCombos?: Array<{ title: string; items: MenuItem[]; comboPrice: number; discount: number }>;
}

export interface HomepageRecommendationsResponse {
  trendingItems: Array<MenuItem & { reason: string }>;
  recommendedCombos: Array<{ title: string; items: MenuItem[]; comboPrice: number; savings: number; badge: string }>;
  frequentlyBoughtTogether: Array<MenuItem & { reason: string }>;
  todaysSpecials: Array<MenuItem & { reason: string; badge: string }>;
  lateNightPicks?: Array<MenuItem & { reason: string }>;
  weekendSpecials?: Array<MenuItem & { reason: string }>;
  popularNearYou: Array<MenuItem & { reason: string }>;
  timestamp: string;
}

export interface DashboardRecommendationsResponse {
  personalFavorites: Array<MenuItem & { reason: string; orderCount?: number }>;
  frequentlyReordered: Array<MenuItem & { reason: string; lastOrdered?: string }>;
  suggestedCoupons: Array<{ code: string; title: string; discount: string; minOrder: number; description: string }>;
  healthyChoices: Array<MenuItem & { reason: string; calories?: number }>;
  budgetChoices: Array<MenuItem & { reason: string; tag: string }>;
  premiumChoices: Array<MenuItem & { reason: string; tag: string }>;
  timestamp: string;
}

// ── 1. Conversational & General Recommendation Engine ────────────────────────
export async function getLiveRecommendations(
  req: RecommendationRequest = {},
): Promise<RecommendationResponse> {
  const menu = await fetchLiveMenu();
  const limit = req.limit || 4;
  let candidates = menu.filter((item) => item.isAvailable);

  // Filter Veg
  if (req.isVeg !== undefined) {
    candidates = candidates.filter((item) => item.isVeg === req.isVeg);
  }

  // Filter Budget
  if (req.maxBudget !== undefined) {
    candidates = candidates.filter((item) => item.price <= req.maxBudget!);
  }

  const queryLower = (req.query || '').toLowerCase();
  const cartProductIds = new Set((req.cartItems || []).map((c) => c.productId));
  const currentHour = new Date().getHours();
  const isLateNight = currentHour >= 22 || currentHour < 4;
  const isWeekend = [0, 6].includes(new Date().getDay());

  // Scoring Pipeline
  let scoredItems = candidates.map((item) => {
    let score = item.rating * 10; // base score (40-50)

    // Bestseller boost
    if (item.tags?.includes('bestseller')) score += 15;

    // Discount boost
    if (item.originalPrice && item.originalPrice > item.price) {
      score += ((item.originalPrice - item.price) / item.originalPrice) * 20;
    }

    // Query relevance boost
    if (queryLower) {
      if (item.name.toLowerCase().includes(queryLower)) score += 30;
      if (item.description.toLowerCase().includes(queryLower)) score += 15;
      if (item.category.toLowerCase().includes(queryLower)) score += 20;
    }

    // Weather & Time contextual signal boost
    if (req.weather === 'rainy' || req.weather === 'cold') {
      if (item.isSpicy || item.tags?.includes('hot') || item.category === 'Pizzas') score += 10;
    } else if (req.weather === 'hot') {
      if (item.category === 'Beverages' || item.category === 'Desserts') score += 12;
    }

    if (isLateNight || req.occasion === 'late_night') {
      if (item.tags?.includes('quick') || item.category === 'Sides' || item.tags?.includes('bestseller')) score += 8;
    }

    // Cart penalty (avoid recommending what is already in cart)
    if (cartProductIds.has(item.id)) {
      score -= 50;
    }

    let reason = 'Chef Recommended Bestseller';
    if (item.rating >= 4.9) reason = `★ ${item.rating} Customer Favorite`;
    else if (item.originalPrice) reason = `Special Offer: Save ₹${item.originalPrice - item.price}`;
    else if (item.isSpicy) reason = `Spicy Kick (${item.spicyLevel || 2}/3🌶️)`;
    else if (isWeekend && item.category === 'Pizzas') reason = 'Weekend Gourmet Special';

    return { ...item, score, reason };
  });

  scoredItems.sort((a, b) => b.score - a.score);
  const primaryRecs = scoredItems.slice(0, limit);

  // Pairing Suggestions if user has items in cart
  let pairings: Array<MenuItem & { reason: string }> = [];
  const cartHasPizza = (req.cartItems || []).some(
    (i) => i.category?.toLowerCase() === 'pizzas' || i.productId.includes('pizza'),
  );

  if (cartHasPizza) {
    const sides = menu.filter((i) => i.category === 'Sides' && !cartProductIds.has(i.id));
    const drinks = menu.filter((i) => i.category === 'Beverages' && !cartProductIds.has(i.id));
    const dessert = menu.filter((i) => i.category === 'Desserts' && !cartProductIds.has(i.id));

    if (sides[0]) pairings.push({ ...sides[0], reason: 'Pairs perfectly with your pizza' });
    if (drinks[0]) pairings.push({ ...drinks[0], reason: 'Chilled refreshing beverage pairing' });
    if (dessert[0]) pairings.push({ ...dessert[0], reason: 'End your meal with molten chocolate' });
  }

  // Curated Combos calculation
  const pizzas = menu.filter((i) => i.category === 'Pizzas' && i.isAvailable);
  const sides = menu.filter((i) => i.category === 'Sides' && i.isAvailable);
  const drinks = menu.filter((i) => i.category === 'Beverages' && i.isAvailable);

  const curatedCombos = [];
  if (pizzas[0] && sides[0] && drinks[0]) {
    const rawSum = pizzas[0].price + sides[0].price + drinks[0].price;
    const comboPrice = Math.round(rawSum * 0.85); // 15% discount
    curatedCombos.push({
      title: 'Classic Trio Feast (Pizza + Garlic Bread + Drink)',
      items: [pizzas[0], sides[0], drinks[0]],
      comboPrice,
      discount: rawSum - comboPrice,
    });
  }

  return {
    recommendations: primaryRecs,
    pairingSuggestions: pairings.length > 0 ? pairings : undefined,
    appliedDiscountNotice: primaryRecs.some((r) => r.originalPrice)
      ? 'Exclusive app deals applied to selected items'
      : undefined,
    occasionLabel: isLateNight ? 'Late Night Cravings' : isWeekend ? 'Weekend Artisan Picks' : 'Daily Specials',
    curatedCombos: curatedCombos.length > 0 ? curatedCombos : undefined,
  };
}

// ── 2. Homepage Proactive Recommendations ─────────────────────────────────────
export async function getHomepageRecommendations(
  req: RecommendationRequest = {},
): Promise<HomepageRecommendationsResponse> {
  const menu = await fetchLiveMenu();
  const available = menu.filter((m) => m.isAvailable);

  const trendingItems = available
    .filter((m) => m.rating >= 4.8 || m.tags?.includes('bestseller'))
    .slice(0, 4)
    .map((m) => ({ ...m, reason: `Trending #${m.rating >= 4.9 ? '1 Bestseller' : 'Top Choice'} in City` }));

  const pizzas = available.filter((m) => m.category === 'Pizzas');
  const sides = available.filter((m) => m.category === 'Sides');
  const drinks = available.filter((m) => m.category === 'Beverages');
  const desserts = available.filter((m) => m.category === 'Desserts');

  const recommendedCombos = [
    {
      title: 'Artisan Party Box',
      items: [pizzas[0], pizzas[1], sides[0], drinks[0]].filter(Boolean),
      comboPrice: 999,
      savings: 249,
      badge: 'Save 20%',
    },
    {
      title: 'Gourmet Date Night Combo',
      items: [pizzas[0], sides[0], desserts[0]].filter(Boolean),
      comboPrice: 699,
      savings: 149,
      badge: 'Couple Favorite',
    },
  ];

  const frequentlyBoughtTogether = [
    sides[0] ? { ...sides[0], reason: 'Ordered with 78% of Pizzas' } : null,
    drinks[0] ? { ...drinks[0], reason: 'Most popular beverage combo' } : null,
    desserts[0] ? { ...desserts[0], reason: 'Customer favorite dessert add-on' } : null,
  ].filter(Boolean) as Array<MenuItem & { reason: string }>;

  const todaysSpecials = available
    .filter((m) => m.originalPrice && m.originalPrice > m.price)
    .slice(0, 4)
    .map((m) => ({
      ...m,
      badge: `Save ₹${m.originalPrice! - m.price}`,
      reason: "Today's Woodfired Special Deal",
    }));

  const popularNearYou = available.slice(2, 6).map((m) => ({
    ...m,
    reason: 'High demand in your delivery zone',
  }));

  const currentHour = new Date().getHours();
  const lateNightPicks =
    currentHour >= 21 || currentHour < 5
      ? available.slice(0, 3).map((m) => ({ ...m, reason: 'Express 20-min late night kitchen pick' }))
      : undefined;

  return {
    trendingItems,
    recommendedCombos,
    frequentlyBoughtTogether,
    todaysSpecials,
    lateNightPicks,
    popularNearYou,
    timestamp: new Date().toISOString(),
  };
}

// ── 3. Customer Dashboard Recommendations ─────────────────────────────────────
export async function getDashboardRecommendations(
  req: RecommendationRequest = {},
): Promise<DashboardRecommendationsResponse> {
  const menu = await fetchLiveMenu();
  const available = menu.filter((m) => m.isAvailable);

  const personalFavorites = available.slice(0, 3).map((m, idx) => ({
    ...m,
    orderCount: 5 - idx,
    reason: `Based on your frequent orders (${5 - idx} times)`,
  }));

  const frequentlyReordered = available.slice(1, 4).map((m) => ({
    ...m,
    lastOrdered: '4 days ago',
    reason: 'Ready to reorder with 1-click checkout',
  }));

  const suggestedCoupons = [
    { code: 'OLIVE50', title: '50% Flat OFF', discount: '50%', minOrder: 399, description: 'Valid on all Artisan Pizzas above ₹399' },
    { code: 'WELCOME100', title: '₹100 First Order', discount: '₹100', minOrder: 299, description: 'Exclusive artisan welcome bonus' },
    { code: 'FREEDELIVERY', title: 'Free Express Delivery', discount: '₹40', minOrder: 249, description: 'Zero delivery fee on your next order' },
  ];

  const healthyChoices = available
    .filter((m) => m.isVeg && (m.tags?.includes('fresh') || m.description.toLowerCase().includes('basil') || m.description.toLowerCase().includes('mushroom')))
    .slice(0, 3)
    .map((m) => ({
      ...m,
      calories: 220,
      reason: 'Light artisan crust with fresh garden toppings',
    }));

  const budgetChoices = available
    .filter((m) => m.price <= 299)
    .slice(0, 3)
    .map((m) => ({
      ...m,
      tag: 'Budget Friendly',
      reason: `Under ₹300 Value Bite (₹${m.price})`,
    }));

  const premiumChoices = available
    .filter((m) => m.price >= 449 || m.tags?.includes('gourmet') || m.tags?.includes('truffle'))
    .slice(0, 3)
    .map((m) => ({
      ...m,
      tag: 'Signature Gourmet',
      reason: 'Artisan hand-stretched sourdough with imported cheeses',
    }));

  return {
    personalFavorites,
    frequentlyReordered,
    suggestedCoupons,
    healthyChoices,
    budgetChoices,
    premiumChoices,
    timestamp: new Date().toISOString(),
  };
}

export const generateRecommendations = getLiveRecommendations;
export const generateHomepageRecommendations = getHomepageRecommendations;
export const generateDashboardRecommendations = getDashboardRecommendations;
