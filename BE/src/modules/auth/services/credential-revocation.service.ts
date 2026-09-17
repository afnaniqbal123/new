import { Injectable } from '@nestjs/common';
import { OtpService } from 'src/modules/auth/otp.service';
import { RefreshTokenService } from 'src/modules/auth/refresh-token.service';
import { PasswordResetService } from 'src/modules/auth/services/password-reset.service';
import { OTP_TYPE } from 'src/modules/auth/types/otp.type';

/**
 * Everything a password change must invalidate, in one place.
 *
 * This exists because the alternative did not work. The rule — "a new password
 * invalidates what the old one could reach" — was applied as a checklist at
 * each call site, and every time the list grew, some call sites got the new
 * item and others did not. Sessions were revoked in three places and reset
 * links in two; the OTP that mints reset links was retired in none, so a
 * leaked code could undo a password reset for its whole validity window.
 *
 * A checklist repeated at N sites is wrong at some of them. One method is
 * wrong everywhere or nowhere, and "nowhere" is testable.
 *
 * Call this from anywhere a password is written for an **existing** account.
 * Account creation has nothing to revoke.
 */
@Injectable()
export class CredentialRevocationService {
  constructor(
    private readonly refreshTokenService: RefreshTokenService,
    private readonly passwordResetService: PasswordResetService,
    private readonly otpService: OtpService,
  ) {}

  /**
   * @param userId owner of the sessions and reset tokens
   * @param email  address the OTPs are keyed by
   */
  async onPasswordChanged(userId: string, email: string): Promise<void> {
    // Sequential awaits, no transaction across three collections — so order
    // decides what survives a throw part-way. Longest-lived self-renewing
    // credential first.
    //
    // A refresh token is not a leaf: `refreshAccessToken` mints a fresh access
    // *and* refresh token on every use, and re-checks only account status,
    // never whether the password changed. Left alive it renews itself for
    // REFRESH_TOKEN_VALIDITY_DAYS (60), and `revokeAllForUser` is the only
    // thing that stops it — there is no passwordChangedAt or token version.
    //
    // A surviving reset token is worth 30 minutes of direct takeover. The OTPs
    // last 5 minutes, but the value is the credential they redeem *for*, not
    // the window: a FORGOT_PASSWORD OTP buys a 30-minute reset token, and a
    // SIGNUP OTP buys a full session. SIGNUP still goes last because it only
    // redeems for a PENDING account — precisely the case where step one had no
    // sessions to revoke.
    //
    // Both OTP types, not just the reset one: a SIGNUP OTP redeems directly
    // for a session (`verifySignupOtp`), which is a stronger credential than
    // the reset link, not a weaker one.
    await this.refreshTokenService.revokeAllForUser(userId);
    await this.passwordResetService.invalidateOutstanding(userId);
    await this.otpService.invalidateOutstanding(
      email,
      OTP_TYPE.FORGOT_PASSWORD,
    );
    await this.otpService.invalidateOutstanding(email, OTP_TYPE.SIGNUP);
  }

  /**
   * Ends every session for a user whose *authorization* changed — a role
   * change or a deactivation — without touching password-reset credentials.
   *
   * Narrower than `onPasswordChanged` on purpose. Nothing about the account's
   * password is in question here, so invalidating an outstanding reset link
   * would log out a legitimate recovery attempt for no security gain.
   *
   * It is needed at all because access tokens carry role claims and are
   * verified without a database read (ADR 0001): a demoted user otherwise
   * keeps their old permissions until the token expires.
   */
  async onAuthorizationChanged(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAllForUser(userId);
  }
}
