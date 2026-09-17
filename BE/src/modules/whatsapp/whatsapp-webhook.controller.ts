import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/modules/auth/decorator/public.decorator';
import { RawBody } from 'src/decorators/raw-body.decorator';
import {
  WhatsAppService,
  WhatsAppWebhookPayload,
} from 'src/modules/whatsapp/whatsapp.service';
import { WhatsAppCloudProvider } from 'src/modules/whatsapp/providers/whatsapp-cloud.provider';

/**
 * The WhatsApp Cloud API webhook.
 *
 * ## Why this controller is different from every other one
 *
 * It is the only **unauthenticated, externally-reachable** write path in the
 * system. Meta calls it; there is no bearer token and no tenant header. Three
 * things therefore have to happen here that happen nowhere else:
 *
 * 1. **Signature verification.** `X-Hub-Signature-256` is checked against the
 *    raw body. Without it, anyone who learns this URL can post fabricated
 *    orders into a business's inbox.
 * 2. **Tenant resolution from the payload.** The organization is looked up by
 *    the `phone_number_id` Meta addressed, never from a client-supplied
 *    header — a header here would be an open tenant-selection parameter.
 * 3. **Always answering 200.** Meta retries anything else, escalating to
 *    disabling the webhook. Errors are logged and swallowed; idempotency on
 *    the message id makes the retries it does send harmless.
 */
@Controller('whatsapp/webhook')
@ApiTags('WhatsAppWebhook')
@ApiExcludeController()
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly provider: WhatsAppCloudProvider,
  ) {}

  /**
   * Meta's registration handshake.
   *
   * Echoes the challenge only when the verify token matches — returning it
   * unconditionally would let anyone register this endpoint as their own.
   */
  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const result = this.provider.verifyWebhookChallenge(mode, token, challenge);

    if (!result) {
      this.logger.warn('WhatsApp webhook verification failed.');

      return '';
    }

    return result;
  }

  /**
   * Receives inbound messages.
   *
   * Always 200, always fast: the response tells Meta the delivery succeeded,
   * and anything that goes wrong afterwards is this system's problem, not
   * something to make Meta retry into.
   */
  @Public()
  @Post()
  @HttpCode(200)
  async receive(
    @Body() payload: WhatsAppWebhookPayload,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @RawBody() rawBody: Buffer | undefined,
  ): Promise<string> {
    if (!this.provider.verifySignature(rawBody, signature)) {
      // Logged, not rejected with an error status: a 4xx makes Meta retry and
      // eventually disable the webhook, and an attacker gets the same empty
      // 200 as a misconfiguration does.
      this.logger.warn(
        'Rejected a WhatsApp webhook with an invalid or missing signature.',
      );

      return 'EVENT_RECEIVED';
    }

    try {
      await this.whatsappService.processWebhook(payload);
    } catch (error) {
      this.logger.error(
        'WhatsApp webhook processing failed.',
        error instanceof Error ? error.stack : undefined,
      );
    }

    return 'EVENT_RECEIVED';
  }
}
