import { BrevoClient } from '@getbrevo/brevo';
import { HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SerializeHttpError } from 'src/utils/serializer';
import { CONFIG } from '../constants/config';
import { EMAIL_ERRORS } from '../constants/api-response/email.response';
import { EmailProviderEnum } from '../enums/email-provider.enum';
import type {
  EmailProvider,
  SendEmailOptions,
} from './email-provider.interface';

/**
 * Brevo (formerly Sendinblue) transactional email.
 *
 * The default provider. Authenticates with `EMAIL_API_KEY`, which ships inside
 * this provider's own `.env.example` region — each provider owns its key, so a
 * build that dropped Brevo ships neither the key nor a reader for it.
 */
export class BrevoEmailProvider implements EmailProvider {
  readonly name = EmailProviderEnum.BREVO;

  private readonly logger = new Logger(BrevoEmailProvider.name);
  private readonly client: BrevoClient;

  constructor(private readonly configService: ConfigService) {
    this.client = new BrevoClient({
      apiKey: this.configService.get<string>(CONFIG.EMAIL_CLIENT_API_KEY) || '',
    });
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!options.senderEmail) {
      this.logger.error(
        'EMAIL_SENDER is not set; Brevo will reject every message.',
      );
      return SerializeHttpError(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        EMAIL_ERRORS.SENDER_NOT_CONFIGURED,
      );
    }

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
        ...(options.text ? { textContent: options.text } : {}),
        sender: { email: options.senderEmail, name: options.senderName },
      });
      this.logger.log(`Email sent to ${options.to} via Brevo.`);
    } catch (error) {
      // Brevo reports the useful part in `body.message`; the SDK wraps network
      // failures so the reason is only in `cause`. Both are logged, because a
      // bad key and an unreachable host need different fixes and the top-level
      // message alone does not distinguish them.
      const err = error as {
        body?: { message?: string };
        message?: string;
        name?: string;
        stack?: string;
        code?: string;
        cause?: { message?: string; code?: string };
      };
      const providerMessage =
        err?.body?.message ?? err?.message ?? err?.cause?.message ?? 'Unknown';

      this.logger.error(
        `Brevo refused the message to ${options.to}. ${JSON.stringify({
          name: err?.name,
          code: err?.code ?? err?.cause?.code,
          providerMessage,
          cause: err?.cause?.message,
        })}`,
        err?.stack,
      );

      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        providerMessage === 'fetch failed'
          ? EMAIL_ERRORS.PROVIDER_UNREACHABLE
          : EMAIL_ERRORS.SEND_FAILED,
      );
    }
  }
}
