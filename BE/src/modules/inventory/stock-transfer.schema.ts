import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TRANSFER_STATUS } from 'src/modules/inventory/constants/inventory.constant';

@Schema({ _id: false })
export class TransferLine {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Product' })
  product: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 0 })
  quantity: number;

  /**
   * How much actually arrived. Below `quantity` means shrinkage in transit,
   * which is a real and reportable event — so it is recorded rather than
   * quietly assumed equal.
   */
  @Prop({ type: Number, min: 0, default: 0 })
  receivedQuantity: number;

  @Prop({ type: String, trim: true })
  batchNo: string;
}

/**
 * Stock moving between two Locations of the same Organization.
 *
 * Modelled as two separate ledger movements at two separate moments —
 * `TRANSFER_OUT` on dispatch, `TRANSFER_IN` on receipt — rather than one
 * instantaneous swap. Goods on a van genuinely are in neither warehouse, and
 * a model that pretends otherwise cannot explain where they are when someone
 * asks. `IN_TRANSIT` is that state made explicit.
 */
@Schema({ timestamps: true })
export class StockTransfer {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, type: String, trim: true })
  reference: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Location' })
  fromLocation: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Location' })
  toLocation: Types.ObjectId;

  @Prop({ type: [TransferLine], default: [] })
  lines: TransferLine[];

  @Prop({
    type: String,
    enum: Object.values(TRANSFER_STATUS),
    default: TRANSFER_STATUS.DRAFT,
  })
  status: TRANSFER_STATUS;

  @Prop({ type: Date })
  dispatchedAt: Date;

  @Prop({ type: Date })
  receivedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: String, trim: true })
  note: string;
}

export const StockTransferSchema = SchemaFactory.createForClass(StockTransfer);

export type StockTransferDocument = StockTransfer & Document;

StockTransferSchema.index({ organization: 1, status: 1, createdAt: -1 });
StockTransferSchema.index({ organization: 1, reference: 1 }, { unique: true });
