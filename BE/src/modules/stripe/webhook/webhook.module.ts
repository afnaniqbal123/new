import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripeModule } from '../stripe.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

/**
 * Webhook module for handling Stripe webhook events.
 * This module processes subscription-related webhook events.
 * TODO: Replace with your actual webhook processing logic.
 */
@Module({
  imports: [ConfigModule, StripeModule],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
