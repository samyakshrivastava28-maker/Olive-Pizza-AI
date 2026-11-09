export interface ActionPayload {
  type: 'OPEN_MENU' | 'OPEN_CART' | 'ADD_TO_CART' | 'OPEN_CHECKOUT' | 'LOGIN' | 'OPEN_OFFERS' | 'OPEN_PROFILE' | 'EXTERNAL_LINK';
  url?: string;
  productId?: string;
}

export interface SimplifiedSectionSchema {
  id: string;
  type:
    | 'HERO'
    | 'CATEGORIES'
    | 'CRAVINGS'
    | 'COUPONS'
    | 'ADS'
    | 'RECOMMENDATIONS'
    | 'DOWNLOAD_APP'
    | 'FEATURED'
    | 'VIDEO_HERO'
    | 'PIZZA_SHOWCASE'
    | 'TESTIMONIALS'
    | 'COUNTDOWN'
    | 'GALLERY'
    | 'ORDER_AGAIN'
    | 'COMPLETE_MEAL'
    | 'WHY_US'
    | 'DELIVERY_AREA'
    | 'CTA'
    | 'FOOTER';
  isHidden: boolean;
  config: {
    headline?: string;
    subtitle?: string;
    description?: string;
    buttonText?: string;
    buttonAction?: ActionPayload;
    secondaryButtonText?: string;
    secondaryButtonAction?: ActionPayload;
    mediaUrl?: string;
    mobileMediaUrl?: string;
    animationType?: string;
    animationSettings?: Record<string, unknown>;
    layout?: {
      contentAlignment?: 'left' | 'center' | 'right';
      contentWidth?: 'contained' | 'wide' | 'full';
      sectionHeight?: 'compact' | 'standard' | 'cinematic' | 'fullscreen';
      paddingY?: 'none' | 'small' | 'medium' | 'large';
    };
    styleOverrides?: {
      backgroundColor?: string;
      textColor?: string;
      paddingY?: 'none' | 'small' | 'medium' | 'large';
      borderRadius?: number;
      boxShadow?: string;
    };
    items?: Array<{
      id: string;
      name: string;
      price: number;
      description?: string;
      imageUrl?: string;
    }>;
    [key: string]: any;
  };
}

export interface CanonicalPageSchema {
  versionId: string;
  pageId: string;
  type: 'CUSTOM_SCHEMA';
  metadata: {
    name: string;
    description: string;
    publishedBy: string;
    publishedAt: string;
    themePreset?: 'Clean' | 'Pizza Energy' | 'Midnight Glow' | 'Minimal' | 'Bold Festival';
    typography?: {
      fontFamily: string;
      textAnimation?: string;
    };
    screenId?: string;
  };
  globalSettings?: {
    themePreset?: 'Clean' | 'Pizza Energy' | 'Midnight Glow' | 'Minimal' | 'Bold Festival';
    typography?: {
      fontFamily: string;
      textAnimation?: string;
    };
    primaryColor?: string;
    backgroundColor?: string;
    borderRadius?: number;
    reducedMotion?: boolean;
  };
  sections: SimplifiedSectionSchema[];
}

