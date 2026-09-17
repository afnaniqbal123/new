import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PURCHASE_ORDER_STATUS } from 'src/modules/purchasing/constants/purchasing.constant';

@Schema({ _id: false })
export class PurchaseOrderLine {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Product' })
  product: Types.ObjectId;

  /** Snapshot, so the order reads correctly after a rename. */
  @Prop({ required: true, type: String })
  name: string;

  @Prop({ type: String })
  sku: string;

  @Prop({ required: true, type: Number })
  quantity: number;

  /** Agreed purchase price per unit, minor units. */
  @Prop({ required: true, type: Number })
  unitCost: number;

  /**
   * Cumulative quantity received against this line.
   *
   * Tracked per line rather than per order because partial deliveries are the
   * norm in distribution — a supplier ships what they have and backorders the
   * rest, and the order must say which lines are still outstanding.
   */
  @Prop({ type: Number, default: 0 })
  receivedQuantity: number;

  @Prop({ required: true, type: Number })
  lineTotal: number;
}

/**
 * An intent to buy. Moves no stock and owes no money until goods arrive.
 *
 * The separation from `GoodsReceipt` is the point: ordering and receiving are
 * different events, often weeks apart, and frequently disagree about
 * quantity. A model that fuses them cannot represent a partial delivery,
 * which is the ordinary case.
 */
@Schema({ timestamps: true })
export class PurchaseOrder {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, type: String, trim: true })
  orderNumber: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Supplier', index: true })
  supplier: Types.ObjectId;

  @Prop({ type: String })
  supplierName: string;

  /** Where the goods are expected. Every receipt lands here. */
  @Prop({ required: true, type: Types.ObjectId, ref: 'Location' })
  location: Types.ObjectId;

  @Prop({ type: [PurchaseOrderLine], default: [] })
  lines: PurchaseOrderLine[];

  @Prop({ required: true, type: Number, default: 0 })
  subtotal: number;

  @Prop({ type: Number, default: 0 })
  taxTotal: number;

  @Prop({ required: true, type: Number, default: 0 })
  grandTotal: number;

  @Prop({
    type: String,
    enum: Object.values(PURCHASE_ORDER_STATUS),
    default: PURCHASE_ORDER_STATUS.DRAFT,
    index: true,
  })
  status: PURCHASE_ORDER_STATUS;

  @Prop({ type: Date })
  expectedAt: Date;

  @Prop({ type: Date })
  sentAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: String, trim: true })
  note: string;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);

export type PurchaseOrderDocument = PurchaseOrder & Document;

PurchaseOrderSchema.index(
  { organization: 1, orderNumber: 1 },
  { unique: true },
);
PurchaseOrderSchema.index({ organization: 1, status: 1, createdAt: -1 });
PurchaseOrderSchema.index({ organization: 1, supplier: 1, createdAt: -1 });

@Schema({ _id: false })
export class GoodsReceiptLine {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Product' })
  product: Types.ObjectId;

  @Prop({ required: true, type: String })
  name: string;

  @Prop({ required: true, type: Number })
  quantity: number;

  /**
   * What this delivery actually charged, which may differ from the ordered
   * price. Suppliers reprice between order and delivery, and the *received*
   * cost is what enters the weighted average — not what was hoped for.
   */
  @Prop({ required: true, type: Number })
  unitCost: number;

  @Prop({ required: true, type: Number })
  lineTotal: number;

  @Prop({ type: String, trim: true })
  batchNo: string;

  @Prop({ type: Date })
  expiry: Date;
}

/**
 * Goods physically arriving.
 *
 * **This is the document that writes stock and recomputes weighted-average
 * cost** — not the purchase order. An order is a promise; a receipt is an
 * event. CONTEXT.md D3.
 */
@Schema({ timestamps: true })
export class GoodsReceipt {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, type: String, trim: true })
  receiptNumber: string;

  /** Optional: goods can arrive without a formal order behind them. */
  @Prop({ type: Types.ObjectId, ref: 'PurchaseOrder', index: true })
  purchaseOrder: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Supplier', index: true })
  supplier: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Location' })
  location: Types.ObjectId;

  @Prop({ type: [GoodsReceiptLine], default: [] })
  lines: GoodsReceiptLine[];

  @Prop({ required: true, type: Number, default: 0 })
  subtotal: number;

  @Prop({ type: Number, default: 0 })
  taxTotal: number;

  @Prop({ required: true, type: Number, default: 0 })
  grandTotal: number;

  /** The supplier's own invoice number, for reconciliation against theirs. */
  @Prop({ type: String, trim: true })
  supplierInvoiceNumber: string;

  @Prop({ type: Date })
  supplierInvoiceDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  receivedBy: Types.ObjectId;

  @Prop({ type: String, trim: true })
  note: string;
}

export const GoodsReceiptSchema = SchemaFactory.createForClass(GoodsReceipt);

export type GoodsReceiptDocument = GoodsReceipt & Document;

GoodsReceiptSchema.index(
  { organization: 1, receiptNumber: 1 },
  { unique: true },
);
GoodsReceiptSchema.index({ organization: 1, createdAt: -1 });
GoodsReceiptSchema.index({ organization: 1, supplier: 1, createdAt: -1 });
