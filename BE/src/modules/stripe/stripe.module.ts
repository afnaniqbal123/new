import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripeService } from './stripe.service';

/**
 * Base Stripe module that provides Stripe client initialization.
 * This module should be imported by any module that needs Stripe functionality.
 */
@Module({
  imports: [ConfigModule],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
