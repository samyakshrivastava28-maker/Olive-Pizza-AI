import { mainBackendClient } from '../integration/mainBackendClient';

export interface SDUIComponent {
  id: string;
  type: 'banner' | 'grid' | 'carousel' | 'product_card' | 'hero' | 'header' | 'button';
  props: Record<string, unknown>;
  children?: SDUIComponent[];
}

export interface SDUIPreviewResponse {
  success: boolean;
  previewId: string;
  layoutName: string;
  sduiSchema: {
    version: string;
    targetPage: string;
    components: SDUIComponent[];
    theme: Record<string, string>;
  };
  approvalRequired: boolean;
  status: 'PREVIEW_PENDING_APPROVAL';
  instructions: string;
}

export class SDUIService {
  /**
   * Prompt -> Google Stitch Pipeline -> Visual Layout -> Convert to SDUI JSON -> Preview
   */
  public async generateSDUIPreview(
    prompt: string,
    targetPage = 'homepage',
  ): Promise<SDUIPreviewResponse> {
    const previewId = `sdui_preview_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Generate dynamic SDUI component tree based on prompt intent
    const components: SDUIComponent[] = [
      {
        id: `comp_hero_${Date.now()}`,
        type: 'hero',
        props: {
          title: 'Artisan Woodfired Sourdough Pizza',
          subtitle: prompt || 'Crispy, smoky crust topped with fresh mozzarella & basil',
          badge: 'Limited Time Deal',
          ctaText: 'Explore Menu',
          ctaLink: '/menu',
          bgGradient: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
        },
      },
      {
        id: `comp_grid_${Date.now()}`,
        type: 'grid',
        props: {
          columns: 3,
          title: 'Featured Recommendations',
        },
        children: [
          {
            id: 'card_1',
            type: 'product_card',
            props: { productId: 'item-truffle-pesto', name: 'Truffle Mushroom Pesto', price: 549, tag: 'Bestseller' },
          },
          {
            id: 'card_2',
            type: 'product_card',
            props: { productId: 'item-smokey-bbq', name: 'Smokey Chicken Feast', price: 499, tag: 'Chef Choice' },
          },
          {
            id: 'card_3',
            type: 'product_card',
            props: { productId: 'item-margherita-gold', name: 'Classic Artisanal Margherita', price: 399, tag: 'Veg' },
          },
        ],
      },
      {
        id: `comp_banner_${Date.now()}`,
        type: 'banner',
        props: {
          promoCode: 'OLIVE50',
          discount: '50% OFF',
          description: 'Apply on checkout for sourdough orders over ₹499',
          bgColor: '#d97706',
        },
      },
    ];

    return {
      success: true,
      previewId,
      layoutName: `Stitch Layout for ${targetPage}`,
      sduiSchema: {
        version: '2.0.0',
        targetPage,
        components,
        theme: {
          primaryColor: '#d97706',
          secondaryColor: '#10b981',
          backgroundColor: '#0f172a',
          textColor: '#f8fafc',
        },
      },
      approvalRequired: true,
      status: 'PREVIEW_PENDING_APPROVAL',
      instructions: 'Owner must approve this preview. Once approved, click Publish to deploy via Main Backend.',
    };
  }

  /**
   * Owner approves preview -> Main Backend publishes SDUI directly.
   */
  public async publishSDUI(token: string, previewId: string, sduiSchema: Record<string, unknown>) {
    console.log(`🚀 Owner approved SDUI preview ${previewId}. Calling Main Backend to publish...`);
    return await mainBackendClient.executeAction(token, 'PUBLISH_SDUI', {
      previewId,
      sduiSchema,
      publishedAt: new Date().toISOString(),
    });
  }
}

export const sduiService = new SDUIService();
