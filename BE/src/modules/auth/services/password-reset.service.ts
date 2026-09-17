import * as crypto from 'crypto';
import { Model, Types } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  PASSWORD_RESET_TOKEN_BYTES,
  PASSWORD_RESET_TOKEN_VALIDITY_MINUTES,
} from 'src/constants/config.constant';
import { PasswordResetToken } from 'src/modules/auth/password-reset-token.schema';
import { hashOpaqueToken } from 'src/modules/auth/utils/auth.util';

/**
 * Issues and consumes password-reset credentials.
 *
 * Two properties matter and both live here:
 *
 * 1. **Identity is carried by the credential.** `consume()` returns the user
 *    id that was stored when the token was issued. Callers cannot supply the
 *    account to reset, so a token minted for one user can only ever reset
 *    that user.
 * 2. **Exactly one use.** Claiming is a single conditional update, so a
 *    replayed or concurrently-submitted token finds nothing left to claim.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(PasswordResetToken.name)
    private readonly passwordResetTokenModel: Model<PasswordResetToken>,
  ) {}

  /**
   * Mint a reset credential for a user and return the raw token — the only
   * moment it exists in plaintext. Hand it straight to the email/link builder
   * and never log it: a raw token in an application log, an access log, or an
   * error report is a working password reset for that account.
   */
  async issue(userId: string): Promise<string> {
    // Any reset already outstanding for this user is retired first. Otherwise
    // asking for a second reset link leaves the first one live, and a token
    // leaked from an older email stays usable.
    await this.invalidateOutstanding(userId);

    const rawToken = crypto
      .randomBytes(PASSWORD_RESET_TOKEN_BYTES)
      .toString('hex');

    await this.passwordResetTokenModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt: new Date(
        Date.now() + PASSWORD_RESET_TOKEN_VALIDITY_MINUTES * 60 * 1000,
      ),
      usedAt: null,
    });

    return rawToken;
  }

  /**
   * Claim a reset credential, returning the user it authorizes — or `null` if
   * the token is unknown, expired, or already spent.
   *
   * The match and the consumption stamp are one atomic `findOneAndUpdate`, on
   * purpose. Reading the record, checking `usedAt`, then writing it back
   * would leave a window where two concurrent requests both read an unused
   * token and both proceed; expressing "claim it only if it is still unused"
   * as a single conditional update closes that window in the database.
   */
  async consume(rawToken: string): Promise<string | null> {
    const record = await this.passwordResetTokenModel.findOneAndUpdate(
      {
        tokenHash: hashOpaqueToken(rawToken),
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt: new Date() } },
      { new: true },
    );

    return record ? record.userId.toString() : null;
  }

  /**
   * Retire every outstanding reset for a user. Called when a new one is
   * issued, and after a password changes by any other route so an in-flight
   * reset email cannot undo the change.
   */
  async invalidateOutstanding(userId: string): Promise<void> {
    await this.passwordResetTokenModel.updateMany(
      { userId: new Types.ObjectId(userId), usedAt: null },
      { $set: { usedAt: new Date() } },
    );
  }
}
