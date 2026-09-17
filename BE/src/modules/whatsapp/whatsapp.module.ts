import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsAppService } from 'src/modules/whatsapp/whatsapp.service';
import { DraftOrderService } from 'src/modules/whatsapp/draft-order.service';
import { WhatsAppController } from 'src/modules/whatsapp/whatsapp.controller';
import { WhatsAppWebhookController } from 'src/modules/whatsapp/whatsapp-webhook.controller';
import { WhatsAppCloudProvider } from 'src/modules/whatsapp/providers/whatsapp-cloud.provider';
import {
  Conversation,
  ConversationSchema,
  WhatsAppMessage,
  WhatsAppMessageSchema,
} from 'src/modules/whatsapp/conversation.schema';
import {
  DraftOrder,
  DraftOrderSchema,
} from 'src/modules/whatsapp/draft-order.schema';
import { WhatsAppPolicy } from 'src/modules/whatsapp/policies/whatsapp.policy';
import { AiModule } from 'src/modules/ai/ai.module';
import { SalesModule } from 'src/modules/sales/sales.module';
import { CustomerModule } from 'src/modules/customer/customer.module';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * WhatsApp ingestion, the inbox, and the draft orders it produces.
 *
 * Works end to end with no Meta credentials at all: `WhatsAppCloudProvider`
 * records what it would have sent, and `POST /whatsapp/simulate` injects
 * inbound messages through the real pipeline. CONTEXT.md D10.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: WhatsAppMessage.name, schema: WhatsAppMessageSchema },
      { name: DraftOrder.name, schema: DraftOrderSchema },
    ]),
    AiModule,
    SalesModule,
    CustomerModule,
    OrganizationModule,
    AuthModule,
  ],
  controllers: [WhatsAppController, WhatsAppWebhookController],
  providers: [
    WhatsAppService,
    DraftOrderService,
    WhatsAppCloudProvider,
    WhatsAppPolicy,
  ],
  exports: [WhatsAppService, DraftOrderService],
})
export class WhatsAppModule {}
