import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from 'src/modules/email/services/email-service';
import { User } from 'src/modules/user/user.schema';
import { USER_STATUS } from 'src/modules/user/constants/user.constant';
import { Otp } from './otp.schema';
import { OtpService } from './otp.service';
import { OTP_TYPE } from './types/otp.type';
import { PasswordResetService } from './services/password-reset.service';
import { RefreshTokenService } from './refresh-token.service';

const EMAIL = 'user@example.com';

describe('OtpService', () => {
  let service: OtpService;
  let otpModel: { updateMany: jest.Mock; findOne: jest.Mock };
  let userModel: { findOneAndUpdate: jest.Mock; findOne: jest.Mock };
  let refreshTokenService: { issueSession: jest.Mock };

  beforeEach(async () => {
    otpModel = {
      updateMany: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
    };
    userModel = { findOneAndUpdate: jest.fn(), findOne: jest.fn() };
    refreshTokenService = { issueSession: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Otp.name), useValue: otpModel },
        { provide: EmailService, useValue: {} },
        { provide: PasswordResetService, useValue: {} },
        { provide: RefreshTokenService, useValue: refreshTokenService },
      ],
    }).compile();

    service = module.get(OtpService);
  });

  describe('invalidateOutstanding', () => {
    it('retires only unredeemed OTPs of the given kind', async () => {
      await service.invalidateOutstanding(EMAIL, OTP_TYPE.FORGOT_PASSWORD);

      expect(otpModel.updateMany).toHaveBeenCalledWith(
        {
          email: EMAIL,
          accessType: OTP_TYPE.FORGOT_PASSWORD,
          isVerified: false,
        },
        { isVerified: true },
      );
    });

    // A case mismatch here would make the whole thing a silent no-op, since
    // every write lowercases the address.
    it('matches the lowercased address the OTP was written with', async () => {
      await service.invalidateOutstanding('User@Example.COM', OTP_TYPE.SIGNUP);

      const [filter] = otpModel.updateMany.mock.calls[0] as [{ email: string }];
      expect(filter.email).toBe(EMAIL);
    });
  });

  describe('verifySignupOtp — activation guard', () => {
    /**
     * The regression risk of the guard: `AuthService.signup` creates without an
     * explicit status, so the schema default (`PENDING`) applies. If that ever
     * stops matching, every new user silently loses the ability to verify —
     * worse than the bug the guard fixed, and previously untested.
     */
    it('still activates a pending account and issues a session', async () => {
      jest
        .spyOn(
          service as unknown as { consumeOtp: () => Promise<void> },
          'consumeOtp',
        )
        .mockResolvedValue(undefined);
      const activated = {
        _id: 'user-1',
        email: EMAIL,
        toJSON: () => ({ _id: 'user-1', email: EMAIL }),
      };
      userModel.findOneAndUpdate.mockResolvedValue(activated);
      refreshTokenService.issueSession.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
      });

      const result = await service.verifySignupOtp({
        email: EMAIL,
        otp: '123456',
      });

      const [filter, update] = userModel.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(filter.status).toBe(USER_STATUS.PENDING);
      expect(update).toMatchObject({
        emailVerified: true,
        status: USER_STATUS.ACTIVE,
      });
      expect(refreshTokenService.issueSession).toHaveBeenCalledWith(activated);
      expect(result.status).toBe(HttpStatus.OK);
    });

    /**
     * The update used to be unconditional, so an unredeemed signup OTP could
     * reactivate an account an admin had suspended — and issue a session while
     * doing it. The condition is on the update itself so the check cannot race
     * the write.
     */
    it('only activates an account that is still pending', async () => {
      jest
        .spyOn(
          service as unknown as { consumeOtp: () => Promise<void> },
          'consumeOtp',
        )
        .mockResolvedValue(undefined);
      userModel.findOneAndUpdate.mockResolvedValue(null);

      // No pending account matches, so nothing is activated and no session is
      // minted — the refusal surfaces as a thrown envelope.
      await expect(
        service.verifySignupOtp({ email: EMAIL, otp: '123456' }),
      ).rejects.toBeInstanceOf(HttpException);

      const [filter] = userModel.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(filter.status).toBe(USER_STATUS.PENDING);
    });
  });

  describe('resendSignupOtp — issuance matches redemption', () => {
    const pendingUser = {
      email: EMAIL,
      emailVerified: false,
      status: USER_STATUS.PENDING,
    };

    beforeEach(() => {
      jest
        .spyOn(service, 'generateOTP')
        .mockResolvedValue({ data: true, status: 200, message: 'ok' });
    });

    it('resends for an account that is still mid-signup', async () => {
      userModel.findOne.mockResolvedValue(pendingUser);

      await service.resendSignupOtp({ email: EMAIL });

      expect(service.generateOTP).toHaveBeenCalled();
    });

    /**
     * The predicate has to be the complement of the redemption guard. Gating
     * on "not active" instead let a suspended, never-verified account request
     * an OTP it could never redeem — and each attempt burned it in
     * `consumeOtp` before the guard ran.
     */
    it.each([[USER_STATUS.INACTIVE], [USER_STATUS.UNAPPROVED]])(
      'refuses a never-verified account in %s',
      async (status) => {
        userModel.findOne.mockResolvedValue({ ...pendingUser, status });

        await expect(
          service.resendSignupOtp({ email: EMAIL }),
        ).rejects.toBeInstanceOf(HttpException);
        expect(service.generateOTP).not.toHaveBeenCalled();
      },
    );

    it('refuses an already-verified account', async () => {
      userModel.findOne.mockResolvedValue({
        ...pendingUser,
        emailVerified: true,
      });

      await expect(
        service.resendSignupOtp({ email: EMAIL }),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });
});
