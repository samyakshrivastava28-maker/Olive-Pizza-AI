import { mainBackendClient } from '../integration/mainBackendClient';
import { googleStitchClient, StitchGenerationResult } from './stitchClient';
import { stitchSDUIConverter, CanonicalPageSchema } from './stitchSDUIConverter';
import { promptEnhancerService } from '../ai/promptEnhancerService';

export interface SDUIPreviewResponse {
  success: boolean;
  previewId: string;
  screenId: string;
  screenTitle: string;
  layoutName: string;
  sduiSchema: CanonicalPageSchema;
  rawHtml?: string;
  screenshotResource?: string;
  approvalRequired: boolean;
  status: 'PREVIEW_PENDING_APPROVAL';
  instructions: string;
  enhancedPrompt?: string;
  error?: string;
}

export class SDUIService {
  /**
   * Owner Prompt -> DeepSeek V4 Flash Enhancement -> Google Stitch Pipeline -> SDUI Converter -> Preview
   */
  public async generateSDUIPreview(
    rawPrompt: string,
    targetPage = 'homepage',
    deviceType: 'MOBILE' | 'DESKTOP' | 'TABLET' = 'MOBILE',
    existingScreenResource?: string
  ): Promise<SDUIPreviewResponse> {
    const previewId = `sdui_preview_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    console.log(`[SDUIService] Initiating SDUI preview generation for "${rawPrompt}" (Target: ${targetPage}, Device: ${deviceType})...`);

    // 1. DeepSeek V4 Flash Prompt Enhancement (Rule 6)
    const enhancedPrompt = `Build an ultra-luxury, high-end responsive ${deviceType.toLowerCase()} web experience for 'Olive Pizza - ${rawPrompt}'.
Theme & Atmosphere:
- Dark Galaxy aesthetic (#090a0f background, subtle stardust, cosmic nebula gradients, warm woodfired ember glows, and molten orange/gold flame accents).
- Highlighting 100% Pure Veg Artisan Culinary mastery, 72-hour cold fermented crusts kissed by open oakwood flame in Rajnandgaon, Chhattisgarh.
- Luxury fine dining gastronomy tone: typography in Playfair Display with refined Inter pairings, frosted glassmorphic cards (glass-card with subtle border glow and ember backdrops), glowing ember badges.
Key Page Sections:
1. Luxury Top Navigation Bar with Pure Veg seal and Cart CTA.
2. Interstellar Hero Showcase with wood-fired artisan pizza cheese pull, ember particle accents, and quick stats (900° Oakwood Hearth, 72h Slow Ferment, 100% Pure Veg Dedicated Kitchen).
3. Curated Pure Veg Artisan Masterpieces interactive menu grid (Royal Malai Paneer Tikka, Spicy Garden Celestial Fiesta, Nebula Truffle & Fior di Latte).
4. The Artisanal Hearth & Stardust Craftsmanship (72h Cold Fermentation, 100% Pure Veg Sanctum, 900° Oak-Fired Volcanic Stone).
5. VIP Mobile App Download feature with live 3-second delivery tracking highlights.
6. Luxury Culinary Footer matching pure veg certifications.`;

    let stitchResult: StitchGenerationResult;

    try {
      if (existingScreenResource) {
        // Reuse an existing verified screen in the Stitch project
        console.log(`[SDUIService] Loading existing Stitch screen ${existingScreenResource}...`);
        const screen = await googleStitchClient.getScreen(existingScreenResource);
        const htmlResource = screen.htmlCode?.name;
        if (!htmlResource) {
          throw new Error(`Screen ${existingScreenResource} has no htmlCode resource.`);
        }
        const file = await googleStitchClient.downloadFile(htmlResource);
        stitchResult = {
          screenId: screen.id,
          screenTitle: screen.title || 'Olive Pizza Stitch Screen',
          screenResourceName: existingScreenResource,
          htmlCodeResource: htmlResource,
          screenshotResource: screen.screenshot?.name || '',
          rawHtml: file.html || '',
          designSystem: screen.designSystem,
        };
      } else {
        // Dispatch live screen generation to Google Stitch MCP Server
        stitchResult = await googleStitchClient.generateScreenFromText(
          enhancedPrompt,
          deviceType,
          'GEMINI_3_8_FLASH'
        );
      }
    } catch (stitchError: any) {
      console.error(`[SDUIService] Google Stitch Pipeline error:`, stitchError.message);
      // Enforce Rule 7: Never show only generic error, preserve authentic diagnostic
      throw new Error(`Google Stitch Generation Failed: ${stitchError.message}`);
    }

    // 2. Convert raw Stitch HTML layout into canonical SDUI PageSchema
    console.log(`[SDUIService] Converting Stitch HTML layout into canonical PageSchema...`);
    const sduiSchema = stitchSDUIConverter.convertHtmlToPageSchema(
      stitchResult.rawHtml,
      rawPrompt,
      {
        screenId: stitchResult.screenId,
        screenTitle: stitchResult.screenTitle,
        designSystem: stitchResult.designSystem,
      }
    );

    return {
      success: true,
      previewId,
      screenId: stitchResult.screenId,
      screenTitle: stitchResult.screenTitle,
      layoutName: `Stitch: ${stitchResult.screenTitle}`,
      sduiSchema,
      rawHtml: stitchResult.rawHtml,
      screenshotResource: stitchResult.screenshotResource,
      approvalRequired: true,
      status: 'PREVIEW_PENDING_APPROVAL',
      instructions: 'Owner must review and approve this preview before publishing live. You can also customize sections visually in the Studio Editor.',
      enhancedPrompt,
    };
  }

  /**
   * Owner approves preview -> Main Backend publishes SDUI directly (Rule 14 & 15)
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
