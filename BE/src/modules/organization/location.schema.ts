import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LOCATION_TYPE } from 'src/modules/organization/constants/organization.constant';

/**
 * Where stock physically sits.
 *
 * Part of the Organization aggregate, so it lives in this module rather than
 * in `inventory`: a Location exists whether or not anything is stocked in it,
 * and its lifecycle is the tenant's, not the ledger's.
 *
 * Every Organization gets exactly one `isDefault` Location at creation. That
 * is what lets the UI stay single-location while the schema stays
 * multi-location — the picker simply never appears until a second one is
 * added, and no movement ever lacks a location. CONTEXT.md D6.
 */
@Schema({ timestamps: true })
export class Location {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, trim: true, type: String })
  name: string;

  /** Short code shown on transfer documents, e.g. "WH1". */
  @Prop({ trim: true, uppercase: true, type: String })
  code: string;

  @Prop({
    type: String,
    enum: Object.values(LOCATION_TYPE),
    default: LOCATION_TYPE.WAREHOUSE,
  })
  type: LOCATION_TYPE;

  @Prop({ type: String, trim: true })
  address: string;

  @Prop({ type: String, trim: true })
  phone: string;

  /**
   * The location used when a request does not name one. Exactly one per
   * Organization; `OrganizationService` maintains that by clearing the flag
   * elsewhere when a new default is set.
   */
  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const LocationSchema = SchemaFactory.createForClass(Location);

export type LocationDocument = Location & Document;

// Location codes are referenced by humans on transfer paperwork, so they must
// be unambiguous inside a tenant — but may freely repeat across tenants.
//
// Partial rather than sparse: a sparse *compound* index still indexes a
// document whose `code` is absent (because `organization` is present), so two
// codeless locations would collide on a duplicate key.
LocationSchema.index(
  { organization: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } },
);
LocationSchema.index({ organization: 1, isDefault: 1 });
