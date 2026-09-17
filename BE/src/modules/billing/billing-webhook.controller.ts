import { Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/modules/auth/decorator/public.decorator';
import { RawBody } from 'src/decorators/raw-body.decorator';
import { BillingService } from 'src/modules/billing/billing.service';

/**
 * Stripe's subscription webhook.
 *
 * The only path that changes an organization's plan. Unauthenticated by
 * necessity — Stripe has no bearer token — and therefore entirely dependent
 * on signature verification, which `BillingService.handleWebhook` performs
 * against the raw bytes.
 *
 * Unlike the WhatsApp webhook this one *does* surface a failure: Stripe's
 * retry behaviour is well-behaved and bounded, and a visible failure in the
 * Stripe dashboard is genuinely useful when a subscription has not applied.
 */
@Controller('billing/webhook')
@ApiTags('BillingWebhook')
@ApiExcludeController()
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Post()
  @HttpCode(200)
  async receive(
    @Headers('stripe-signature') signature: string | undefined,
    @RawBody() rawBody: Buffer | undefined,
  ): Promise<{ received: boolean }> {
    if (!signature || !rawBody) {
      this.logger.warn(
        'Rejected a Stripe webhook with no signature or body. Is the app running with rawBody enabled?',
      );

      return { received: false };
    }

    await this.billingService.handleWebhook(rawBody, signature);

    return { received: true };
  }
}
