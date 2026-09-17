import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  BILLING_PLAN,
  ORGANIZATION_STATUS,
} from 'src/modules/organization/constants/organization.constant';

/**
 * How this Organization computes tax.
 *
 * Deliberately data, not code. The country code selects a `TaxAdapter` (see
 * `src/modules/tax/`) which knows the *rules*; these fields carry the
 * *rates and registrations* that differ per business inside one country.
 * Hardcoding 18% would make the second customer a code change. CONTEXT.md D7.
 */
@Schema({ _id: false })
export class TaxSettings {
  /** Sales-tax registration number (STRN in PK, TRN in AE, VAT no. in GB). */
  @Prop({ type: String, trim: true })
  registrationNumber: string;

  /** National tax number, where the jurisdiction separates the two. */
  @Prop({ type: String, trim: true })
  nationalTaxNumber: string;

  /** Standard rate, as a percentage. PK standard GST is 18 at time of writing. */
  @Prop({ type: Number, default: 18, min: 0, max: 100 })
  defaultRatePercent: number;

  /**
   * Whether catalogue prices already contain tax.
   *
   * Distributors quote both ways, and getting it wrong misstates every total
   * by the tax amount — so it is an explicit setting, never inferred.
   */
  @Prop({ type: Boolean, default: false })
  pricesIncludeTax: boolean;

  /**
   * PK "further tax" on supplies to unregistered buyers — 3% at time of
   * writing. Applied only when the Customer has no registration number.
   * Zero disables it, which is what every non-PK adapter leaves it at.
   */
  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  furtherTaxPercent: number;

  /** Withholding rate applied on supplier payments, where applicable. */
  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  withholdingPercent: number;
}

/**
 * Invoice numbering.
 *
 * `nextNumber` is incremented atomically by `$inc` inside the sale
 * transaction, never read-then-written — two concurrent sales at one counter
 * is the ordinary case, not an edge case, and read-then-write duplicates a
 * legally-significant number. Invariant #4.
 */
@Schema({ _id: false })
export class InvoiceSettings {
  @Prop({ type: String, default: 'INV', trim: true, uppercase: true })
  prefix: string;

  @Prop({ type: Number, default: 1, min: 1 })
  nextNumber: number;

  /** Zero-padding width, so INV-000001 sorts lexically as well as numerically. */
  @Prop({ type: Number, default: 6, min: 1, max: 12 })
  padding: number;

  @Prop({ type: String, trim: true })
  footerNote: string;
}

@Schema({ _id: false })
export class OperationalSettings {
  /**
   * Whether a sale may drive stock below zero.
   *
   * Off by default: silently selling stock you do not have is the phantom
   * inventory this product exists to eliminate. Businesses that genuinely
   * sell ahead of receipt turn it on deliberately. Invariant #1.
   */
  @Prop({ type: Boolean, default: false })
  allowNegativeStock: boolean;

  /** Whether the daily digest and low-stock automations run. */
  @Prop({ type: Boolean, default: true })
  automationsEnabled: boolean;

  /** Local hour (0-23) the morning digest is sent in the org's timezone. */
  @Prop({ type: Number, default: 9, min: 0, max: 23 })
  morningDigestHour: number;

  /** Local hour (0-23) the evening summary is sent. */
  @Prop({ type: Number, default: 20, min: 0, max: 23 })
  eveningDigestHour: number;
}

/**
 * WhatsApp Cloud API connection for this Organization.
 *
 * Every field is optional, and absence is a supported state: the ingestion
 * pipeline runs identically against the built-in simulator when nothing here
 * is set, so a business can evaluate the whole flow before applying to Meta.
 * CONTEXT.md D10.
 */
@Schema({ _id: false })
export class WhatsAppSettings {
  @Prop({ type: Boolean, default: false })
  connected: boolean;

  @Prop({ type: String, trim: true })
  phoneNumberId: string;

  @Prop({ type: String, trim: true })
  displayPhoneNumber: string;

  /**
   * Per-organization access token, when the business connects its own Meta
   * account rather than using the platform's shared number. Stored encrypted
   * at rest by the deployment, never returned by any read route.
   */
  @Prop({ type: String, select: false })
  accessToken: string;

  /**
   * Whether an inbound message may create a DraftOrder automatically. Even
   * when true the draft still requires human confirmation — this only
   * controls whether the AI runs unprompted. CONTEXT.md D9.
   */
  @Prop({ type: Boolean, default: true })
  autoDraftOrders: boolean;
}

/**
 * The tenant. Everything else in the business domain belongs to exactly one
 * of these, and every query for a business collection filters on it.
 * CONTEXT.md D1, Invariant #6.
 */
@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true, trim: true, type: String })
  name: string;

  /** Registered legal name, where it differs from the trading name. */
  @Prop({ trim: true, type: String })
  legalName: string;

  /** URL-safe identifier, unique across the platform. */
  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    type: String,
  })
  slug: string;

  /** ISO 3166-1 alpha-2. Selects the TaxAdapter and the invoice format. */
  @Prop({ required: true, type: String, uppercase: true, default: 'PK' })
  country: string;

  /**
   * ISO 4217. Fixed per Organization: every monetary integer in this tenant
   * is in this currency's minor units, which is what lets amounts be stored
   * without repeating the code on each field. CONTEXT.md D4.
   */
  @Prop({ required: true, type: String, uppercase: true, default: 'PKR' })
  currency: string;

  /** IANA timezone. Drives digest scheduling and "today" in every report. */
  @Prop({ required: true, type: String, default: 'Asia/Karachi' })
  timezone: string;

  @Prop({ type: String, trim: true })
  phone: string;

  @Prop({ type: String, trim: true, lowercase: true })
  email: string;

  @Prop({ type: String, trim: true })
  address: string;

  @Prop({ type: String })
  logo: string;

  @Prop({
    type: String,
    enum: Object.values(ORGANIZATION_STATUS),
    default: ORGANIZATION_STATUS.ACTIVE,
  })
  status: ORGANIZATION_STATUS;

  @Prop({ type: TaxSettings, default: () => ({}) })
  tax: TaxSettings;

  @Prop({ type: InvoiceSettings, default: () => ({}) })
  invoice: InvoiceSettings;

  @Prop({ type: OperationalSettings, default: () => ({}) })
  settings: OperationalSettings;

  @Prop({ type: WhatsAppSettings, default: () => ({}) })
  whatsapp: WhatsAppSettings;

  /**
   * Which SaaS plan this Organization is on. Enforced by `PlanLimitGuard`,
   * not merely displayed — a limit that is only shown is not a limit.
   */
  @Prop({
    type: String,
    enum: Object.values(BILLING_PLAN),
    default: BILLING_PLAN.FREE,
  })
  plan: BILLING_PLAN;

  @Prop({ type: Date })
  planRenewsAt: Date;

  @Prop({ type: String })
  stripeCustomerId: string;

  @Prop({ type: String })
  stripeSubscriptionId: string;

  /** The user who created it. Retained even if their role later changes. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

export type OrganizationDocument = Organization & Document;

// The token is a secret; keeping it out of every serialized response means a
// route cannot leak it by forgetting to project it away.
OrganizationSchema.methods.toJSON = function toJSON(
  this: OrganizationDocument,
) {
  const organization = this.toObject() as Record<string, unknown>;
  const whatsapp = organization.whatsapp as Record<string, unknown> | undefined;

  if (whatsapp) {
    delete whatsapp.accessToken;
  }

  return organization;
};
