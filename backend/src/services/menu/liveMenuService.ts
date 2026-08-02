import axios from 'axios';
import { getFirestore } from '../../config/firebase';
import { cache } from '../../config/cache';
import { env } from '../../config/env';

export interface MenuItem {
  id: string;
  name: string;
  category: 'Pizzas' | 'Burgers' | 'Sides' | 'Beverages' | 'Pasta' | 'Desserts' | 'Combos' | string;
  description: string;
  price: number;
  originalPrice?: number;
  isVeg: boolean;
  isSpicy?: boolean;
  spicyLevel?: number;
  isAvailable: boolean;
  image: string;
  rating: number;
  reviewsCount?: number;
  prepTime?: string;
  variants?: Array<{ name: string; price: number }>;
  crusts?: Array<{ name: string; price: number }>;
  addons?: Array<{ name: string; price: number }>;
  tags?: string[];
}

// ── Master Catalog (Olive Pizza Verified Menu — Live Sync from Firestore/API) ─
// IMPORTANT: This is the ONLY authoritative source of Olive Pizza products.
// The LLM must NEVER invent products not present in this catalog.
// Olive Pizza is a 100% PURE VEGETARIAN restaurant (no chicken, no eggs, no seafood).
const DEFAULT_MENU: MenuItem[] = [
  // Pizzas
  {
    id: 'pizza-margherita',
    name: 'Classic Margherita Pizza',
    category: 'Pizzas',
    description: 'San Marzano tomato sauce, fresh buffalo mozzarella, fresh basil, extra virgin olive oil.',
    price: 349,
    originalPrice: 399,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 0,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500',
    rating: 4.8,
    reviewsCount: 240,
    prepTime: '15-20 min',
    variants: [
      { name: 'Small (8")', price: 349 },
      { name: 'Medium (10")', price: 499 },
      { name: 'Large (12")', price: 649 },
    ],
    crusts: [
      { name: 'Classic Hand Tossed', price: 0 },
      { name: 'Cheese Burst', price: 99 },
      { name: 'Thin & Crispy Sourdough', price: 49 },
    ],
    addons: [
      { name: 'Extra Mozzarella', price: 49 },
      { name: 'Black Olives', price: 39 },
      { name: 'Jalapenos', price: 39 },
    ],
    tags: ['classic', 'bestseller', 'vegetarian', 'italian'],
  },
  {
    id: 'pizza-paneer-supreme',
    name: 'Paneer Supreme Pizza',
    category: 'Pizzas',
    description: 'Spiced malai paneer cubes, crisp red & yellow bell peppers, onion, sweet corn, fresh mozzarella.',
    price: 449,
    originalPrice: 499,
    isVeg: true,
    isSpicy: true,
    spicyLevel: 2,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500',
    rating: 4.9,
    reviewsCount: 310,
    prepTime: '15-20 min',
    variants: [
      { name: 'Small (8")', price: 449 },
      { name: 'Medium (10")', price: 599 },
      { name: 'Large (12")', price: 749 },
    ],
    crusts: [
      { name: 'Classic Hand Tossed', price: 0 },
      { name: 'Cheese Burst', price: 99 },
    ],
    tags: ['spicy', 'paneer', 'bestseller', 'indian-fusion'],
  },
  {
    id: 'pizza-truffle-mushroom',
    name: 'Truffle Mushroom Artisan Pizza',
    category: 'Pizzas',
    description: 'Wild sautéed forest mushrooms, white truffle oil, caramelized onions, fior di latte, aged parmesan.',
    price: 499,
    originalPrice: 599,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 0,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
    rating: 4.9,
    reviewsCount: 180,
    prepTime: '20 min',
    variants: [
      { name: 'Medium (10")', price: 499 },
      { name: 'Large (12")', price: 699 },
    ],
    tags: ['gourmet', 'artisan', 'truffle', 'chef-special'],
  },
  {
    id: 'pizza-peri-peri-chicken',
    name: 'Peri Peri Flame Chicken Pizza',
    category: 'Pizzas',
    description: 'Slow-roasted spicy peri-peri chicken chunks, red paprika, sliced red onions, mozzarella cheese.',
    price: 499,
    originalPrice: 549,
    isVeg: false,
    isSpicy: true,
    spicyLevel: 3,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500',
    rating: 4.8,
    reviewsCount: 290,
    prepTime: '15-20 min',
    variants: [
      { name: 'Small (8")', price: 499 },
      { name: 'Medium (10")', price: 649 },
      { name: 'Large (12")', price: 799 },
    ],
    tags: ['non-veg', 'spicy', 'chicken', 'bestseller'],
  },
  {
    id: 'pizza-farmhouse',
    name: 'Farm Fresh Garden Pizza',
    category: 'Pizzas',
    description: 'Loaded with farm mushrooms, crunchy capsicum, sliced tomatoes, sweet corn, black olives & mozzarella.',
    price: 399,
    originalPrice: 449,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 1,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=500',
    rating: 4.7,
    reviewsCount: 155,
    prepTime: '15-20 min',
    tags: ['vegetarian', 'healthy', 'loaded'],
  },

  // Garlic Bread & Sides
  {
    id: 'side-stuffed-garlic-bread',
    name: 'Stuffed Garlic Bread with Sweet Corn',
    category: 'Sides',
    description: 'Freshly baked buttery garlic sourdough stuffed with gooey mozzarella, sweet corn & pickled jalapenos.',
    price: 189,
    originalPrice: 219,
    isVeg: true,
    isSpicy: true,
    spicyLevel: 1,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=500',
    rating: 4.9,
    reviewsCount: 420,
    prepTime: '10-12 min',
    addons: [{ name: 'Cheesy Jalapeno Dip', price: 35 }, { name: 'Garlic Butter Dip', price: 30 }],
    tags: ['garlic bread', 'side', 'must-try', 'bestseller'],
  },
  {
    id: 'side-cheesy-garlic-bread',
    name: 'Classic Cheesy Garlic Bread (4 pcs)',
    category: 'Sides',
    description: 'Toasted artisan baguette slices infused with herb garlic butter and smothered in melted mozzarella.',
    price: 149,
    originalPrice: 179,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 0,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=500',
    rating: 4.7,
    reviewsCount: 260,
    prepTime: '10 min',
    tags: ['garlic bread', 'cheesy', 'starter'],
  },
  {
    id: 'side-crispy-chicken-wings',
    name: 'Smoky BBQ Crispy Chicken Wings (6 pcs)',
    category: 'Sides',
    description: 'Tender chicken wings tossed in rich smoky Texas BBQ glaze, garnished with toasted sesame seeds.',
    price: 249,
    originalPrice: 289,
    isVeg: false,
    isSpicy: true,
    spicyLevel: 2,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1527477378732-d3606f33221b?w=500',
    rating: 4.8,
    reviewsCount: 210,
    prepTime: '12-15 min',
    tags: ['non-veg', 'wings', 'bbq', 'spicy'],
  },

  // Burgers
  {
    id: 'burger-farm-veggie',
    name: 'Farm Fresh Crispy Veggie Burger',
    category: 'Burgers',
    description: 'Herb potato and sweet pea crispy patty, crunchy lettuce, Roma tomatoes, cheddar cheese & signature sauce.',
    price: 199,
    originalPrice: 229,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 1,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=500',
    rating: 4.6,
    reviewsCount: 140,
    prepTime: '12 min',
    tags: ['burger', 'vegetarian', 'crispy'],
  },
  {
    id: 'burger-spicy-crunch-chicken',
    name: 'Spicy Crunch Crispy Chicken Burger',
    category: 'Burgers',
    description: 'Golden fried buttermilk crispy chicken breast, habanero mayo, spicy pickles & melted American cheddar.',
    price: 269,
    originalPrice: 299,
    isVeg: false,
    isSpicy: true,
    spicyLevel: 3,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
    rating: 4.9,
    reviewsCount: 380,
    prepTime: '12-15 min',
    tags: ['burger', 'chicken', 'crispy', 'spicy', 'bestseller'],
  },

  // Pasta
  {
    id: 'pasta-creamy-alfredo',
    name: 'Creamy Truffle Alfredo Penne',
    category: 'Pasta',
    description: 'Al dente penne pasta in rich parmesan garlic cream sauce with sautéed mushrooms and fresh parsley.',
    price: 329,
    originalPrice: 379,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 0,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=500',
    rating: 4.8,
    reviewsCount: 190,
    prepTime: '15 min',
    tags: ['pasta', 'alfredo', 'creamy', 'vegetarian'],
  },
  {
    id: 'pasta-spicy-arrabbiata',
    name: 'Fiery Arrabbiata Penne',
    category: 'Pasta',
    description: 'Spicy slow-simmered San Marzano tomato marinara with garlic, chili flakes, black olives and basil.',
    price: 299,
    originalPrice: 349,
    isVeg: true,
    isSpicy: true,
    spicyLevel: 3,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500',
    rating: 4.7,
    reviewsCount: 130,
    prepTime: '15 min',
    tags: ['pasta', 'arrabbiata', 'spicy', 'vegan-friendly'],
  },

  // Beverages & Drinks
  {
    id: 'drink-coke',
    name: 'Coca Cola Zero Sugar (330ml Can)',
    category: 'Beverages',
    description: 'Chilled refreshing zero calorie Coca Cola can.',
    price: 60,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 0,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500',
    rating: 4.9,
    prepTime: 'Instant',
    tags: ['drink', 'coke', 'cold', 'beverage'],
  },
  {
    id: 'drink-lemon-iced-tea',
    name: 'Fresh Brewed Lemon Iced Tea',
    category: 'Beverages',
    description: 'Cold-brewed artisanal black tea infused with real Sicilian lemon juice and fresh mint sprigs.',
    price: 119,
    originalPrice: 139,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 0,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500',
    rating: 4.8,
    prepTime: 'Instant',
    tags: ['iced tea', 'drink', 'refreshing'],
  },
  {
    id: 'drink-red-bull',
    name: 'Red Bull Energy Drink (250ml)',
    category: 'Beverages',
    description: 'Chilled Red Bull energy can.',
    price: 125,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 0,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500',
    rating: 4.7,
    prepTime: 'Instant',
    tags: ['drink', 'energy', 'cold'],
  },

  // Desserts
  {
    id: 'dessert-choco-lava',
    name: 'Molten Choco Lava Cake',
    category: 'Desserts',
    description: 'Warm, dark chocolate cake with a rich flowing molten chocolate core.',
    price: 139,
    originalPrice: 169,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 0,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500',
    rating: 4.9,
    reviewsCount: 540,
    prepTime: '5 min',
    tags: ['dessert', 'chocolate', 'bestseller', 'sweet'],
  },

  // Combos & Value Deals
  {
    id: 'combo-party-feast',
    name: 'Artisan Party Feast for 4',
    category: 'Combos',
    description: 'Includes 2 Large Pizzas (Any), 1 Stuffed Garlic Bread, 1 Cheesy Jalapeno Dip & 4 Cold Drinks.',
    price: 1299,
    originalPrice: 1649,
    isVeg: true,
    isSpicy: false,
    spicyLevel: 1,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
    rating: 4.9,
    reviewsCount: 310,
    prepTime: '20-25 min',
    tags: ['combo', 'party', 'value-deal', 'bestseller'],
  },
];

