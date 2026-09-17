import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';

import { SerializeHttpError } from 'src/utils/serializer';
import { EMAIL_BRAND } from '../constants/email-brand.constant';
import { EMAIL_ERRORS } from '../constants/api-response/email.response';
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from '../providers/email-provider.interface';
import { CONFIG } from '../constants/config';
import { CONFIG as APP_CONFIG } from 'src/constants/config.constant';
import { formatEmailTemplateContext } from '../utils/email-display-name.util';
import { normalizeEmailAddress } from 'src/utils/email-address.util';
import { MediaService } from 'src/modules/media/media.service';
import { FOLDER_NAME } from 'src/modules/media/constants/media.constant';

const LOGO_CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private logoBase64: string | null = null;
  private logoUrlPromise: Promise<string | null> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly mediaService: MediaService,
    // The one provider this build ships, chosen by EMAIL_PROVIDER. This service
    // never names a vendor: templating and branding are the same whoever sends.
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  private resolveLogoFilePath(): string | null {
    const relative = EMAIL_BRAND.logoPath;
    const candidates = [
      path.resolve(process.cwd(), relative),
      path.resolve(process.cwd(), 'dist', relative),
      path.resolve(__dirname, '../../../email-templates/assets/noLogo.png'),
      path.resolve(__dirname, '../../email-templates/assets/noLogo.png'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private getLogoBase64(): string | null {
    if (this.logoBase64) {
      return this.logoBase64;
    }

    const logoPath = this.resolveLogoFilePath();
    if (!logoPath) {
      this.logger.warn(
        'Email logo file not found. Set EMAIL_LOGO_URL to a public HTTPS image URL.',
      );
      return null;
    }

    const logoBuffer = fs.readFileSync(logoPath);
    this.logoBase64 = logoBuffer.toString('base64');
    return this.logoBase64;
  }

  /**
   * Uploads the local brand logo to S3 once per process and caches the resulting
   * public URL, so repeated email sends don't re-upload the same file.
   */
  private async uploadLogoToS3(): Promise<string | null> {
    const logoPath = this.resolveLogoFilePath();
    if (!logoPath) {
      return null;
    }

    const buffer = fs.readFileSync(logoPath);
    const extension = path.extname(logoPath).toLowerCase();
    const mimetype =
      LOGO_CONTENT_TYPES[extension] ?? 'application/octet-stream';
    const key = `${FOLDER_NAME.EMAIL_ASSETS}/${path.basename(logoPath)}`;

    const file = { buffer, mimetype } as unknown as Express.Multer.File;
    const uploaded = await this.mediaService.uploadFile(key, file);
    return uploaded?.url ?? null;
  }

  private getLogoUrlFromS3(): Promise<string | null> {
    if (!this.logoUrlPromise) {
      this.logoUrlPromise = this.uploadLogoToS3().catch((error) => {
        this.logger.error(
          `Failed to upload email logo to S3: ${(error as Error).message}`,
        );
        this.logoUrlPromise = null;
        return null;
      });
    }
    return this.logoUrlPromise;
  }

  /**
   * Gmail and most clients block data: URIs. Prefer a real HTTPS URL.
   */
  private async getLogoSrc(): Promise<string> {
    const configuredUrl = this.configService
      .get<string>(APP_CONFIG.EMAIL_LOGO_URL)
      ?.trim();
    if (configuredUrl) {
      return configuredUrl;
    }

    const s3Url = await this.getLogoUrlFromS3();
    if (s3Url) {
      return s3Url;
    }

    const base64 = this.getLogoBase64();
    if (base64) {
      this.logger.warn(
        'Using data: URI for email logo — many clients (Gmail) will not display it.',
      );
      return `data:image/png;base64,${base64}`;
    }

    return '';
  }

  private async getDefaultTemplateContext(): Promise<
    Record<string, string | number>
  > {
    return {
      appName: EMAIL_BRAND.appName,
      supportEmail: EMAIL_BRAND.supportEmail,
      primaryColor: EMAIL_BRAND.primaryColor,
      accentColor: EMAIL_BRAND.accentColor,
      backgroundColor: EMAIL_BRAND.backgroundColor,
      textColor: EMAIL_BRAND.textColor,
      logoSrc: await this.getLogoSrc(),
      currentYear: new Date().getFullYear(),
    };
  }

  async loadTemplate(templateName: string, context: Record<string, any>) {
    try {
      // `||`, not `??`: .env ships TEMPLATES_PATH blank, and ConfigService
      // returns "" for it — which `??` keeps, resolving every template against
      // the filesystem root instead of the default directory.
      const templatePath =
        this.configService.get<string>(CONFIG.TEMPLATES_PATH) ||
        this.configService.get<string>(APP_CONFIG.TEMPLATES_PATH) ||
        'src/email-templates';
      const filePath = path.resolve(`${templatePath}/${templateName}.hbs`);
      const templateSource = fs.readFileSync(filePath, 'utf-8');
      const template = Handlebars.compile(templateSource);
      return template({
        ...(await this.getDefaultTemplateContext()),
        ...formatEmailTemplateContext(context),
      });
    } catch (error) {
      this.logger.error(
        `Failed to load template ${templateName}: ${(error as Error).message}`,
      );
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        EMAIL_ERRORS.TEMPLATE_LOAD_FAILED,
      );
    }
  }

  /**
   * Renders nothing and knows no vendor: resolves the sender, then hands the
   * finished message to whichever provider this build was generated with.
   */
  async sendEmail(
    to: string,
    subject: string,
    bodyHtml = '',
    bodyText?: string,
  ): Promise<void> {
    const recipientEmail = normalizeEmailAddress(to);
    if (!recipientEmail) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        EMAIL_ERRORS.RECIPIENT_REQUIRED,
      );
    }

    // The shared address only. A provider may hold its own verified sender —
    // SendGrid does — so this passes through what it has and leaves the final
    // say to the provider. Rejecting an empty value here would make
    // EMAIL_SENDER mandatory even for a provider that never needs it.
    const senderEmail =
      this.configService.get<string>(CONFIG.EMAIL_SENDER) ?? '';

    await this.provider.send({
      to: recipientEmail,
      subject,
      html: bodyHtml,
      text: bodyText,
      senderEmail,
      // `||` so a blank EMAIL_SENDER_NAME falls through to the brand name
      // rather than sending mail from "".
      senderName:
        this.configService.get<string>(APP_CONFIG.EMAIL_SENDER_NAME) ||
        EMAIL_BRAND.appName,
    });
  }
}
