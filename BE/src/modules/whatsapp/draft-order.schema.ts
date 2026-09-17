import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { DRAFT_ORDER_STATUS } from 'src/modules/whatsapp/constants/whatsapp.constant';
import { MATCH_CONFIDENCE } from 'src/modules/ai/constants/ai.constant';

/**
 * One line the AI believes the customer asked for.
 *
 * Carries the original text alongside the resolved product deliberately: the
 * confirm screen shows a human what was *said* next to what was *matched*, so
 * a wrong match is obvious rather than buried behind a product name that
 * looks plausible.
 */
@Schema({ _id: false })
export class DraftOrderLine {
  /** Exactly what the customer wrote for this item. Never paraphrased. */
  @Prop({ required: true, type: String })
  requestedText: string;

  /** Null when nothing in the catalogue matched. Still shown, still editable. */
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  product: Types.ObjectId;

  @Prop({ type: String })
  productName: string;

  @Prop({ type: String })
  sku: string;

  @Prop({ required: true, type: Number, default: 1 })
  quantity: number;

  /** The unit the customer named — "cartons", "boxes" — before conversion. */
  @Prop({ type: String })
  requestedUnit: string;

  @Prop({
    type: String,
    enum: Object.values(MATCH_CONFIDENCE),
    default: MATCH_CONFIDENCE.LOW,
  })
  confidence: MATCH_CONFIDENCE;

  /**
   * Alternative products the matcher also considered.
   *
   * Offered as one-tap corrections on the confirm screen — the second-best
   * match is right often enough that making someone search again is a waste
   * of the match that was already computed.
   */
  @Prop({ type: [Types.ObjectId], ref: 'Product', default: [] })
  alternatives: Types.ObjectId[];
}

/**
 * The AI's structured reading of a conversation — **a proposal, never a sale**.
 *
 * This schema is where CONTEXT.md D9 is enforced structurally rather than by
 * convention: a draft has no prices, no tax, and no totals. It records *what
 * was asked for*, and the deterministic sale path prices it when a human
 * confirms. There is deliberately no field here that a model could fill in
 * with a number a customer would then be charged.
 */
@Schema({ timestamps: true })
export class DraftOrder {
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

  /** Null until the conversation is matched or linked to a customer. */
  @Prop({ type: Types.ObjectId, ref: 'Customer' })
  customer: Types.ObjectId;

  @Prop({ type: [DraftOrderLine], default: [] })
  lines: DraftOrderLine[];

  /**
   * Parts of the message the matcher could not turn into a line at all.
   *
   * Kept rather than dropped: "and the usual paint thinner" is a real order
   * line to the person who wrote it, and silently discarding it is how an AI
   * feature loses trust on its first day.
   */
  @Prop({ type: [String], default: [] })
  unmatched: string[];

  /** The model's own one-line summary, for the notification. */
  @Prop({ type: String })
  summary: string;

  @Prop({
    type: String,
    enum: Object.values(DRAFT_ORDER_STATUS),
    default: DRAFT_ORDER_STATUS.PENDING,
    index: true,
  })
  status: DRAFT_ORDER_STATUS;

  /** The Sale this became, once a human confirmed it. */
  @Prop({ type: Types.ObjectId, ref: 'Sale' })
  sale: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actionedBy: Types.ObjectId;

  @Prop({ type: Date })
  actionedAt: Date;

  @Prop({ type: String })
  rejectionReason: string;

  /**
   * Which model produced it, so a bad batch can be traced to a version.
   *
   * Named `aiModel` rather than `model`: a Mongoose document already has a
   * `.model()` method, and a field of that name shadows it — which breaks
   * typing on the document in ways that surface far from the cause.
   */
  @Prop({ type: String })
  aiModel: string;
}

export const DraftOrderSchema = SchemaFactory.createForClass(DraftOrder);

export type DraftOrderDocument = DraftOrder & Document;

DraftOrderSchema.index({ organization: 1, status: 1, createdAt: -1 });
DraftOrderSchema.index({ organization: 1, conversation: 1, createdAt: -1 });