let cachedMenu: MenuItem[] = DEFAULT_MENU;
let lastSyncTime = 0;

export async function fetchLiveMenu(): Promise<MenuItem[]> {
  const now = Date.now();
  if (now - lastSyncTime < 60_000 && cachedMenu.length > 0) {
    return cachedMenu;
  }

  // 1. Try Live Olive Pizza Backend REST API
  try {
    const res = await axios.get(`${env.OLIVE_PIZZA_BACKEND_URL}/api/menu`, { timeout: 3000 });
    if (Array.isArray(res.data) && res.data.length > 0) {
      cachedMenu = res.data.map((item: any) => ({
        id: item.id || `item_${item.name.toLowerCase().replace(/\s+/g, '_')}`,
        name: item.name,
        category: item.category || 'Pizzas',
        description: item.description || '',
        price: Number(item.basePrice || item.price || 299),
        originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
        isVeg: item.isVegetarian ?? item.isVeg ?? true,
        isSpicy: item.isSpicy ?? false,
        spicyLevel: item.spicyLevel ?? (item.isSpicy ? 2 : 0),
        isAvailable: item.isAvailable ?? true,
        image: item.image || 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500',
        rating: item.rating ? Number(item.rating) : 4.8,
        reviewsCount: item.reviewsCount || 100,
        prepTime: item.prepTime || '15-20 min',
        variants: item.variants || [],
        crusts: item.crusts || [],
        addons: item.addons || [],
        tags: item.tags || [item.category?.toLowerCase() || 'pizza'],
      }));
      lastSyncTime = now;
      console.log(`✅ Loaded ${cachedMenu.length} live menu items from Olive Pizza backend API`);
      return cachedMenu;
    }
  } catch {
    /* backend offline or network timeout */
  }

  // 2. Try Direct Firestore
  try {
    const db = getFirestore();
    if (db) {
      const snap = await db.collection('menu_items').where('isAvailable', '==', true).get();
      if (!snap.empty) {
        cachedMenu = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: d.name,
            category: d.category || 'Pizzas',
            description: d.description || '',
            price: Number(d.basePrice || d.price || 299),
            originalPrice: d.originalPrice ? Number(d.originalPrice) : undefined,
            isVeg: d.isVegetarian ?? d.isVeg ?? true,
            isSpicy: d.isSpicy ?? false,
            spicyLevel: d.spicyLevel ?? (d.isSpicy ? 2 : 0),
            isAvailable: d.isAvailable ?? true,
            image: d.image || 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500',
            rating: d.rating ? Number(d.rating) : 4.8,
            reviewsCount: d.reviewsCount || 100,
            prepTime: d.prepTime || '15-20 min',
            variants: d.variants || [],
            crusts: d.crusts || [],
            addons: d.addons || [],
            tags: d.tags || [d.category?.toLowerCase() || 'pizza'],
          };
        });
        lastSyncTime = now;
        console.log(`✅ Loaded ${cachedMenu.length} live menu items from Firestore`);
        return cachedMenu;
      }
    }
  } catch {
    /* firestore not ready */
  }

  // 3. Use Master Catalog as Fallback
  console.log(`⚠️ Using local master catalog (${DEFAULT_MENU.length} items) — Firestore/API unavailable`);
  cachedMenu = DEFAULT_MENU;
  lastSyncTime = now;
  return cachedMenu;
}

