import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { HttpStatus } from '@nestjs/common';
import { STOCK_REASON } from 'src/modules/inventory/constants/inventory.constant';
import { INVENTORY_RESPONSE } from 'src/modules/inventory/constants/api-response/inventory.response';
import { SerializeHttpError } from 'src/utils/serializer';

/**
 * One immutable stock movement.
 *
 * This collection is the **truth** about stock. `Product.stockOnHand` is a
 * cached sum of these rows and can be rebuilt from them at any time; if the
 * two ever disagree, this one is right. CONTEXT.md D2.
 *
 * Append-only, without exception (Invariant #3). A miscount is corrected by
 * writing a compensating `ADJUSTMENT` row, never by editing or deleting the
 * original — because the question a distributor actually needs answered is
 * not "what is the stock?" but "why is the stock that?", and an edited
 * history cannot answer it. That is the phantom-inventory problem this
 * product exists to solve, so the schema refuses to permit it: the pre-save
 * hook below rejects any modification of an existing document.
 */
@Schema({ timestamps: true })
export class StockLedgerEntry {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Product', index: true })
  product: Types.ObjectId;

  /**
   * Where the movement happened. Required, always — a movement with no
   * location cannot be reconciled against a physical count. CONTEXT.md D6.
   */
  @Prop({ required: true, type: Types.ObjectId, ref: 'Location', index: true })
  location: Types.ObjectId;

  /**
   * Signed. Positive is inbound, negative is outbound.
   *
   * Signed rather than a separate direction field so that stock on hand is
   * `sum(quantity)` — one aggregation with nothing to get backwards. A
   * direction enum plus an unsigned magnitude means every reader must
   * remember to apply the sign, and one that forgets is a silent corruption.
   */
  @Prop({ required: true, type: Number })
  quantity: number;

  /**
   * Cost per unit at the moment of the movement, in minor units.
   *
   * Stamped on the row rather than read from the product later, because the
   * product's average cost moves. Historical margin is only computable if
   * each sale remembers what its goods cost *then*.
   */
  @Prop({ required: true, type: Number, default: 0 })
  unitCost: number;

  /** Running balance after this movement. Lets a ledger view avoid a re-scan. */
  @Prop({ required: true, type: Number, default: 0 })
  balanceAfter: number;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(STOCK_REASON),
  })
  reason: STOCK_REASON;

  /**
   * The document that caused this movement — a Sale, GoodsReceipt, or
   * StockTransfer id. Untyped by design: the ledger must not import every
   * module that can move stock, and `referenceType` says how to read it.
   */
  @Prop({ type: Types.ObjectId })
  reference: Types.ObjectId;

  @Prop({ type: String, trim: true })
  referenceType: string;

  /** Human-facing document number (INV-000123), for the ledger view. */
  @Prop({ type: String, trim: true })
  referenceNumber: string;

  // --- Optional batch tracking -------------------------------------------
  //
  // Present on every row from day one even though the UI only surfaces them
  // when `Product.trackBatches` is set. Adding them later would mean
  // migrating an append-only history — which is precisely the thing that
  // cannot be done. CONTEXT.md D2.

  @Prop({ type: String, trim: true })
  batchNo: string;

  @Prop({ type: Date })
  expiry: Date;

  /** Who caused the movement. Never null in practice; kept for audit. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy: Types.ObjectId;

  @Prop({ type: String, trim: true })
  note: string;
}

export const StockLedgerEntrySchema =
  SchemaFactory.createForClass(StockLedgerEntry);

export type StockLedgerEntryDocument = StockLedgerEntry & Document;

/**
 * Enforces append-only at the schema level.
 *
 * A comment saying "do not edit these" is a convention; this is a rule. It
 * catches the case that actually happens — a well-meaning fix that loads a
 * row, corrects a typo in the note, and saves — which would silently break
 * the guarantee every stock figure in the system depends on.
 */
StockLedgerEntrySchema.pre<StockLedgerEntryDocument>(
  'save',
  function preventMutation() {
    // Mongoose 9 removed the `next` callback from document pre-save hooks;
    // throwing is how a hook now rejects the operation. `SerializeHttpError`
    // rather than a raw Error so the refusal reaches the client as a proper
    // 409 envelope naming the remedy, not an opaque 500.
    if (!this.isNew) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        INVENTORY_RESPONSE.LEDGER_IMMUTABLE,
      );
    }
  },
);

// The stock-on-hand aggregation and the per-product ledger view both hit this.
StockLedgerEntrySchema.index({
  organization: 1,
  product: 1,
  location: 1,
  createdAt: -1,
});
// Serves "what moved today?" on the dashboard and the evening digest.
StockLedgerEntrySchema.index({ organization: 1, createdAt: -1 });
// Lets a Sale or GoodsReceipt find its own movements when reversing them.
StockLedgerEntrySchema.index({ organization: 1, reference: 1 });
// Expiry reporting for batch-tracked goods.
StockLedgerEntrySchema.index({ organization: 1, expiry: 1 }, { sparse: true });
