import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RETURN_STATUS } from 'src/modules/sales/constants/sales.constant';

@Schema({ _id: false })
export class SaleReturnLine {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Product' })
  product: Types.ObjectId;

  @Prop({ required: true, type: String })
  name: string;

  @Prop({ required: true, type: Number })
  quantity: number;

  /** The price this line was originally sold at, per unit. */
  @Prop({ required: true, type: Number })
  unitPrice: number;

  /** Tax refunded, proportional to the quantity returned. */
  @Prop({ type: Number, default: 0 })
  taxAmount: number;

  @Prop({ required: true, type: Number })
  lineTotal: number;

  /** Cost the original sale recorded, so margin reverses correctly too. */
  @Prop({ type: Number, default: 0 })
  unitCost: number;
}

/**
 * Goods coming back against a completed sale.
 *
 * A separate document rather than an edit of the sale, because the original
 * invoice is a record the customer also holds. Reversing by writing a new
 * document means both copies stay reconcilable, and the return is itself
 * auditable — "what came back, when, and who authorised it" is a question
 * that has an answer. Invariant #7.
 *
 * Refund amounts are computed from what the sale actually charged, not
 * recalculated at today's prices or today's tax rate. A return in December of
 * something bought in March refunds March's money.
 */
@Schema({ timestamps: true })
export class SaleReturn {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Sale', index: true })
  sale: Types.ObjectId;

  /** Copied from the sale, so a return document reads on its own. */
  @Prop({ type: String })
  saleInvoiceNumber: string;

  @Prop({ required: true, type: String, trim: true })
  returnNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer' })
  customer: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Location' })
  location: Types.ObjectId;

  @Prop({ type: [SaleReturnLine], default: [] })
  lines: SaleReturnLine[];

  @Prop({ required: true, type: Number, default: 0 })
  subtotal: number;

  @Prop({ type: Number, default: 0 })
  taxTotal: number;

  @Prop({ required: true, type: Number, default: 0 })
  grandTotal: number;

  @Prop({ type: Number, default: 0 })
  costTotal: number;

  /**
   * Whether money went back across the counter, as opposed to the customer's
   * account being credited. Two genuinely different outcomes: one moves cash,
   * the other moves a receivable.
   */
  @Prop({ type: Boolean, default: false })
  refunded: boolean;

  @Prop({
    type: String,
    enum: Object.values(RETURN_STATUS),
    default: RETURN_STATUS.COMPLETED,
  })
  status: RETURN_STATUS;

  @Prop({ type: String, trim: true })
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  processedBy: Types.ObjectId;
}

export const SaleReturnSchema = SchemaFactory.createForClass(SaleReturn);

export type SaleReturnDocument = SaleReturn & Document;

SaleReturnSchema.index({ organization: 1, returnNumber: 1 }, { unique: true });
SaleReturnSchema.index({ organization: 1, createdAt: -1 });
SaleReturnSchema.index({ organization: 1, sale: 1 });
