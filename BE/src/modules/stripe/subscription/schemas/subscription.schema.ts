import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Subscription Plan schema for storing available subscription plans.
 * This schema represents the catalog of subscription plans available to users.
 * TODO: Seed this collection with your subscription plans from Stripe.
 */
export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {
  // Unique because the create-plan route promises a 409 on a duplicate name.
  // The service's pre-check is a read, so two concurrent creates both pass it;
  // only the index makes the promise hold, and it is what turns the second
  // writer's insert into the 409 the caller was told to expect.
  @Prop({ required: true, unique: true, type: String })
  name: string;

  @Prop({ required: true, unique: true })
  stripePriceId: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ default: 'usd' })
  currency: string;

  @Prop({ default: 'month' })
  interval: string; // 'month' or 'year'

  @Prop({ type: [String], required: false })
  features?: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
