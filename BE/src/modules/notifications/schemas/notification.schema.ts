import { Document, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type NotificationDocument = Notification & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
})
export class Notification {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object, default: {} })
  data: Record<string, unknown>;

  @Prop({ required: false, default: false })
  isDeleted: boolean;

  createdAt: Date;

  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
