import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StripeModule } from '../stripe.module';
import { CardModule } from '../card/card.module';
import {
  Subscription,
  SubscriptionSchema,
} from './schemas/subscription.schema';
import {
  UserSubscription,
  UserSubscriptionSchema,
} from './schemas/user-subscription.schema';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionPlanPolicy } from './policies/subscription-plan.policy';
import { UserModule } from 'src/modules/user/user.module';

/**
 * Subscription module for managing Stripe subscriptions.
 * This module handles:
 * - Hosted UI subscription creation via Checkout Sessions
 * - Custom UI subscription creation with existing cards
 * - Subscription upgrades (immediate) and downgrades (scheduled)
 * - Subscription cancellation and resumption
 * - Subscription lifecycle management
 *
 * TODO: Replace with your actual User module
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: UserSubscription.name, schema: UserSubscriptionSchema },
    ]),
    StripeModule,
    CardModule,
    forwardRef(() => UserModule),
  ],
  // The policy registers itself with the PolicyRegistry on init; it is a
  // provider here because rules live with the module that owns the data.
  providers: [SubscriptionService, SubscriptionPlanPolicy],
  controllers: [SubscriptionController],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
