import { Module, forwardRef } from '@nestjs/common';
import { StripeModule } from '../stripe.module';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { UserModule } from 'src/modules/user/user.module';

/**
 * Payment module for managing Stripe one-time payments.
 * This module handles:
 * - Custom UI payments via Payment Intents (Stripe Elements)
 * - Redirect payments via Checkout Sessions
 * - Both authenticated user and guest payment flows
 *
 * TODO: Replace with your actual User module
 */
@Module({
  imports: [
    StripeModule,
    forwardRef(() => UserModule), // Optional for authenticated users
  ],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
