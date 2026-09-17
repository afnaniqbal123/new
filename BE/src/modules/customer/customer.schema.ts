import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Who the business sells to.
 *
 * `phone` carries more weight here than on most records: it is the key
 * WhatsApp ingestion matches an inbound message against, so it is normalised
 * to digits-only on save. Without that, "+92 300 1234567" and "03001234567"
 * are two different customers to the machine and one customer to the human.
 */
@Schema({ timestamps: true })
export class Customer {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, trim: true, type: String })
  name: string;

  /** Shop or company name, where it differs from the contact's name. */
  @Prop({ trim: true, type: String })
  businessName: string;

  @Prop({ trim: true, type: String })
  phone: string;

  /**
   * `phone` reduced to digits, with a country code applied.
   *
   * Derived, never entered. This is what an inbound WhatsApp message is
   * matched on — see `CustomerService.findByPhone`.
   */
  @Prop({ trim: true, type: String, index: true })
  phoneNormalized: string;

  @Prop({ trim: true, lowercase: true, type: String })
  email: string;

  @Prop({ trim: true, type: String })
  address: string;

  @Prop({ trim: true, type: String })
  city: string;

  /**
   * Sales-tax registration number.
   *
   * Load-bearing, not decorative: its presence is what makes the buyer
   * "registered" for the tax engine, and in Pakistan that is the difference
   * between charging further tax and not. An absent value is treated as
   * unregistered — the conservative direction. See `PakistanTaxAdapter`.
   */
  @Prop({ trim: true, type: String })
  taxRegistrationNumber: string;

  // --- Credit ------------------------------------------------------------

  /**
   * How much this customer may owe at once, in minor units.
   *
   * Zero means cash-only: any credit sale is refused. There is deliberately
   * no "unlimited" value — a business that wants no ceiling sets a high one
   * deliberately, rather than inheriting one by omission. Invariant #2.
   */
  @Prop({ type: Number, default: 0, min: 0 })
  creditLimit: number;

  /**
   * What the customer currently owes, in minor units.
   *
   * A cached projection of the customer ledger, exactly like
   * `Product.stockOnHand` is of the stock ledger — the ledger is the truth,
   * and `CustomerService.recalculateBalance` rebuilds this from it.
   */
  @Prop({ type: Number, default: 0 })
  outstanding: number;

  /** Agreed payment terms in days. Drives the due date and the aging report. */
  @Prop({ type: Number, default: 0, min: 0 })
  paymentTermDays: number;

  /** Standing discount, applied before any per-sale discount. */
  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  discountPercent: number;

  // --- WhatsApp ----------------------------------------------------------

  /**
   * Whether this customer may be messaged.
   *
   * Off by default and never inferred from the presence of a phone number.
   * Messaging someone who did not ask to be messaged is both a Meta policy
   * violation and a good way to lose the number.
   */
  @Prop({ type: Boolean, default: false })
  whatsappOptIn: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String, trim: true })
  note: string;

  @Prop({ type: Date })
  lastPurchaseAt: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

export type CustomerDocument = Customer & Document;

/**
 * Normalises the phone number into the field WhatsApp matching uses.
 *
 * Runs on save rather than at each call site so that a customer created
 * through the API, the importer, or a seed script is matchable the same way.
 * Mongoose 9 pre-save hooks take no `next` — throwing is how they refuse.
 */
CustomerSchema.pre<CustomerDocument>('save', function normalizePhone() {
  if (!this.isModified('phone')) return;

  this.phoneNormalized = this.phone
    ? this.phone.replace(/\D/g, '').replace(/^0+/, '')
    : '';
});

CustomerSchema.index({ organization: 1, name: 1 });
CustomerSchema.index({ organization: 1, phoneNormalized: 1 });
// Serves the receivables dashboard tile without scanning the collection.
CustomerSchema.index({ organization: 1, outstanding: -1 });
