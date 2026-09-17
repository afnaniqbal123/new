import { HttpStatus } from '@nestjs/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CUSTOMER_LEDGER_TYPE } from 'src/modules/customer/constants/customer.constant';
import { CUSTOMER_RESPONSE } from 'src/modules/customer/constants/api-response/customer.response';
import { SerializeHttpError } from 'src/utils/serializer';

/**
 * One immutable movement of what a customer owes.
 *
 * The same design as the stock ledger, for the same reason: the question a
 * business actually asks is not "what does this customer owe?" but "why does
 * this customer owe that?", and only an unedited history can answer it.
 * `Customer.outstanding` is a cached sum of these rows. CONTEXT.md D2,
 * Invariant #3.
 *
 * Sign convention, stated once and enforced everywhere: **positive increases
 * the debt**. A credit sale is positive; a payment is negative.
 */
@Schema({ timestamps: true })
export class CustomerLedgerEntry {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Customer', index: true })
  customer: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(CUSTOMER_LEDGER_TYPE),
  })
  type: CUSTOMER_LEDGER_TYPE;

  /** Signed, in minor units. Positive increases what is owed. */
  @Prop({ required: true, type: Number })
  amount: number;

  /** Balance after this movement, so a statement needs no re-scan. */
  @Prop({ required: true, type: Number, default: 0 })
  balanceAfter: number;

  /** The Sale or Payment that caused this. Untyped for the same reason the
   * stock ledger's is: this collection must not import every module that can
   * move a balance. */
  @Prop({ type: Types.ObjectId })
  reference: Types.ObjectId;

  @Prop({ type: String, trim: true })
  referenceType: string;

  /** Human-facing document number, for the statement. */
  @Prop({ type: String, trim: true })
  referenceNumber: string;

  /**
   * When this becomes overdue. Set from the customer's payment terms at the
   * time of sale, and stamped on the row rather than recomputed — terms
   * change, and an old invoice keeps the terms it was sold under.
   */
  @Prop({ type: Date })
  dueDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy: Types.ObjectId;

  @Prop({ type: String, trim: true })
  note: string;
}

export const CustomerLedgerEntrySchema =
  SchemaFactory.createForClass(CustomerLedgerEntry);

export type CustomerLedgerEntryDocument = CustomerLedgerEntry & Document;

/**
 * Append-only, enforced rather than documented — identical to the stock
 * ledger's guard, because the same well-meaning edit is the same corruption.
 */
CustomerLedgerEntrySchema.pre<CustomerLedgerEntryDocument>(
  'save',
  function preventMutation() {
    if (!this.isNew) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        CUSTOMER_RESPONSE.LEDGER_IMMUTABLE,
      );
    }
  },
);

CustomerLedgerEntrySchema.index({
  organization: 1,
  customer: 1,
  createdAt: -1,
});
// Serves the aging report: unpaid rows past their due date.
CustomerLedgerEntrySchema.index({ organization: 1, dueDate: 1 });
CustomerLedgerEntrySchema.index({ organization: 1, reference: 1 });
