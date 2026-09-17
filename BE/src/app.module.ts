import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CONFIG } from './constants/config.constant';
import { AuthModule } from './modules/auth/auth.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { UserModule } from './modules/user/user.module';
import { EmailModule } from './modules/email/email.module';
import { MediaModule } from './modules/media/media.module';
// #region businessos
import { OrganizationModule } from './modules/organization/organization.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { TaxModule } from './modules/tax/tax.module';
import { CustomerModule } from './modules/customer/customer.module';
import { SalesModule } from './modules/sales/sales.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AiModule } from './modules/ai/ai.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { AutomationModule } from './modules/automation/automation.module';
import { BillingModule } from './modules/billing/billing.module';
// #endregion businessos
// #region module:notifications
import { NotificationsModule } from './modules/notifications/notifications.module';
// #endregion module:notifications
// #region module:stripe
import { CardModule } from './modules/stripe/card/card.module';
import { InvoiceModule } from './modules/stripe/invoice/invoice.module';
import { PaymentModule } from './modules/stripe/payment/payment.module';
import { SubscriptionModule } from './modules/stripe/subscription/subscription.module';
import { WebhookModule } from './modules/stripe/webhook/webhook.module';
// #endregion module:stripe
import { validateAuthEnv } from './modules/auth/utils/auth-env.validation';
import { validateEmailEnv } from './modules/email/utils/email-env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'dev'}`, '.env'],
      // Refuses to boot on a missing or weak JWT_SECRET, or on an
      // EMAIL_PROVIDER this build cannot send through. Neither is something to
      // discover is broken at the first login attempt.
      validate: (config: Record<string, unknown>) =>
        validateEmailEnv(validateAuthEnv(config)),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>(CONFIG.MONGODB_URI),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AuthorizationModule,
    UserModule,
    EmailModule,
    MediaModule,
    // #region businessos
    OrganizationModule,
    CatalogModule,
    InventoryModule,
    TaxModule,
    CustomerModule,
    SalesModule,
    PurchasingModule,
    ReportsModule,
    AiModule,
    WhatsAppModule,
    AutomationModule,
    BillingModule,
    // #endregion businessos
    // #region module:notifications
    NotificationsModule,
    // #endregion module:notifications
    // #region module:stripe
    CardModule,
    InvoiceModule,
    PaymentModule,
    SubscriptionModule,
    WebhookModule,
    // #endregion module:stripe
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
