import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AUTH_ERRORS } from 'src/modules/auth/constants/api-response/auth.response';
import { User } from 'src/modules/user/user.schema';
import { EmailService } from 'src/modules/email/services/email-service';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SocialAuthService } from './social-auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { PasswordResetService } from './services/password-reset.service';
import { CredentialRevocationService } from './services/credential-revocation.service';
import { VerifyResetPasswordDto } from './dto/forgot-password.dto';

const VICTIM_ID = '507f1f77bcf86cd799439011';
const ATTACKER_ID = '507f1f77bcf86cd799439022';

describe('AuthService — password reset', () => {
  let service: AuthService;
  let userModel: {
    findOne: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findOneAndUpdate: jest.Mock;
    create: jest.Mock;
  };
  let passwordResetService: {
    consume: jest.Mock;
    invalidateOutstanding: jest.Mock;
    issue: jest.Mock;
  };
  let refreshTokenService: {
    revokeAllForUser: jest.Mock;
    issueSession: jest.Mock;
  };
  let credentialRevocation: { onPasswordChanged: jest.Mock };

  beforeEach(async () => {
    userModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest
        .fn()
        .mockResolvedValue({ _id: ATTACKER_ID, email: 'user@example.com' }),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
    };
    passwordResetService = {
      consume: jest.fn(),
      invalidateOutstanding: jest.fn().mockResolvedValue(undefined),
      issue: jest.fn().mockResolvedValue('raw-token'),
    };
    refreshTokenService = {
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
      issueSession: jest.fn(),
    };
    credentialRevocation = {
      onPasswordChanged: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: OtpService, useValue: {} },
        {
          provide: EmailService,
          useValue: { loadTemplate: jest.fn(), sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: SocialAuthService, useValue: {} },
        { provide: RefreshTokenService, useValue: refreshTokenService },
        { provide: PasswordResetService, useValue: passwordResetService },
        {
          provide: CredentialRevocationService,
          useValue: credentialRevocation,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('resets the account the credential was issued for', async () => {
    passwordResetService.consume.mockResolvedValue(ATTACKER_ID);

    const result = await service.verifyResetPassword({
      token: 'attacker-token',
      password: 'new-password',
    });

    expect(result.status).toBe(HttpStatus.OK);
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      ATTACKER_ID,
      expect.objectContaining({ password: expect.any(String) }),
    );
  });

  /**
   * The vulnerability this replaced: a valid reset token plus somebody else's
   * email reset somebody else's password, because the token proved authority
   * and the request body chose the target.
   */
  it('cannot be aimed at another account by smuggling an email into the body', async () => {
    passwordResetService.consume.mockResolvedValue(ATTACKER_ID);

    // A client can put anything on the wire; the DTO no longer declares
    // `email`, and nothing downstream reads one.
    const hostile = {
      token: 'attacker-token',
      password: 'new-password',
      email: 'victim@example.com',
    } as VerifyResetPasswordDto;

    await service.verifyResetPassword(hostile);

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      ATTACKER_ID,
      expect.anything(),
    );
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalledWith(
      VICTIM_ID,
      expect.anything(),
    );
    // No email-keyed selector is used at any point in the reset path.
    expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(userModel.findOne).not.toHaveBeenCalled();
  });

  it('refuses an unknown, expired, or already-spent credential', async () => {
    passwordResetService.consume.mockResolvedValue(null);

    const attempt = service.verifyResetPassword({
      token: 'spent-token',
      password: 'new-password',
    });

    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await attempt.catch((error: HttpException) => {
      const body = error.getResponse() as { status: number; message: string };
      // A refusal is an HTTP error, not a 200 carrying a 403 in the body.
      expect(body.status).toBe(HttpStatus.FORBIDDEN);
      expect(body.message).toBe(AUTH_ERRORS.INVALID_TOKEN);
    });
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('drops every credential derived from the old password after a reset', async () => {
    passwordResetService.consume.mockResolvedValue(ATTACKER_ID);

    await service.verifyResetPassword({
      token: 'attacker-token',
      password: 'new-password',
    });

    // One call, not a checklist — sessions, reset links and the OTPs that
    // mint reset links all go together. See CredentialRevocationService.
    expect(credentialRevocation.onPasswordChanged).toHaveBeenCalledWith(
      ATTACKER_ID,
      'user@example.com',
    );
  });

  it('reports a missing account rather than silently succeeding', async () => {
    passwordResetService.consume.mockResolvedValue(ATTACKER_ID);
    userModel.findByIdAndUpdate.mockResolvedValue(null);

    const attempt = service.verifyResetPassword({
      token: 'attacker-token',
      password: 'new-password',
    });

    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await attempt.catch((error: HttpException) => {
      const body = error.getResponse() as { status: number };
      expect(body.status).toBe(HttpStatus.NOT_FOUND);
    });
    expect(credentialRevocation.onPasswordChanged).not.toHaveBeenCalled();
  });
});

describe('AuthService — password change', () => {
  let service: AuthService;
  let refreshTokenService: { revokeAllForUser: jest.Mock };
  let credentialRevocation: { onPasswordChanged: jest.Mock };
  let passwordResetService: { invalidateOutstanding: jest.Mock };
  let userModel: { findById: jest.Mock };

  beforeEach(async () => {
    userModel = {
      findById: jest.fn().mockResolvedValue({
        password: 'hashed',
        email: 'user@example.com',
        save: jest.fn().mockResolvedValue(undefined),
      }),
    };
    refreshTokenService = {
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    passwordResetService = {
      invalidateOutstanding: jest.fn().mockResolvedValue(undefined),
    };
    credentialRevocation = {
      onPasswordChanged: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: OtpService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: SocialAuthService, useValue: {} },
        { provide: RefreshTokenService, useValue: refreshTokenService },
        { provide: PasswordResetService, useValue: passwordResetService },
        {
          provide: CredentialRevocationService,
          useValue: credentialRevocation,
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.spyOn(service, 'verifyPassword').mockResolvedValue(true);
  });

  it('revokes every credential derived from the old password', async () => {
    const result = await service.changePassword(ATTACKER_ID, {
      currentPassword: 'old',
      newPassword: 'new',
    });

    expect(result.status).toBe(HttpStatus.OK);
    // One call, not a checklist: sessions, reset links, and the OTPs that mint
    // reset links. A reset email — or an unredeemed OTP — sent before the
    // change could otherwise roll it back.
    expect(credentialRevocation.onPasswordChanged).toHaveBeenCalledWith(
      ATTACKER_ID,
      'user@example.com',
    );
  });

  it('leaves sessions alone when the current password is wrong', async () => {
    jest.spyOn(service, 'verifyPassword').mockResolvedValue(false);

    const attempt = service.changePassword(ATTACKER_ID, {
      currentPassword: 'wrong',
      newPassword: 'new',
    });

    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await attempt.catch((error: HttpException) => {
      const body = error.getResponse() as { status: number };
      expect(body.status).toBe(HttpStatus.BAD_REQUEST);
    });
    expect(credentialRevocation.onPasswordChanged).not.toHaveBeenCalled();
  });
});
