import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/modules/user/user.schema';

/**
 * Card schema for storing Stripe card metadata.
 * TODO: Replace userId foreign key with your actual User schema reference.
 * This schema stores only metadata - actual card details are fetched from Stripe API.
 */
export type CardDocument = Card & Document;

@Schema({ timestamps: true })
export class Card {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  stripePaymentMethodId: string;

  @Prop({ required: true })
  last4: string;

  @Prop({ required: true })
  brand: string;

  @Prop({ required: true, type: Number })
  expiryMonth: number;

  @Prop({ required: true, type: Number })
  expiryYear: number;

  @Prop({ default: false })
  isDefault: boolean;
}

export const CardSchema = SchemaFactory.createForClass(Card);
