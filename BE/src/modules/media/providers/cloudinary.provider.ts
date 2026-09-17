import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CONFIG } from 'src/constants/config.constant';

export interface UploadedFile {
  name: string;
  url: string;
}

/**
 * Cloudinary, as an alternative to S3.
 *
 * Exists because Cloudinary has a genuinely usable free tier and S3 does not
 * — which matters a great deal for a product whose first customers are small
 * distributors. The deployer picks with `MEDIA_PROVIDER`; both are fully
 * implemented for the operations this application actually performs.
 * CONTEXT.md D11.
 *
 * ## What this provider does *not* implement
 *
 * Presigned upload/download URLs. Those are an S3 concept that Cloudinary
 * models completely differently (signed upload parameters rather than a
 * pre-authorised URL), and nothing in BusinessOS uses them — the routes exist
 * on the media controller from the boilerplate. Rather than fake them, they
 * remain S3-only and say so. A half-working presigned URL would be a worse
 * outcome than an honest absence.
 */
@Injectable()
export class CloudinaryProvider {
  private readonly logger = new Logger(CloudinaryProvider.name);
  private configured = false;

  constructor(private readonly config: ConfigService) {
    this.configure();
  }

  private configure(): void {
    const cloudName = this.config.get<string>(CONFIG.CLOUDINARY_CLOUD_NAME);
    const apiKey = this.config.get<string>(CONFIG.CLOUDINARY_API_KEY);
    const apiSecret = this.config.get<string>(CONFIG.CLOUDINARY_API_SECRET);

    if (!cloudName || !apiKey || !apiSecret) return;

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Uploads a buffer.
   *
   * `upload_stream` rather than a base64 data URI: encoding a file to base64
   * inflates it by a third and holds the whole thing in memory twice, which
   * for a product-image upload on a small instance is a real cost.
   *
   * `resource_type: 'auto'` so PDFs and spreadsheets — supplier invoices —
   * upload as raw files rather than failing an image-format check.
   */
  async upload(
    path: string,
    file: Express.Multer.File,
  ): Promise<UploadedFile | null> {
    if (!this.configured) {
      this.logger.error(
        'Cloudinary is selected as MEDIA_PROVIDER but is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      );

      return null;
    }

    const folder = this.config.get<string>(CONFIG.CLOUDINARY_FOLDER);
    // Cloudinary derives the public id from the path, so the same folder
    // structure S3 uses is preserved and a later migration stays possible.
    const publicId = folder ? `${folder}/${path}` : path;

    try {
      return await new Promise<UploadedFile>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            resource_type: 'auto',
            // Overwrite rather than version: an avatar replaced at the same
            // path should return the same URL, or every cached reference to
            // it silently breaks.
            overwrite: true,
            invalidate: true,
          },
          (error, result) => {
            if (error || !result) {
              reject(
                error instanceof Error
                  ? error
                  : new Error('Cloudinary upload failed'),
              );
              return;
            }

            resolve({ name: result.public_id, url: result.secure_url });
          },
        );

        stream.end(file.buffer);
      });
    } catch (error) {
      this.logger.error(
        `Cloudinary upload failed for ${publicId}.`,
        error instanceof Error ? error.stack : undefined,
      );

      return null;
    }
  }

  async delete(publicId: string): Promise<boolean> {
    if (!this.configured) return false;

    const folder = this.config.get<string>(CONFIG.CLOUDINARY_FOLDER);
    const fullId =
      folder && !publicId.startsWith(`${folder}/`)
        ? `${folder}/${publicId}`
        : publicId;

    try {
      const result = await cloudinary.uploader.destroy(fullId, {
        invalidate: true,
      });

      // Cloudinary reports a missing asset as "not found" rather than as an
      // error. Treated as success: the caller's intent — that the file should
      // not exist — is satisfied either way.
      return result.result === 'ok' || result.result === 'not found';
    } catch (error) {
      this.logger.error(
        `Cloudinary delete failed for ${fullId}.`,
        error instanceof Error ? error.stack : undefined,
      );

      return false;
    }
  }
}
