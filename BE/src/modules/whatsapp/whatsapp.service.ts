import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
  WhatsAppMessage,
  WhatsAppMessageDocument,
} from 'src/modules/whatsapp/conversation.schema';
import {
  DraftOrder,
  DraftOrderDocument,
} from 'src/modules/whatsapp/draft-order.schema';
import {
  CONVERSATION_STATUS,
  DRAFT_ORDER_STATUS,
  MESSAGE_DIRECTION,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
} from 'src/modules/whatsapp/constants/whatsapp.constant';
import { WHATSAPP_RESPONSE } from 'src/modules/whatsapp/constants/api-response/whatsapp.response';
import { SerializeHttpError } from 'src/utils/serializer';
import { WhatsAppCloudProvider } from 'src/modules/whatsapp/providers/whatsapp-cloud.provider';
import { ClerkService } from 'src/modules/ai/clerk.service';
import { CustomerService } from 'src/modules/customer/customer.service';
import { OrganizationService } from 'src/modules/organization/organization.service';

/** How long Meta allows a free-form reply after the customer's last message. */
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Meta's webhook payload, narrowed to the parts this service reads.
 *
 * Typed rather than `any` because it is the contract with an external system
 * — an optional chain through `any` silently yields `undefined` for a field
 * that was renamed, instead of failing a typecheck.
 */
export interface WhatsAppWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }[];
      };
    }[];
  }[];
}

export interface InboundMessage {
  phone: string;
  contactName?: string;
  text: string;
  waMessageId?: string;
  simulated?: boolean;
}