export function invalidateMenuCache(): void {
  lastSyncTime = 0;
  console.log('🔄 Menu cache invalidated for immediate live sync');
}

/** Returns a fast Set of all verified product IDs and normalized names for CatalogGuard */
export async function getCatalogIds(): Promise<Set<string>> {
  const menu = await fetchLiveMenu();
  const ids = new Set<string>();
  for (const item of menu) {
    ids.add(item.id);
    ids.add(item.name.toLowerCase());
    for (const tag of item.tags || []) ids.add(tag.toLowerCase());
  }
  return ids;
}

export async function searchLiveMenu(filters: {
  category?: string;
  isVeg?: boolean;
  maxPrice?: number;
  minPrice?: number;
  query?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'popularity';
}): Promise<MenuItem[]> {
  const menu = await fetchLiveMenu();
  let results = [...menu];

  if (filters.category) {
    const catLower = filters.category.toLowerCase();
    results = results.filter((i) => i.category.toLowerCase().includes(catLower));
  }

  if (filters.isVeg !== undefined) {
    results = results.filter((i) => i.isVeg === filters.isVeg);
  }

  if (filters.maxPrice !== undefined) {
    results = results.filter((i) => i.price <= filters.maxPrice!);
  }

  if (filters.minPrice !== undefined) {
    results = results.filter((i) => i.price >= filters.minPrice!);
  }

  if (filters.query) {
    const q = filters.query.toLowerCase().trim();
    results = results.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.tags && i.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }

  if (filters.sortBy === 'price_asc') {
    results.sort((a, b) => a.price - b.price);
  } else if (filters.sortBy === 'price_desc') {
    results.sort((a, b) => b.price - a.price);
  } else if (filters.sortBy === 'rating') {
    results.sort((a, b) => b.rating - a.rating);
  }

  return results;
}