function stripHtml(input?: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export class StitchSDUIConverter {
  /**
   * Converts Google Stitch generated HTML and design system tokens into canonical PageSchema.
   */
  public convertHtmlToPageSchema(
    html: string,
    prompt: string,
    options: {
      screenId?: string;
      screenTitle?: string;
      designSystem?: Record<string, unknown>;
    } = {}
  ): CanonicalPageSchema {
    const timestamp = Date.now();
    const sections: SimplifiedSectionSchema[] = [];

    // Extract colors & fonts if present
    const primaryColorMatch = html.match(/"primary-container":\s*"(#[a-fA-F0-9]{6})"/i);
    const bgColorMatch = html.match(/"surface-container-lowest":\s*"(#[a-fA-F0-9]{6})"/i) || html.match(/background-color:\s*(#[a-fA-F0-9]{6})/i);
    const primaryColor = primaryColorMatch ? primaryColorMatch[1] : '#ff6b00';
    const backgroundColor = bgColorMatch ? bgColorMatch[1] : '#090a0f';

    // ── 1. Hero Section ─────────────────────────────────────────────────────────
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const heroSubtitleMatch = html.match(/<p class="[^"]*(?:text-body-lg|body-lg)[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const heroImgMatch = html.match(/<div class="[^"]*aspect-\[4\/5\][^"]*"[\s\S]*?<img[^>]+src=["']([^"']+)["']/i) ||
                         html.match(/<img[^>]+src=["']([^"']+)["']/i);
    const heroCtaMatch = html.match(/<a[^>]+href=["']#tasting-menus["'][^>]*>([\s\S]*?)<\/a>/i);

    sections.push({
      id: `sec_hero_${timestamp}`,
      type: 'HERO',
      isHidden: false,
      config: {
        headline: stripHtml(h1Match ? h1Match[1] : 'Forged in Flame. Born of the Stars.'),
        subtitle: stripHtml(heroSubtitleMatch ? heroSubtitleMatch[1] : 'Where 900-degree volcanic stone hearths ignite pristine vegetarian gastronomy.'),
        buttonText: stripHtml(heroCtaMatch ? heroCtaMatch[1] : 'Explore Midnight Tasting'),
        buttonAction: { type: 'OPEN_MENU' },
        secondaryButtonText: 'The Hearth Story',
        secondaryButtonAction: { type: 'OPEN_OFFERS' },
        mediaUrl: heroImgMatch ? heroImgMatch[1] : 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=900&q=80',
        animationType: 'Fade Up',
        layout: {
          contentAlignment: 'left',
          contentWidth: 'wide',
          sectionHeight: 'cinematic',
          paddingY: 'large',
        },
        styleOverrides: {
          backgroundColor,
          textColor: '#f8fafc',
        },
      },
    });

    // ── 2. Cravings / Customizer Section ───────────────────────────────────────
    const charH2 = html.match(/<section[^>]*id=["']crust-craft["'][\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const charP = html.match(/<section[^>]*id=["']crust-craft["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);

    sections.push({
      id: `sec_cravings_${timestamp + 1}`,
      type: 'CRAVINGS',
      isHidden: false,
      config: {
        headline: stripHtml(charH2 ? charH2[1] : 'Select Your Hearth Char Gradient'),
        subtitle: stripHtml(charP ? charP[1] : 'Every pizza is stone-baked to order. Calibrate your honeycomb crunch and smoky aroma.'),
        animationType: 'Fade',
        layout: {
          contentAlignment: 'center',
          paddingY: 'medium',
        },
        styleOverrides: {
          backgroundColor: '#121318',
        },
      },
    });

    // ── 3. Featured Showcase (Dishes Bento Grid) ───────────────────────────────
    const bentoH2 = html.match(/<section[^>]*id=["']tasting-menus["'][\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const bentoP = html.match(/<section[^>]*id=["']tasting-menus["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);

    // Extract item cards
    const dishCards = [...html.matchAll(/<div class="[^"]*obsidian-glass rounded-2xl overflow-hidden flex flex-col group[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi)];
    const items: Array<{ id: string; name: string; price: number; description?: string; imageUrl?: string }> = [];

    dishCards.forEach((c, idx) => {
      const dishH3 = c[0].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const dishPrice = c[0].match(/₹(\d+)/i);
      const dishDesc = c[0].match(/<p class="[^"]*font-body-sm[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      const dishImg = c[0].match(/<img[^>]+src=["']([^"']+)["']/i);
      if (dishH3) {
        items.push({
          id: `item_${idx + 1}`,
          name: stripHtml(dishH3[1]),
          price: dishPrice ? parseInt(dishPrice[1], 10) : 449,
          description: stripHtml(dishDesc ? dishDesc[1] : ''),
          imageUrl: dishImg ? dishImg[1] : '',
        });
      }
    });

    // Default fallback items if Stitch screen used a different structure
    if (items.length === 0) {
      items.push(
        { id: 'item_1', name: 'Royal Malai Paneer Tikka', price: 449, description: 'Saffron-tandoori marinade, roasted paprika, coriander essence', imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=700&q=80' },
        { id: 'item_2', name: 'Spicy Garden Celestial Fiesta', price: 399, description: 'Charred bell peppers, kalamata olives, house-fermented jalapeño drizzle', imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=700&q=80' },
        { id: 'item_3', name: 'Nebula Truffle & Fior di Latte', price: 599, description: 'Italian black summer truffles, buffalo mozzarella, edible 24k gold flakes', imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=700&q=80' }
      );
    }

    sections.push({
      id: `sec_featured_${timestamp + 2}`,
      type: 'FEATURED',
      isHidden: false,
      config: {
        headline: stripHtml(bentoH2 ? bentoH2[1] : 'Curated Hearth Masterpieces'),
        subtitle: stripHtml(bentoP ? bentoP[1] : '100% Pure Vegetarian Haute Gastronomy, zero contamination, cold-pressed pairings.'),
        buttonText: 'Order Tasting Menu',
        buttonAction: { type: 'OPEN_MENU' },
        items,
        animationType: 'Stagger',
        layout: {
          contentAlignment: 'center',
          contentWidth: 'wide',
          paddingY: 'large',
        },
      },
    });

    // ── 4. Philosophy & Craftsmanship Section ──────────────────────────────────
    const storyH2 = html.match(/<section[^>]*id=["']hearth-story["'][\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const storyP = html.match(/<section[^>]*id=["']hearth-story["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);

    sections.push({
      id: `sec_whyus_${timestamp + 3}`,
      type: 'WHY_US',
      isHidden: false,
      config: {
        headline: stripHtml(storyH2 ? storyH2[1] : 'Sacred Flames & Celestial Quietude'),
        subtitle: stripHtml(storyP ? storyP[1] : 'A three-day dialogue between Chhattisgarh mountain air, living wild yeast, and ancient volcanic masonry.'),
        animationType: 'Fade Up',
        layout: {
          contentAlignment: 'center',
          paddingY: 'large',
        },
      },
    });

    // ── 5. Mobile App Feature ──────────────────────────────────────────────────
    sections.push({
      id: `sec_app_${timestamp + 4}`,
      type: 'DOWNLOAD_APP',
      isHidden: false,
      config: {
        headline: 'Curate Your Midnight Table on iOS & Android',
        subtitle: 'Experience live 3-second delivery tracking, exclusive chef reserves, and priority table reservations.',
        buttonText: 'Download Android App',
        buttonAction: { type: 'EXTERNAL_LINK', url: 'https://play.google.com/store' },
        secondaryButtonText: 'Download iOS App',
        secondaryButtonAction: { type: 'EXTERNAL_LINK', url: 'https://apps.apple.com' },
        animationType: 'Fade Up',
      },
    });

    // ── 6. Luxury Footer ───────────────────────────────────────────────────────
    sections.push({
      id: `sec_footer_${timestamp + 5}`,
      type: 'FOOTER',
      isHidden: false,
      config: {
        headline: 'Olive Pizza • 100% Pure Veg Artisanal Hearth',
        description: 'Rajnandgaon, Chhattisgarh. Stone baked with love.',
      },
    });

    return {
      versionId: `v_stitch_${timestamp}`,
      pageId: `stitch_design_${timestamp}`,
      type: 'CUSTOM_SCHEMA',
      metadata: {
        name: options.screenTitle || 'Midnight Galaxy Woodfired Showcase (Stitch Generated)',
        description: prompt,
        publishedBy: 'Google Stitch AI Pipeline',
        publishedAt: new Date().toISOString(),
        themePreset: 'Midnight Glow',
        typography: {
          fontFamily: 'Playfair Display',
          textAnimation: 'Fade Up',
        },
        screenId: options.screenId,
      },
      globalSettings: {
        themePreset: 'Midnight Glow',
        primaryColor,
        backgroundColor,
        borderRadius: 12,
        reducedMotion: false,
      },
      sections,
    };
  }
}

export const stitchSDUIConverter = new StitchSDUIConverter();