/**
 * Owns WhatsApp conversations, messages, and the draft orders they produce.
 *
 * ## The ingestion pipeline
 *
 * ```
 * webhook ─► signature check ─► tenant lookup ─► idempotency check
 *         ─► find/create conversation ─► store message
 *         ─► match customer by phone ─► AI extracts items
 *         ─► DETERMINISTIC product match ─► DraftOrder (PENDING)
 *         ─► human confirms ─► SalesService prices and writes the sale
 * ```
 *
 * The last two steps are the ones that matter: nothing the model produced
 * becomes a sale without a person looking at it, and the sale itself is
 * priced by the same code the POS uses. CONTEXT.md D9, D10.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(WhatsAppMessage.name)
    private readonly messageModel: Model<WhatsAppMessageDocument>,
    @InjectModel(DraftOrder.name)
    private readonly draftModel: Model<DraftOrderDocument>,
    private readonly provider: WhatsAppCloudProvider,
    private readonly clerkService: ClerkService,
    private readonly customerService: CustomerService,
    private readonly organizationService: OrganizationService,
  ) {}

  // --- Inbound -----------------------------------------------------------

  /**
   * Processes one inbound message, end to end.
   *
   * Idempotent on `waMessageId`: Meta retries any webhook it believes failed,
   * and without that guard a retry would create a second copy of the message
   * and — far worse — a second draft order for the same request.
   */
  async handleInbound(
    organizationId: string,
    inbound: InboundMessage,
  ): Promise<{
    conversation: ConversationDocument;
    message: WhatsAppMessageDocument;
    draft: DraftOrderDocument | null;
    duplicate: boolean;
  }> {
    const phone = this.normalizePhone(inbound.phone);

    if (inbound.waMessageId) {
      const existing = await this.messageModel.findOne({
        organization: new Types.ObjectId(organizationId),
        waMessageId: inbound.waMessageId,
      });

      if (existing) {
        const conversation = await this.conversationModel.findById(
          existing.conversation,
        );

        return {
          conversation: conversation as ConversationDocument,
          message: existing,
          draft: null,
          duplicate: true,
        };
      }
    }

    const conversation = await this.findOrCreateConversation(
      organizationId,
      phone,
      inbound.contactName,
    );

    const message = await this.messageModel.create({
      organization: new Types.ObjectId(organizationId),
      conversation: conversation._id,
      direction: MESSAGE_DIRECTION.INBOUND,
      type: MESSAGE_TYPE.TEXT,
      text: inbound.text,
      waMessageId: inbound.waMessageId,
      status: MESSAGE_STATUS.DELIVERED,
      simulated: inbound.simulated ?? false,
    });

    const now = new Date();
    conversation.lastMessageAt = now;
    conversation.lastInboundAt = now;
    conversation.lastMessagePreview = inbound.text.slice(0, 140);
    conversation.unreadCount += 1;
    await conversation.save();

    const draft = await this.maybeCreateDraft(
      organizationId,
      conversation,
      inbound.text,
    );

    return { conversation, message, draft, duplicate: false };
  }

  /**
   * Creates a draft order, when the organization's plan and settings allow it.
   *
   * Every gate is checked explicitly and failure is silent-but-logged: an
   * inbound message must always be *stored* even when nothing can be made of
   * it, because losing a customer's message is worse than not automating it.
   */
  private async maybeCreateDraft(
    organizationId: string,
    conversation: ConversationDocument,
    text: string,
  ): Promise<DraftOrderDocument | null> {
    try {
      const organization =
        await this.organizationService.findById(organizationId);

      if (!organization.whatsapp.autoDraftOrders) return null;

      const allowed = await this.organizationService.hasFeature(
        organizationId,
        'aiClerk',
      );

      if (!allowed || !this.clerkService.isConfigured()) return null;

      const customer = conversation.customer
        ? await this.customerService.findById(
            organizationId,
            String(conversation.customer),
          )
        : null;

      const parsed = await this.clerkService.parseOrderMessage(
        organizationId,
        text,
        customer?.name,
      );

      if (!parsed.isOrder || parsed.lines.length === 0) return null;

      // An earlier pending draft is superseded rather than left alongside the
      // new one — two open proposals for the same conversation is an
      // ambiguity nobody at the counter can resolve.
      await this.draftModel.updateMany(
        {
          organization: new Types.ObjectId(organizationId),
          conversation: conversation._id,
          status: DRAFT_ORDER_STATUS.PENDING,
        },
        { $set: { status: DRAFT_ORDER_STATUS.SUPERSEDED } },
      );

      const draft = await this.draftModel.create({
        organization: new Types.ObjectId(organizationId),
        conversation: conversation._id,
        customer: conversation.customer,
        lines: parsed.lines.map((line) => ({
          requestedText: line.requestedText,
          product: line.product ? new Types.ObjectId(line.product) : undefined,
          productName: line.productName,
          sku: line.sku,
          quantity: line.quantity,
          requestedUnit: line.requestedUnit,
          confidence: line.confidence,
          alternatives: line.alternatives.map((id) => new Types.ObjectId(id)),
        })),
        unmatched: parsed.unmatched,
        summary: parsed.summary,
        status: DRAFT_ORDER_STATUS.PENDING,
        aiModel: parsed.model,
      });

      conversation.status = CONVERSATION_STATUS.AWAITING_CONFIRMATION;
      conversation.pendingDraft = draft._id;
      await conversation.save();

      return draft;
    } catch (error) {
      // Deliberately swallowed. The message is already stored; a failed AI
      // pass must not turn a received order into a 500.
      this.logger.error(
        `Draft creation failed for organization ${organizationId}.`,
        error instanceof Error ? error.stack : undefined,
      );

      return null;
    }
  }

  /**
   * Finds the thread for a number, creating it on first contact.
   *
   * Also attempts to match the number to an existing customer — which is what
   * makes "Ahmed's usual order" work the first time he messages rather than
   * after someone links him by hand.
   */
  private async findOrCreateConversation(
    organizationId: string,
    phone: string,
    contactName?: string,
  ): Promise<ConversationDocument> {
    const existing = await this.conversationModel.findOne({
      organization: new Types.ObjectId(organizationId),
      phone,
    });

    if (existing) {
      if (contactName && !existing.contactName) {
        existing.contactName = contactName;
      }

      return existing;
    }

    const customer = await this.customerService.findByPhone(
      organizationId,
      phone,
    );

    return this.conversationModel.create({
      organization: new Types.ObjectId(organizationId),
      phone,
      contactName,
      customer: customer?._id,
      status: CONVERSATION_STATUS.OPEN,
    });
  }

  /** Digits only, no leading zeros — the same shape `Customer` normalises to. */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^0+/, '');
  }

  // --- Outbound ----------------------------------------------------------

  /**
   * Sends a free-form reply.
   *
   * Refuses outside Meta's 24-hour window, where only an approved template is
   * permitted. Checked here rather than in the provider because it is a
   * business rule about the conversation, not a property of the transport —
   * and because a clear refusal is far more useful than Meta's own error.
   */
  async sendMessage(
    organizationId: string,
    conversationId: string,
    text: string,
    userId?: string,
  ): Promise<WhatsAppMessageDocument> {
    const conversation = await this.findConversation(
      organizationId,
      conversationId,
    );

    if (!this.isWithinSessionWindow(conversation)) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        WHATSAPP_RESPONSE.OUTSIDE_SESSION_WINDOW,
      );
    }

    const result = await this.provider.sendText(conversation.phone, text);

    const message = await this.messageModel.create({
      organization: new Types.ObjectId(organizationId),
      conversation: conversation._id,
      direction: MESSAGE_DIRECTION.OUTBOUND,
      type: MESSAGE_TYPE.TEXT,
      text,
      waMessageId: result.messageId,
      status: result.ok ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.FAILED,
      simulated: result.simulated,
      sentBy: userId ? new Types.ObjectId(userId) : undefined,
      failureReason: result.error,
    });

    conversation.lastMessageAt = new Date();
    conversation.lastMessagePreview = text.slice(0, 140);
    await conversation.save();

    return message;
  }

  /**
   * Sends a pre-approved template — the only thing permitted outside the
   * 24-hour window, and therefore what reminders and digests use.
   */
  async sendTemplate(
    organizationId: string,
    phone: string,
    templateName: string,
    parameters: readonly string[],
    languageCode = 'en',
  ): Promise<WhatsAppMessageDocument> {
    const normalized = this.normalizePhone(phone);
    const conversation = await this.findOrCreateConversation(
      organizationId,
      normalized,
    );

    const result = await this.provider.sendTemplate(
      normalized,
      templateName,
      languageCode,
      parameters,
    );

    const message = await this.messageModel.create({
      organization: new Types.ObjectId(organizationId),
      conversation: conversation._id,
      direction: MESSAGE_DIRECTION.OUTBOUND,
      type: MESSAGE_TYPE.TEMPLATE,
      text: `[${templateName}] ${parameters.join(' · ')}`,
      waMessageId: result.messageId,
      status: result.ok ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.FAILED,
      simulated: result.simulated,
      failureReason: result.error,
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    return message;
  }

  private isWithinSessionWindow(conversation: ConversationDocument): boolean {
    if (!conversation.lastInboundAt) return false;

    return (
      Date.now() - conversation.lastInboundAt.getTime() < SESSION_WINDOW_MS
    );
  }

  // --- Reading -----------------------------------------------------------

  async findConversations(
    organizationId: string,
    status?: CONVERSATION_STATUS,
  ): Promise<ConversationDocument[]> {
    return this.conversationModel
      .find({
        organization: new Types.ObjectId(organizationId),
        ...(status ? { status } : {}),
      })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .populate('customer', 'name businessName outstanding creditLimit');
  }

  async findConversation(
    organizationId: string,
    conversationId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.conversationModel
      .findOne({
        _id: new Types.ObjectId(conversationId),
        organization: new Types.ObjectId(organizationId),
      })
      .populate('customer', 'name businessName outstanding creditLimit phone');

    if (!conversation) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        WHATSAPP_RESPONSE.CONVERSATION_NOT_FOUND,
      );
    }

    return conversation;
  }

  async findMessages(
    organizationId: string,
    conversationId: string,
  ): Promise<WhatsAppMessageDocument[]> {
    await this.findConversation(organizationId, conversationId);

    return this.messageModel
      .find({
        organization: new Types.ObjectId(organizationId),
        conversation: new Types.ObjectId(conversationId),
      })
      .sort({ createdAt: 1 })
      .limit(200);
  }

  async markRead(
    organizationId: string,
    conversationId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.findConversation(
      organizationId,
      conversationId,
    );

    conversation.unreadCount = 0;

    return conversation.save();
  }

  /** Links a conversation to a customer, by hand, when matching did not. */
  async linkCustomer(
    organizationId: string,
    conversationId: string,
    customerId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.findConversation(
      organizationId,
      conversationId,
    );

    await this.customerService.findById(organizationId, customerId);

    conversation.customer = new Types.ObjectId(customerId);
    await conversation.save();

    // Any pending draft inherits the link, so confirming it does not require
    // re-parsing the original message.
    await this.draftModel.updateMany(
      {
        organization: new Types.ObjectId(organizationId),
        conversation: conversation._id,
        status: DRAFT_ORDER_STATUS.PENDING,
      },
      { $set: { customer: new Types.ObjectId(customerId) } },
    );

    return conversation;
  }

  async closeConversation(
    organizationId: string,
    conversationId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.findConversation(
      organizationId,
      conversationId,
    );

    conversation.status = CONVERSATION_STATUS.CLOSED;

    return conversation.save();
  }

  /** Unread conversation count, for the navigation badge. */
  async countUnread(organizationId: string): Promise<number> {
    return this.conversationModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
      unreadCount: { $gt: 0 },
    });
  }

  /**
   * Processes a verified webhook payload.
   *
   * Tenant resolution lives here rather than in the controller: the
   * organization is looked up from the `phone_number_id` Meta addressed, and
   * that lookup crosses into another module — which the transport layer is
   * not allowed to orchestrate (`architecture:check`'s controller rule, and
   * for good reason: a controller that composes services is a controller that
   * quietly becomes a second service).
   *
   * An unrecognised phone number id is ignored quietly. Anyone can point a
   * webhook at a public URL, and alerting on that would make this endpoint a
   * noise generator.
   */
  async processWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;

        if (!phoneNumberId || !value?.messages?.length) continue;

        const organization =
          await this.organizationService.findByWhatsAppPhoneNumberId(
            phoneNumberId,
          );

        if (!organization) {
          this.logger.debug(
            `Ignoring WhatsApp event for unknown phone number id ${phoneNumberId}.`,
          );
          continue;
        }

        const contactName = value.contacts?.[0]?.profile?.name;

        for (const message of value.messages) {
          // Only text is ingested today. Images and documents are stored by
          // the receive path but are not parsed into orders — receipt
          // extraction is a separate capability, not a silent fallback.
          if (message.type !== 'text' || !message.text?.body || !message.from) {
            continue;
          }

          await this.handleInbound(String(organization._id), {
            phone: message.from,
            contactName,
            text: message.text.body,
            waMessageId: message.id,
          });
        }
      }
    }
  }
}
