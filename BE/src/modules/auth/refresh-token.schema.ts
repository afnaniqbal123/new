import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * A long-lived login session.
 *
 * This is the stateful half of the token design: the access JWT is short and
 * unrevocable by nature, so everything that has to be revocable — logout,
 * logout-everywhere, "this password changed, drop the sessions" — is
 * expressed against these records instead.
 */
@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  /**
   * SHA-256 of the opaque refresh token handed to the client. Storing the
   * token itself would make this collection a set of live credentials for
   * every logged-in user; storing the digest means a leak yields nothing that
   * can be replayed.
   */
  @Prop({ required: true, unique: true, type: String })
  tokenHash: string;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ required: true, default: false, type: Boolean })
  isRevoked: boolean;

  /**
   * Set when this token is exchanged for a successor. It is what makes reuse
   * detectable: a rotated token should never be presented again, so if one
   * is, the copy the legitimate client holds is not the only copy in
   * existence and the whole session family is dropped.
   */
  @Prop({ type: Date, default: null })
  rotatedAt: Date | null;

  @Prop({ type: String })
  deviceInfo: string;

  @Prop({ type: String })
  ipAddress: string;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

export type RefreshTokenDocument = RefreshToken & Document;

// Create index for automatic cleanup of expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ userId: 1 });
