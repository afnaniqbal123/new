import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  AUTOMATION_KIND,
  AUTOMATION_STATUS,
  DELIVERY_CHANNEL,
} from 'src/modules/automation/constants/automation.constant';

/**
 * A record of one automation having run.
 *
 * Kept for two reasons that both matter more than they look:
 *
 * 1. **Idempotency.** The hourly tick can fire twice for the same local hour
 *    across a restart or a second instance. Checking whether today's digest
 *    already ran is what stops a business receiving it twice.
 * 2. **Answering "did it go out?"**. When an owner says they never got their
 *    morning digest, the alternative to this collection is guessing.
 */
@Schema({ timestamps: true })
export class AutomationRun {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organization: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(AUTOMATION_KIND),
  })
  kind: AUTOMATION_KIND;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(AUTOMATION_STATUS),
    default: AUTOMATION_STATUS.PENDING,
  })
  status: AUTOMATION_STATUS;

  /**
   * The local calendar day this run covers, as `YYYY-MM-DD` in the
   * organization's timezone.
   *
   * A string rather than a Date, deliberately: the question being asked is
   * "has today's digest gone out?", and "today" is a calendar concept in a
   * specific timezone, not an instant. Comparing instants would make the
   * answer depend on the server's clock.
   */
  @Prop({ required: true, type: String, index: true })
  localDate: string;

  /** Which hour slot it was for, so morning and evening runs stay distinct. */
  @Prop({ type: Number })
  localHour: number;

  /** A short human-readable result — what the digest actually said. */
  @Prop({ type: String })
  summary: string;

  /** Structured figures, so a run can be re-rendered without recomputing. */
  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({
    type: [String],
    enum: Object.values(DELIVERY_CHANNEL),
    default: [],
  })
  channels: DELIVERY_CHANNEL[];

  /** How many messages, alerts or notifications this run produced. */
  @Prop({ type: Number, default: 0 })
  itemsAffected: number;

  @Prop({ type: String })
  error: string;

  @Prop({ type: Date })
  completedAt: Date;
}

export const AutomationRunSchema = SchemaFactory.createForClass(AutomationRun);

export type AutomationRunDocument = AutomationRun & Document;

// The idempotency guard: one run per organization, per kind, per local day
// and hour slot. A unique index rather than a check-then-write, because two
// instances ticking simultaneously is exactly the case a check-then-write
// loses.
AutomationRunSchema.index(
  { organization: 1, kind: 1, localDate: 1, localHour: 1 },
  { unique: true },
);
AutomationRunSchema.index({ organization: 1, createdAt: -1 });
