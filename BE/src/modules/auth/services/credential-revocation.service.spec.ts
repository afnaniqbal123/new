import { CredentialRevocationService } from './credential-revocation.service';
import { OTP_TYPE } from 'src/modules/auth/types/otp.type';

const USER_ID = '507f1f77bcf86cd799439011';
const EMAIL = 'user@example.com';

/**
 * This service exists because the rule "a new password invalidates what the
 * old one could reach" was a checklist repeated at three call sites, and the
 * list was different at each. These tests pin the whole list in one place.
 */
describe('CredentialRevocationService', () => {
  let refreshTokenService: { revokeAllForUser: jest.Mock };
  let passwordResetService: { invalidateOutstanding: jest.Mock };
  let otpService: { invalidateOutstanding: jest.Mock };
  let service: CredentialRevocationService;

  beforeEach(() => {
    refreshTokenService = {
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    passwordResetService = {
      invalidateOutstanding: jest.fn().mockResolvedValue(undefined),
    };
    otpService = {
      invalidateOutstanding: jest.fn().mockResolvedValue(undefined),
    };

    service = new CredentialRevocationService(
      refreshTokenService as never,
      passwordResetService as never,
      otpService as never,
    );
  });

  it('revokes every live session', async () => {
    await service.onPasswordChanged(USER_ID, EMAIL);

    expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith(USER_ID);
  });

  it('retires outstanding reset tokens', async () => {
    await service.onPasswordChanged(USER_ID, EMAIL);

    expect(passwordResetService.invalidateOutstanding).toHaveBeenCalledWith(
      USER_ID,
    );
  });

  /**
   * An unredeemed FORGOT_PASSWORD OTP exchanges for a fresh reset token, so
   * leaving it live lets its holder undo the password change for the OTP's
   * whole window.
   */
  it('retires the OTPs that mint reset tokens', async () => {
    await service.onPasswordChanged(USER_ID, EMAIL);

    expect(otpService.invalidateOutstanding).toHaveBeenCalledWith(
      EMAIL,
      OTP_TYPE.FORGOT_PASSWORD,
    );
  });

  /**
   * A SIGNUP OTP redeems straight for a session — a stronger credential than
   * the reset link, not a weaker one. Missed for eight review rounds because
   * the rule was read as "reset credentials" rather than "anything that mints
   * a credential".
   */
  it('retires the OTPs that mint sessions directly', async () => {
    await service.onPasswordChanged(USER_ID, EMAIL);

    expect(otpService.invalidateOutstanding).toHaveBeenCalledWith(
      EMAIL,
      OTP_TYPE.SIGNUP,
    );
  });

  // The point of the class: callers get all of it or none of it.
  it('does every revocation from one call', async () => {
    await service.onPasswordChanged(USER_ID, EMAIL);

    expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledTimes(1);
    expect(passwordResetService.invalidateOutstanding).toHaveBeenCalledTimes(1);
    expect(otpService.invalidateOutstanding).toHaveBeenCalledTimes(2);
  });

  /**
   * No transaction wraps these, so order decides what survives a throw.
   * Refresh tokens go first because they are the longest-lived credential
   * that renews itself — `refreshAccessToken` mints a new pair on every use
   * and never checks whether the password changed, so one surviving token is
   * worth 60 days. A surviving reset token is worth 30 minutes and an OTP 5.
   */
  it('revokes the longest-lived self-renewing credential first', async () => {
    const order: string[] = [];
    otpService.invalidateOutstanding.mockImplementation(() => {
      order.push('otp');
      return Promise.resolve();
    });
    passwordResetService.invalidateOutstanding.mockImplementation(() => {
      order.push('reset-token');
      return Promise.resolve();
    });
    refreshTokenService.revokeAllForUser.mockImplementation(() => {
      order.push('session');
      return Promise.resolve();
    });

    await service.onPasswordChanged(USER_ID, EMAIL);

    expect(order).toEqual(['session', 'reset-token', 'otp', 'otp']);
  });
});
