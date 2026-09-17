import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  PRODUCT_STATUS,
  TAX_TREATMENT,
} from 'src/modules/catalog/constants/catalog.constant';

/**
 * Something the business stocks and sells.
 *
 * Every monetary field here is an integer in the Organization's currency
 * minor units. CONTEXT.md D4 — there is no float anywhere in this file, and
 * adding one is a correctness bug, not a style choice.
 */
@Schema({ timestamps: true })
export class Product {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, trim: true, type: String })
  name: string;

  /** Stock-keeping unit. Unique within the Organization, not globally. */
  @Prop({ required: true, trim: true, uppercase: true, type: String })
  sku: string;

  /** Scanned at the counter. Optional — plenty of local goods have none. */
  @Prop({ trim: true, type: String })
  barcode: string;

  @Prop({ type: String, trim: true })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', index: true })
  category: Types.ObjectId;

  /** Unit of measure as written on the shelf label: pcs, kg, ctn, dozen. */
  @Prop({ type: String, trim: true, default: 'pcs' })
  unit: string;

  /**
   * How many base units are in one selling pack. A carton of 24 has
   * `packSize: 24`, which is what lets a WhatsApp order for "2 cartons"
   * resolve to 48 units without the AI doing arithmetic. CONTEXT.md D9.
   */
  @Prop({ type: Number, default: 1, min: 1 })
  packSize: number;

  // --- Money -------------------------------------------------------------

  /**
   * Moving weighted-average cost, in minor units.
   *
   * Maintained exclusively by `InventoryService` via `movingAverageCost` on
   * every inbound movement. Never set directly from a DTO — a hand-edited
   * cost basis makes every historical margin figure a lie. CONTEXT.md D3.
   */
  @Prop({ type: Number, default: 0, min: 0 })
  averageCost: number;

  /** What the last goods receipt actually charged. Display and comparison only. */
  @Prop({ type: Number, default: 0, min: 0 })
  lastPurchasePrice: number;

  /** Default selling price before customer-specific pricing or discounts. */
  @Prop({ required: true, type: Number, min: 0 })
  sellingPrice: number;

  /**
   * Floor price. A cashier discounting below this is refused unless they hold
   * the override permission — margin protection that a "suggested price"
   * alone does not provide.
   */
  @Prop({ type: Number, default: 0, min: 0 })
  minimumPrice: number;

  // --- Tax ---------------------------------------------------------------

  @Prop({
    type: String,
    enum: Object.values(TAX_TREATMENT),
    default: TAX_TREATMENT.STANDARD,
  })
  taxTreatment: TAX_TREATMENT;

  /**
   * Overrides the Organization's default rate for this product only.
   * Null means "use the organization default", which is not the same as 0
   * (an explicitly zero-rated product) — hence nullable rather than defaulted.
   */
  @Prop({ type: Number, default: null, min: 0, max: 100 })
  taxRatePercent: number | null;

  // --- Stock -------------------------------------------------------------

  /**
   * Cached sum of every StockLedgerEntry for this product, across locations.
   *
   * A projection, never the truth. `InventoryService.recalculateStock` can
   * rebuild it from the ledger at any time, and the reconciliation job does
   * exactly that. Read it for list screens; never decide whether a sale may
   * proceed from it without the ledger check behind it. CONTEXT.md D2.
   */
  @Prop({ type: Number, default: 0 })
  stockOnHand: number;

  /** Below this, the product appears in low-stock alerts and the digest. */
  @Prop({ type: Number, default: 0, min: 0 })
  reorderLevel: number;

  /** How much to order when restocking. Used by the purchase suggestion. */
  @Prop({ type: Number, default: 0, min: 0 })
  reorderQuantity: number;

  /**
   * Whether movements of this product must carry a batch number and expiry.
   * Off by default; turning it on is a UI change, not a migration, because
   * every ledger row already has the fields. CONTEXT.md D2.
   */
  @Prop({ type: Boolean, default: false })
  trackBatches: boolean;

  /**
   * Whether this product is stocked at all. A delivery charge or a service
   * line is sold but never counted, and must not appear in stock reports.
   */
  @Prop({ type: Boolean, default: true })
  trackStock: boolean;

  @Prop({ type: String })
  image: string;

  @Prop({
    type: String,
    enum: Object.values(PRODUCT_STATUS),
    default: PRODUCT_STATUS.ACTIVE,
  })
  status: PRODUCT_STATUS;

  /** Default supplier, used to pre-fill a purchase order. */
  @Prop({ type: Types.ObjectId, ref: 'Supplier' })
  preferredSupplier: Types.ObjectId;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

export type ProductDocument = Product & Document;

// A SKU identifies a product to humans inside one business. Unique per tenant,
// freely repeated across tenants — a global unique index here would leak the
// existence of other businesses' catalogues through collision errors.
ProductSchema.index({ organization: 1, sku: 1 }, { unique: true });
ProductSchema.index({ organization: 1, barcode: 1 }, { sparse: true });
ProductSchema.index({ organization: 1, status: 1, name: 1 });
// Serves the low-stock digest and dashboard tile without a collection scan.
ProductSchema.index({ organization: 1, trackStock: 1, stockOnHand: 1 });
// Text search over the two fields a person actually types at a counter.
ProductSchema.index({ name: 'text', sku: 'text', barcode: 'text' });
