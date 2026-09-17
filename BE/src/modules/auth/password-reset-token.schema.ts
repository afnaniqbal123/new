import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * A one-time password-reset capability.
 *
 * Deliberately not a JWT. Single-use and immediate invalidation are the whole
 * point of a reset credential, and both are server-side state — a stateless
 * token cannot express "already used". So the record is the credential, and
 * what the user receives is just a lookup key for it.
 */
@Schema({ timestamps: true })
export class PasswordResetToken {
  /**
   * The account this credential resets. Authoritative: the reset endpoint
   * takes the target user from here and from nowhere else, so a request can
   * never point a valid token at a different account.
   */
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  /**
   * SHA-256 of the token that was emailed. Only the hash is stored: a dump of
   * this collection then yields nothing usable, the same reason password
   * digests are stored rather than passwords. The raw token is high-entropy
   * random, so a fast hash is the right choice here — there is no low-entropy
   * guess space for an attacker to grind through.
   */
  @Prop({ required: true, unique: true, type: String })
  tokenHash: string;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  /**
   * Consumption stamp. `null` means unused; the reset flow flips it inside
   * the same atomic query that claims the token, which is what makes two
   * concurrent submissions of the same token resolve to exactly one success.
   */
  @Prop({ type: Date, default: null })
  usedAt: Date | null;
}

export const PasswordResetTokenSchema =
  SchemaFactory.createForClass(PasswordResetToken);

export type PasswordResetTokenDocument = PasswordResetToken & Document;

// Spent and expired records carry no value and are a liability if leaked;
// Mongo drops them once they are past expiry.
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordResetTokenSchema.index({ userId: 1 });
