import { Module } from '@nestjs/common';
import { BillingService } from 'src/modules/billing/billing.service';
import { BillingController } from 'src/modules/billing/billing.controller';
import { BillingWebhookController } from 'src/modules/billing/billing-webhook.controller';
import { BillingPolicy } from 'src/modules/billing/policies/billing.policy';
import { StripeModule } from 'src/modules/stripe/stripe.module';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * SaaS subscription billing — charging the distributor for BusinessOS.
 *
 * Not for processing the distributor's own customer payments; see
 * `BillingService` and CONTEXT.md D12 for why those are a different product.
 */
@Module({
  imports: [StripeModule, OrganizationModule, AuthModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, BillingPolicy],
  exports: [BillingService],
})
export class BillingModule {}
