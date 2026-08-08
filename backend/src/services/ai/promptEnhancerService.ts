export class PromptEnhancerService {
  /**
   * Enhances text prompts for LLMs with rich structure and system instructions
   */
  public enhanceTextPrompt(rawPrompt: string, targetPersona = 'customer'): { original: string; enhanced: string } {
    const enhanced = `You are Olive AI, the master intelligence assistant for Olive Pizza ecosystem. 
Context & Intent: ${rawPrompt}
Persona Target: ${targetPersona}

Instruction Guidelines:
1. Provide a warm, accurate, and highly engaging response.
2. Cross-reference woodfired sourdough pizza knowledge, artisanal toppings, and active promotional offers.
3. Ensure zero hallucination: recommend only items verified in the live catalog.
4. Format output using clean Markdown and structured actionable items.`;

    return { original: rawPrompt, enhanced };
  }

  /**
   * Enhances prompts for image generation models (FLUX.1-dev, Qwen Image, SD 3.5)
   */
  public enhanceImagePrompt(rawPrompt: string): { original: string; enhanced: string } {
    const enhanced = `Commercial professional food photography of ${rawPrompt}, artisan woodfired sourdough pizza with melted golden mozzarella, blistered leopard-spotted crust, fresh basil leaves, subtle garlic oil glaze, soft ambient warm lighting, shallow depth of field, 8k resolution, photorealistic, cinematic camera angle.`;

    return { original: rawPrompt, enhanced };
  }

  /**
   * Generates promotional email content for marketing campaigns
   */
  public generatePromotionalEmail(campaignTitle: string, targetAudience = 'VIP Customers') {
    return {
      subject: `🍕 Exclusive VIP Invitation: ${campaignTitle}`,
      html: `
        <div style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px;">
          <h1 style="color: #f59e0b;">Olive Pizza Artisan Experience</h1>
          <p>Hello valued pizza lover,</p>
          <p>We are thrilled to present <strong>${campaignTitle}</strong> tailored exclusively for our ${targetAudience}.</p>
          <div style="background: #1e293b; padding: 20px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px; font-weight: bold;">Use Code: <span style="color: #10b981;">OLIVEVIP50</span></p>
            <p style="margin: 5px 0 0 0; color: #94a3b8;">Get 50% OFF your next woodfired sourdough pizza order!</p>
          </div>
          <a href="https://olive-pizza.vercel.app/menu" style="background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Order Now</a>
        </div>
      `,
    };
  }

  /**
   * Explains monthly analytics and restaurant performance metrics
   */
  public explainAnalytics(metrics: { totalOrders?: number; revenue?: number; topItems?: string[]; customerRetention?: number }) {
    const orders = metrics.totalOrders ?? 1240;
    const revenue = metrics.revenue ?? 682000;
    const retention = metrics.customerRetention ?? 78.5;
    const topItems = metrics.topItems || ['Truffle Mushroom Pesto', 'Classic Margherita Gold', 'Garlic Sourdough Dip'];

    return {
      summary: `In the current billing cycle, Olive Pizza processed ${orders} orders generating ₹${revenue.toLocaleString()} in revenue with a ${retention}% customer retention rate.`,
      insights: [
        `Top Performing Item: ${topItems[0]} contributed to 34% of total pizza sales.`,
        `Repeat Customer Growth: Retention rate increased by +4.2% month-over-month.`,
        `Recommendation: Run a weekend bundle pairing ${topItems[0]} with ${topItems[2]} to increase average order value (AOV) by ~15%.`,
      ],
      suggestedActions: [
        { action: 'CREATE_BANNER', title: 'Promote Truffle Mushroom Weekend Combo' },
        { action: 'APPLY_COUPON', title: 'Launch Retention Coupon for Inactive Users' },
      ],
    };
  }
}

export const promptEnhancerService = new PromptEnhancerService();
