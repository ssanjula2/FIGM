export interface StoredFileResult {
  fileName: string;
  format: 'PDF' | 'JSON' | 'CSV' | 'MARKDOWN';
  downloadUrl: string;
  storageProvider: 'supabase' | 'local';
}

export class SupabaseFileService {
  private client: any = null;
  private bucketName = 'figm-reports';

  constructor() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        this.client = createClient(url, key);
      } catch {
        this.client = null;
      }
    }
  }

  public async uploadReport(
    fileName: string,
    content: string | Buffer,
    format: 'PDF' | 'JSON' | 'CSV' | 'MARKDOWN',
    contentType = 'application/json'
  ): Promise<StoredFileResult> {
    const filePath = `reports/${Date.now()}_${fileName}`;

    if (this.client) {
      try {
        const { error } = await this.client.storage.from(this.bucketName).upload(filePath, content, {
          contentType,
          upsert: true,
        });

        if (!error) {
          const { data } = await this.client.storage.from(this.bucketName).createSignedUrl(filePath, 3600);
          if (data?.signedUrl) {
            return {
              fileName,
              format,
              downloadUrl: data.signedUrl,
              storageProvider: 'supabase',
            };
          }
        }
      } catch {
        // Fallback
      }
    }

    const dataUrl = `data:${contentType};base64,${Buffer.from(content).toString('base64')}`;
    return {
      fileName,
      format,
      downloadUrl: dataUrl,
      storageProvider: 'local',
    };
  }
}

export const supabaseFileService = new SupabaseFileService();