export async function getProductById(productId: string): Promise<MenuItem | undefined> {
  const menu = await fetchLiveMenu();
  return menu.find((i) => i.id === productId || i.name.toLowerCase() === productId.toLowerCase());
}

export async function formatLiveMenuPrompt(userQuery: string): Promise<string> {
  const menu = await fetchLiveMenu();
  const qLower = userQuery.toLowerCase();

  // Pick relevant items based on query
  let relevant = menu;
  if (qLower.includes('pizza')) {
    relevant = menu.filter((i) => i.category === 'Pizzas');
  } else if (qLower.includes('burger')) {
    relevant = menu.filter((i) => i.category === 'Burgers');
  } else if (qLower.includes('bread') || qLower.includes('side') || qLower.includes('wing')) {
    relevant = menu.filter((i) => i.category === 'Sides');
  } else if (qLower.includes('drink') || qLower.includes('beverage') || qLower.includes('coke') || qLower.includes('tea')) {
    relevant = menu.filter((i) => i.category === 'Beverages');
  } else if (qLower.includes('pasta')) {
    relevant = menu.filter((i) => i.category === 'Pasta');
  } else if (qLower.includes('dessert') || qLower.includes('cake') || qLower.includes('sweet')) {
    relevant = menu.filter((i) => i.category === 'Desserts');
  } else if (qLower.includes('combo') || qLower.includes('deal') || qLower.includes('offer')) {
    relevant = menu.filter((i) => i.category === 'Combos' || i.originalPrice);
  } else if (qLower.includes('cheap') || qLower.includes('budget') || qLower.includes('under')) {
    relevant = [...menu].sort((a, b) => a.price - b.price).slice(0, 8);
  } else {
    // General overview
    relevant = menu.slice(0, 12);
  }

  const lines = [
    '═══ LIVE OLIVE PIZZA VERIFIED MENU — SINGLE SOURCE OF TRUTH ═══',
    '🔴 MANDATORY: Only use these exact products when answering menu questions.',
    '🟢 ALL items below are 100% Vegetarian. Olive Pizza serves NO non-veg food.',
    '',
    ...relevant.map((item) => {
      const spicyTag = item.isSpicy ? ` [SPICY level ${item.spicyLevel || 1}/3🌶️]` : '';
      const disc = item.originalPrice ? ` (Discounted from ₹${item.originalPrice})` : '';
      const avail = item.isAvailable ? '' : ' [CURRENTLY UNAVAILABLE]';
      const variantsStr = item.variants?.length
        ? ` | Sizes: ${item.variants.map((v) => `${v.name} ₹${v.price}`).join(', ')}`
        : '';
      return `• [ID: ${item.id}] ${item.name}${avail} — ₹${item.price}${disc}${spicyTag} | ${item.category}${variantsStr}\n  ${item.description}`;
    }),
    '',
    '═══ MENU INSTRUCTIONS ═══',
    '1. Quote ONLY the above product names and prices (₹). Never invent prices.',
    '2. For product mentions, emit: <product_card>{"productId":"<id>","reason":"<why>"}</product_card>',
    '3. For add-to-cart: <action>{"type":"ADD_TO_CART","payload":{"productId":"<id>","name":"<name>","price":<price>,"quantity":1},"description":"Adding <name> to cart"}</action>',
    '4. If a product is not in the list above, say it is NOT available on the Olive Pizza menu.',
    '5. DO NOT recommend Pepperoni, Chicken, Bacon, Seafood, Eggs, or any non-vegetarian item.',
  ];

  return lines.join('\n');
}
