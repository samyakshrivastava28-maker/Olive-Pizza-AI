import { mainBackendClient } from '../integration/mainBackendClient';

export interface ImageGenerationPreview {
  success: boolean;
  imageId: string;
  modelUsed: string;
  prompt: string;
  previewUrl: string;
  approvalRequired: boolean;
  status: 'PREVIEW_PENDING_APPROVAL';
  instructions: string;
}

export class ImageService {
  /**
   * Generate -> Preview -> Owner approves -> Main Backend uploads to Cloudinary
   */
  public async generateImagePreview(
    prompt: string,
    model = 'flux-1-dev',
  ): Promise<ImageGenerationPreview> {
    const imageId = `img_preview_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Generate high quality mock preview URL representing FLUX.1 / Qwen Image generation
    const encodedPrompt = encodeURIComponent(prompt.slice(0, 100));
    const previewUrl = `https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80&prompt=${encodedPrompt}`;

    return {
      success: true,
      imageId,
      modelUsed: model,
      prompt,
      previewUrl,
      approvalRequired: true,
      status: 'PREVIEW_PENDING_APPROVAL',
      instructions: 'Image preview generated. Owner must approve before Main Backend uploads to Cloudinary.',
    };
  }

  /**
   * Owner approves -> Main Backend uploads to Cloudinary
   */
  public async approveAndUploadImage(
    token: string,
    imageId: string,
    previewUrl: string,
    bannerMetadata?: Record<string, unknown>,
  ) {
    console.log(`🖼️ Owner approved image ${imageId}. Requesting Main Backend Cloudinary upload...`);
    return await mainBackendClient.executeAction(token, 'CREATE_BANNER', {
      imageId,
      previewUrl,
      bannerMetadata,
      approvedAt: new Date().toISOString(),
    });
  }
}

export const imageService = new ImageService();
