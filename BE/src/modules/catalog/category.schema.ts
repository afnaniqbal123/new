import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * A single-level grouping of products.
 *
 * Deliberately not a tree. Distributors group by "Beverages" / "Snacks", and
 * an arbitrary-depth hierarchy buys nothing here while making every report
 * query recursive. If nesting is ever genuinely needed it arrives as a
 * `parent` field and a documented decision, not by accident.
 */
@Schema({ timestamps: true })
export class Category {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({ required: true, trim: true, type: String })
  name: string;

  @Prop({ type: String, trim: true })
  description: string;

  /** Hex colour used to tint the category chip in the POS grid. */
  @Prop({ type: String, trim: true })
  color: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

export type CategoryDocument = Category & Document;

CategorySchema.index({ organization: 1, name: 1 }, { unique: true });
