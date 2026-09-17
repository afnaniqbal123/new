import { Document, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type NotificationReadStatusDocument = NotificationReadStatus & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
})
export class NotificationReadStatus {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Notification' })
  notificationId: Types.ObjectId;

  @Prop({ required: true, default: false })
  isRead: boolean;

  @Prop({ type: Date, required: false, default: null })
  readAt: Date | null;

  createdAt: Date;

  updatedAt: Date;
}

export const NotificationReadStatusSchema = SchemaFactory.createForClass(
  NotificationReadStatus,
);

NotificationReadStatusSchema.index(
  { userId: 1, notificationId: 1 },
  { unique: true },
);
