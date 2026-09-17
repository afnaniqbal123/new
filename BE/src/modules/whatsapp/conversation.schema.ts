import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  CONVERSATION_STATUS,
  MESSAGE_DIRECTION,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
} from 'src/modules/whatsapp/constants/whatsapp.constant';

/**
 * A WhatsApp thread with one phone number.
 *
 * Keyed on the phone number, not on a customer, because the first message
 * from a new number arrives before anyone knows who it is. `customer` is
 * filled in when a match is found or when a human links it — and a
 * conversation with no customer is a normal, workable state, not an error.
 */
@Schema({ timestamps: true })
export class Conversation {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  /** Digits only, no leading zero — matches `Customer.phoneNormalized`. */
  @Prop({ required: true, type: String, index: true })
  phone: string;

  /** The WhatsApp profile name, which is all you get for an unknown number. */
  @Prop({ type: String, trim: true })
  contactName: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', index: true })
  customer: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(CONVERSATION_STATUS),
    default: CONVERSATION_STATUS.OPEN,
  })
  status: CONVERSATION_STATUS;

  @Prop({ type: String, trim: true })
  lastMessagePreview: string;

  @Prop({ type: Date })
  lastMessageAt: Date;

  /**
   * When the customer last messaged *us*.
   *
   * Meta only permits free-form replies within 24 hours of an inbound
   * message; outside that window only a pre-approved template may be sent.
   * Stored rather than derived so the send path can check it without
   * scanning the message history on every send.
   */
  @Prop({ type: Date })
  lastInboundAt: Date;

  @Prop({ type: Number, default: 0 })
  unreadCount: number;

  /** Set while a draft order from this thread is awaiting confirmation. */
  @Prop({ type: Types.ObjectId, ref: 'DraftOrder' })
  pendingDraft: Types.ObjectId;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

export type ConversationDocument = Conversation & Document;

// One thread per number per tenant. The unique index is what makes the
// find-or-create on an inbound message safe under concurrent webhooks.
ConversationSchema.index({ organization: 1, phone: 1 }, { unique: true });
ConversationSchema.index({ organization: 1, status: 1, lastMessageAt: -1 });

/** One message in a thread, inbound or outbound. */
@Schema({ timestamps: true })
export class WhatsAppMessage {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Conversation',
    index: true,
  })
  conversation: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(MESSAGE_DIRECTION),
  })
  direction: MESSAGE_DIRECTION;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(MESSAGE_TYPE),
    default: MESSAGE_TYPE.TEXT,
  })
  type: MESSAGE_TYPE;

  @Prop({ type: String })
  text: string;

  @Prop({ type: String })
  mediaUrl: string;

  /**
   * Meta's own message id.
   *
   * Unique per organization and used for idempotency: Meta retries a webhook
   * it believes failed, and without this a retried delivery would create a
   * second copy of the message — and, worse, a second draft order.
   */
  @Prop({ type: String, index: true })
  waMessageId: string;

  @Prop({
    type: String,
    enum: Object.values(MESSAGE_STATUS),
    default: MESSAGE_STATUS.PENDING,
  })
  status: MESSAGE_STATUS;

  /** Set when the message came from the built-in simulator, not from Meta. */
  @Prop({ type: Boolean, default: false })
  simulated: boolean;

  /** Who sent it, for an outbound message a person typed. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  sentBy: Types.ObjectId;

  @Prop({ type: String })
  failureReason: string;
}

export const WhatsAppMessageSchema =
  SchemaFactory.createForClass(WhatsAppMessage);

export type WhatsAppMessageDocument = WhatsAppMessage & Document;

WhatsAppMessageSchema.index({ organization: 1, conversation: 1, createdAt: 1 });
/**
 * The idempotency guard: one message per Meta id, per tenant.
 *
 * `partialFilterExpression`, not `sparse`. A *sparse* compound index only
 * skips a document when **every** indexed field is missing — and
 * `organization` is always present, so a message with no `waMessageId`
 * (a simulated one) is still indexed, against `null`. The second such message
 * then collides with the first on a duplicate key, which is how simulating two
 * inbound messages used to fail.
 *
 * A partial index genuinely excludes them: only documents that actually carry
 * a Meta id participate.
 */
WhatsAppMessageSchema.index(
  { organization: 1, waMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { waMessageId: { $type: 'string' } },
  },
);
