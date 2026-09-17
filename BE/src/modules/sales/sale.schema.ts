import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  PAYMENT_METHOD,
  SALE_SOURCE,
  SALE_STATUS,
  SALE_TYPE,
} from 'src/modules/sales/constants/sales.constant';

/**
 * One line of a sale.
 *
 * Product name, SKU and unit are **copied** onto the line rather than read
 * through the reference at display time. A product gets renamed, repriced and
 * eventually archived; an invoice issued in March must still say what it said
 * in March. A join would quietly rewrite history every time the catalogue
 * changed.
 *
 * Every monetary field is minor units. CONTEXT.md D4.
 */
@Schema({ _id: false })
export class SaleLine {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Product' })
  product: Types.ObjectId;

  /** Snapshot of the product name at the time of sale. */
  @Prop({ required: true, type: String })
  name: string;

  @Prop({ type: String })
  sku: string;

  @Prop({ type: String })
  unit: string;

  @Prop({ required: true, type: Number })
  quantity: number;

  /** Price per unit charged, before discount. */
  @Prop({ required: true, type: Number })
  unitPrice: number;

  /** Discount on this line, as an absolute amount. */
  @Prop({ type: Number, default: 0 })
  discountAmount: number;

  /** Amount tax was charged on, after discount. */
  @Prop({ required: true, type: Number, default: 0 })
  taxableAmount: number;

  @Prop({ type: Number, default: 0 })
  taxRatePercent: number;

  @Prop({ type: Number, default: 0 })
  taxAmount: number;

  /** Secondary tax — PK further tax, where it applies. */
  @Prop({ type: Number, default: 0 })
  additionalTaxAmount: number;

  /** `taxableAmount + taxAmount + additionalTaxAmount`. */
  @Prop({ required: true, type: Number })
  lineTotal: number;

  /**
   * Weighted-average cost at the moment of sale, per unit.
   *
   * Stamped here so gross margin is computable for this invoice forever,
   * regardless of what the product's average cost does afterwards. Stripped
   * from responses for roles that may not see cost — see `stripCostFields`.
   */
  @Prop({ type: Number, default: 0 })
  unitCost: number;

  @Prop({ type: String })
  batchNo: string;
}

/** Money taken against a sale. A sale may have several. */
@Schema({ _id: false })
export class SalePayment {
  @Prop({
    required: true,
    type: String,
    enum: Object.values(PAYMENT_METHOD),
  })
  method: PAYMENT_METHOD;

  @Prop({ required: true, type: Number })
  amount: number;

  /** Cheque number, transfer reference, card approval code. */
  @Prop({ type: String, trim: true })
  reference: string;

  @Prop({ type: Date, default: Date.now })
  receivedAt: Date;
}

/**
 * A completed transaction with a customer.
 *
 * **Immutable once `COMPLETED`** (Invariant #7). Corrections happen through a
 * `SaleReturn`, or by voiding — never by editing. That is not bureaucracy: an
 * invoice is a document the customer also holds a copy of, and a system that
 * can silently change its own copy cannot be reconciled against theirs.
 */
@Schema({ timestamps: true })
export class Sale {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Location' })
  location: Types.ObjectId;

  /**
   * Allocated atomically at completion, never at draft.
   *
   * A parked basket that grabbed a number and was then abandoned would leave
   * a permanent hole in a sequence that is expected to be gapless.
   * Invariant #4.
   */
  @Prop({ type: String, trim: true })
  invoiceNumber: string;

  /**
   * Absent for a walk-in cash sale, which is the common case at a counter.
   * Required for anything on credit — enforced in the service, because "who
   * owes this?" must have an answer.
   */
  @Prop({ type: Types.ObjectId, ref: 'Customer', index: true })
  customer: Types.ObjectId;

  /** Snapshot, for the same reason the line names are snapshots. */
  @Prop({ type: String })
  customerName: string;

  @Prop({ type: [SaleLine], default: [] })
  lines: SaleLine[];

  // --- Totals, all minor units ------------------------------------------

  /** Sum of line amounts before discount and tax. */
  @Prop({ required: true, type: Number, default: 0 })
  subtotal: number;

  /** Line discounts plus any invoice-level discount. */
  @Prop({ type: Number, default: 0 })
  discountTotal: number;

  @Prop({ type: Number, default: 0 })
  taxTotal: number;

  @Prop({ type: Number, default: 0 })
  additionalTaxTotal: number;

  @Prop({ required: true, type: Number, default: 0 })
  grandTotal: number;

  @Prop({ type: Number, default: 0 })
  paidTotal: number;

  /** `grandTotal - paidTotal`. Anything above zero is credit. */
  @Prop({ type: Number, default: 0 })
  dueTotal: number;

  /**
   * Total weighted-average cost of the goods sold.
   *
   * Stored rather than derived so that profit reports are one aggregation
   * over sales instead of a join back through every line's product.
   */
  @Prop({ type: Number, default: 0 })
  costTotal: number;

  @Prop({ type: [SalePayment], default: [] })
  payments: SalePayment[];

  @Prop({
    type: String,
    enum: Object.values(SALE_TYPE),
    default: SALE_TYPE.CASH,
  })
  saleType: SALE_TYPE;

  @Prop({
    type: String,
    enum: Object.values(SALE_STATUS),
    default: SALE_STATUS.DRAFT,
    index: true,
  })
  status: SALE_STATUS;

  @Prop({
    type: String,
    enum: Object.values(SALE_SOURCE),
    default: SALE_SOURCE.POS,
  })
  source: SALE_SOURCE;

  /** When payment falls due, from the customer's terms at time of sale. */
  @Prop({ type: Date })
  dueDate: Date;

  @Prop({ type: Date })
  completedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  soldBy: Types.ObjectId;

  /**
   * Set when the sale completed past the customer's credit limit.
   *
   * Recorded on the document rather than only in a log, because "who approved
   * this?" is the first question asked when the debt goes bad.
   */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  creditOverrideBy: Types.ObjectId;

  @Prop({ type: String, trim: true })
  note: string;

  /** The WhatsApp conversation this came from, when it did. */
  @Prop({ type: Types.ObjectId, ref: 'Conversation' })
  conversation: Types.ObjectId;
}

export const SaleSchema = SchemaFactory.createForClass(Sale);

export type SaleDocument = Sale & Document;

/**
 * Gapless and unique per tenant.
 *
 * Partial rather than sparse: drafts have no invoice number, and a sparse
 * compound index would still index them against `null` — making the second
 * parked basket collide with the first.
 */
SaleSchema.index(
  { organization: 1, invoiceNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { invoiceNumber: { $type: 'string' } },
  },
);
// Serves the sales list, today's-takings tile, and every dated report.
SaleSchema.index({ organization: 1, status: 1, completedAt: -1 });
SaleSchema.index({ organization: 1, customer: 1, completedAt: -1 });
// Receivables: completed sales with something still owed.
SaleSchema.index({ organization: 1, dueTotal: 1, dueDate: 1 });
