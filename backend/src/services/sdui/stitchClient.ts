import https from 'node:https';
import { env } from '../../config/env';

export interface StitchScreen {
  id: string;
  name: string;
  title: string;
  prompt?: string;
  deviceType?: 'MOBILE' | 'DESKTOP' | 'TABLET' | 'AGNOSTIC';
  htmlCode?: {
    name: string;
    downloadUrl?: string;
    mimeType?: string;
  };
  screenshot?: {
    name: string;
    downloadUrl?: string;
  };
  designSystem?: Record<string, unknown>;
}

export interface StitchGenerationResult {
  screenId: string;
  screenTitle: string;
  screenResourceName: string;
  htmlCodeResource: string;
  screenshotResource: string;
  rawHtml: string;
  screenshotBase64?: string;
  designSystem?: Record<string, unknown>;
}

export class GoogleStitchClient {
  private readonly apiKey: string;
  private readonly defaultProjectId = '7981844069186888768'; // Olive Pizza Flagship Home Redesign
  private readonly endpoint = 'https://stitch.googleapis.com/mcp';
  private rpcId = 1;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.STITCH_API_KEY || '';
  }

  /**
   * Raw JSON-RPC tool caller to Google Stitch MCP Server
   */
  public async callMcpTool<T = any>(toolName: string, args: Record<string, unknown>, timeoutMs = 180000): Promise<T> {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: ++this.rpcId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    });

    return new Promise((resolve, reject) => {
      const url = new URL(this.endpoint);
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers: {
            'X-Goog-Api-Key': this.apiKey,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'User-Agent': 'OlivePizza-StitchClient/2.0',
          },
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
              return reject(
                new Error(
                  `Google Stitch HTTP ${res.statusCode}: ${data.substring(0, 500) || res.statusMessage || 'Unknown error'}`
                )
              );
            }

            try {
              const json = JSON.parse(data);
              if (json.error) {
                return reject(
                  new Error(
                    `Google Stitch MCP Error [${json.error.code}]: ${json.error.message || JSON.stringify(json.error)}`
                  )
                );
              }

              // Extract text content from MCP result format
              const text = json.result?.content?.[0]?.text;
              if (text) {
                try {
                  const parsed = JSON.parse(text);
                  return resolve(parsed as T);
                } catch {
                  return resolve(text as unknown as T);
                }
              }

              resolve(json.result as T);
            } catch (err: any) {
              reject(new Error(`Failed to parse Stitch response: ${err.message}. Raw: ${data.substring(0, 300)}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Google Stitch request timed out after ${timeoutMs / 1000}s. Stitch generation in progress.`));
      });

      req.on('error', (err) => {
        reject(new Error(`Google Stitch network failure: ${err.message}`));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Generates a new visual UI screen from text prompt using Google Stitch
   */
  public async generateScreenFromText(
    prompt: string,
    deviceType: 'MOBILE' | 'DESKTOP' | 'TABLET' = 'MOBILE',
    modelId: 'GEMINI_3_8_FLASH' | 'GEMINI_3_5_FLASH_LITE' = 'GEMINI_3_8_FLASH',
    projectId?: string
  ): Promise<StitchGenerationResult> {
    const targetProject = projectId || this.defaultProjectId;

    console.log(`[GoogleStitchClient] Dispatching screen generation for project ${targetProject} (Device: ${deviceType})...`);

    const result = await this.callMcpTool<any>('generate_screen_from_text', {
      projectId: targetProject,
      prompt,
      deviceType,
      modelId,
    });

    // Extract screen info from Stitch generation output
    const screens = result?.outputComponents?.[1]?.design?.screens || result?.screens || [];
    const screen = screens[0];

    if (!screen) {
      throw new Error(`Google Stitch completed generation but returned no screens in payload. Response: ${JSON.stringify(result).substring(0, 400)}`);
    }

    const screenId = screen.id;
    const screenTitle = screen.title || 'Olive Pizza Custom Screen';
    const screenResourceName = screen.name || `projects/${targetProject}/screens/${screenId}`;
    const htmlCodeResource = screen.htmlCode?.name;
    const screenshotResource = screen.screenshot?.name;

    if (!htmlCodeResource) {
      throw new Error(`Google Stitch screen ${screenId} contains no htmlCode resource reference.`);
    }

    // Download the raw HTML code generated by Stitch
    console.log(`[GoogleStitchClient] Downloading generated HTML from ${htmlCodeResource}...`);
    const fileResult = await this.callMcpTool<{ html?: string }>('download_file', {
      name: htmlCodeResource,
    });

    const rawHtml = fileResult?.html || '';
    if (!rawHtml) {
      throw new Error(`Google Stitch downloaded empty HTML code from ${htmlCodeResource}`);
    }

    return {
      screenId,
      screenTitle,
      screenResourceName,
      htmlCodeResource,
      screenshotResource: screenshotResource || '',
      rawHtml,
      designSystem: screen.designSystem || result?.outputComponents?.[0]?.designSystem,
    };
  }

  /**
   * Retrieves screen metadata
   */
  public async getScreen(screenResourceName: string): Promise<StitchScreen> {
    return await this.callMcpTool<StitchScreen>('get_screen', {
      name: screenResourceName,
    });
  }

  /**
   * Downloads a file (HTML code or screenshot image) from Google Stitch
   */
  public async downloadFile(fileResourceName: string): Promise<{ html?: string; image?: string; image_metadata?: Record<string, unknown> }> {
    return await this.callMcpTool('download_file', {
      name: fileResourceName,
    });
  }

  /**
   * Lists all existing screens in the project
   */
  public async listScreens(projectId?: string): Promise<{ screens: StitchScreen[] }> {
    const targetProject = projectId || this.defaultProjectId;
    // In Stitch MCP, list_screens returns screens directly
    return await this.callMcpTool('list_screens', {
      projectId: targetProject,
    });
  }
}

export const googleStitchClient = new GoogleStitchClient();
