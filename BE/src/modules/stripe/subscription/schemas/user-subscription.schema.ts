import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/modules/user/user.schema';
import { Subscription } from './subscription.schema';
import { SubscriptionStatusEnum } from '../enums/subscription-status.enum';

export type UserSubscriptionDocument = UserSubscription & Document;

@Schema({ timestamps: true })
export class UserSubscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true })
  subscriptionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: false })
  pendingSubscriptionId?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  stripeSubscriptionId: string;

  @Prop({
    type: String,
    enum: SubscriptionStatusEnum,
    default: SubscriptionStatusEnum.INCOMPLETE,
  })
  status: SubscriptionStatusEnum;

  @Prop({ required: false })
  currentPeriodEnd?: Date;

  @Prop({ required: false })
  canceledAt?: Date;

  @Prop({ required: false })
  resumesAt?: Date;

  @Prop({ default: false })
  isPaused: boolean;

  @Prop({ default: false })
  isCurrent: boolean;

  @Prop({ required: false })
  scheduledChangeAt?: Date;

  @Prop({ required: false })
  stripeSubscriptionScheduleId?: string;

  @Prop({ required: false })
  invoiceId?: string;

  @Prop({ required: false })
  paymentMethodLast4?: string;
}

export const UserSubscriptionSchema =
  SchemaFactory.createForClass(UserSubscription);
