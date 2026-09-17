import { HttpStatus } from '@nestjs/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SUPPLIER_LEDGER_TYPE } from 'src/modules/purchasing/constants/purchasing.constant';
import { PURCHASING_RESPONSE } from 'src/modules/purchasing/constants/api-response/purchasing.response';
import { SerializeHttpError } from 'src/utils/serializer';

/** Who the business buys from. */
@Schema({ timestamps: true })
export class Supplier {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, trim: true, type: String })
  name: string;

  @Prop({ trim: true, type: String })
  contactPerson: string;

  @Prop({ trim: true, type: String })
  phone: string;

  @Prop({ trim: true, lowercase: true, type: String })
  email: string;

  @Prop({ trim: true, type: String })
  address: string;

  @Prop({ trim: true, type: String })
  taxRegistrationNumber: string;

  /**
   * What we owe this supplier, in minor units.
   *
   * A cached projection of the supplier ledger — same relationship as
   * `Customer.outstanding` has to its ledger. Positive means we owe them.
   */
  @Prop({ type: Number, default: 0 })
  payable: number;

  /** Days from bill date to payment due. Drives the payables aging. */
  @Prop({ type: Number, default: 0, min: 0 })
  paymentTermDays: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String, trim: true })
  note: string;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);

export type SupplierDocument = Supplier & Document;

SupplierSchema.index({ organization: 1, name: 1 });
SupplierSchema.index({ organization: 1, payable: -1 });

/**
 * One immutable movement of what we owe a supplier.
 *
 * Append-only, for the same reason the other two ledgers are: a payable you
 * can edit is a payable you cannot reconcile against the supplier's own
 * statement. Invariant #3.
 */
@Schema({ timestamps: true })
export class SupplierLedgerEntry {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Supplier', index: true })
  supplier: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(SUPPLIER_LEDGER_TYPE),
  })
  type: SUPPLIER_LEDGER_TYPE;

  /** Signed, minor units. Positive increases what we owe. */
  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ required: true, type: Number, default: 0 })
  balanceAfter: number;

  @Prop({ type: Types.ObjectId })
  reference: Types.ObjectId;

  @Prop({ type: String, trim: true })
  referenceType: string;

  @Prop({ type: String, trim: true })
  referenceNumber: string;

  @Prop({ type: Date })
  dueDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy: Types.ObjectId;

  @Prop({ type: String, trim: true })
  note: string;
}

export const SupplierLedgerEntrySchema =
  SchemaFactory.createForClass(SupplierLedgerEntry);

export type SupplierLedgerEntryDocument = SupplierLedgerEntry & Document;

SupplierLedgerEntrySchema.pre<SupplierLedgerEntryDocument>(
  'save',
  function preventMutation() {
    if (!this.isNew) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        PURCHASING_RESPONSE.LEDGER_IMMUTABLE,
      );
    }
  },
);

SupplierLedgerEntrySchema.index({
  organization: 1,
  supplier: 1,
  createdAt: -1,
});
SupplierLedgerEntrySchema.index({ organization: 1, dueDate: 1 });
