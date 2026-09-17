import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { HttpStatus, Injectable } from '@nestjs/common';

import {
  OTP_EXPIRY_MINUTES,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  USE_TOTP,
} from 'src/constants/config.constant';
import { OTP_TYPE } from 'src/modules/auth/types/otp.type';
import { EMAIL_SUBJECT } from 'src/modules/auth/types/email.type';
import {
  SerializeHttpError,
  SerializeHttpResponse,
} from 'src/utils/serializer';
import {
  AUTH_SUCCESS,
  AUTH_ERRORS,
} from 'src/modules/auth/constants/api-response/auth.response';
import {
  generateSecureOTP,
  generateTOTP,
  generateTOTPSecret,
  verifyTOTP,
} from 'src/modules/auth/utils/auth.util';
import { ITemplates } from 'src/types/templates.type';
import {
  OTP_ERROR,
  OTP_SUCCESS,
} from 'src/modules/auth/constants/api-response/otp.response';
import { User } from 'src/modules/user/user.schema';
import { USER_STATUS } from 'src/modules/user/constants/user.constant';
import { EmailService } from '../email/services/email-service';
import { UserEmailDto } from './dto/forgot-password.dto';
import { OtpDto } from './dto/otp.dto';
import { Otp } from './otp.schema';
import { PasswordResetService } from './services/password-reset.service';
import { RefreshTokenService } from './refresh-token.service';

@Injectable()
export class OtpService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Otp.name) private readonly otpModel: Model<Otp>,
    private readonly emailService: EmailService,
    private readonly passwordResetService: PasswordResetService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async generateOTP(
    userInput: UserEmailDto,
    accessType: OTP_TYPE,
    subject: EMAIL_SUBJECT,
  ) {
    const email = userInput.email.toLowerCase();
    const user = await this.userModel.findOne({ email });

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        AUTH_ERRORS.USER_NOT_FOUND,
      );
    }

    // Check for recent OTP to prevent spam
    const recentOtp = await this.otpModel.findOne({
      email,
      accessType,
      isVerified: false,
      createdAt: {
        $gte: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000),
      },
    });

    if (recentOtp) {
      return SerializeHttpError(
        null,
        HttpStatus.TOO_MANY_REQUESTS,
        OTP_ERROR.OTP_RESEND_TOO_SOON,
      );
    }

    // Generate OTP based on configuration
    let otp: string;
    let secret: string | undefined;

    if (USE_TOTP) {
      // Use TOTP (Time-based OTP) - more secure
      secret = generateTOTPSecret();
      otp = generateTOTP(secret);
    } else {
      // Use cryptographically secure random OTP
      otp = generateSecureOTP(OTP_LENGTH);
    }

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Mark old OTPs as verified (invalidate them)
    await this.otpModel.updateMany(
      {
        email,
        accessType,
        isVerified: false,
      },
      { isVerified: true },
    );

    // Create new OTP record
    await this.otpModel.create({
      otp,
      accessType,
      isVerified: false,
      email,
      secret,
      expiresAt,
      attempts: 0,
    });

    // Send OTP via email
    const emailData = { otp, name: user.name, email: user.email };
    const template = await this.emailService.loadTemplate(
      ITemplates.OTP,
      emailData,
    );

    await this.emailService.sendEmail(user.email, subject, template);
    return SerializeHttpResponse(true, HttpStatus.OK, OTP_SUCCESS.GENERATE_OTP);
  }

  /**
   * Verify and consume the outstanding OTP for an address.
   *
   * `validateOTP` and `verifySignupOtp` ran near-identical copies of this
   * before; two copies of an attempt-limiting check is two places for the
   * limit to quietly stop matching. Throws on every failure path, so callers
   * only handle the success case.
   */
  private async consumeOtp(
    userInput: OtpDto,
    accessType: OTP_TYPE,
  ): Promise<void> {
    const otpRecord = await this.otpModel.findOne({
      email: userInput.email.toLowerCase(),
      accessType,
      isVerified: false,
    });

    if (!otpRecord) {
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        OTP_ERROR.OTP_NOT_FOUND,
      );
    }

    if (otpRecord.expiresAt && new Date() > otpRecord.expiresAt) {
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        OTP_ERROR.OTP_EXPIRED,
      );
    }

    // Burn the record on the last attempt so the guess budget cannot be
    // refreshed by simply trying again.
    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      otpRecord.isVerified = true;
      await otpRecord.save();
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        OTP_ERROR.OTP_ATTEMPTS_EXCEEDED,
      );
    }

    const isValid =
      USE_TOTP && otpRecord.secret
        ? verifyTOTP(userInput.otp, otpRecord.secret)
        : otpRecord.otp === userInput.otp;

    otpRecord.attempts += 1;
    otpRecord.lastAttemptAt = new Date();

    if (!isValid) {
      await otpRecord.save();
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        OTP_ERROR.OTP_INVALID,
      );
    }

    otpRecord.isVerified = true;
    await otpRecord.save();
  }

  /**
   * Retire every outstanding OTP of a kind for an address.
   *
   * An unredeemed FORGOT_PASSWORD OTP is a live password-reset credential: it
   * exchanges for a fresh reset token. Anything that invalidates reset tokens
   * has to invalidate these too, or it has closed one door and left the one
   * beside it open.
   *
   * OTPs are keyed by email rather than user id, which is why this takes an
   * address.
   */
  async invalidateOutstanding(
    email: string,
    accessType: OTP_TYPE,
  ): Promise<void> {
    await this.otpModel.updateMany(
      { email: email.toLowerCase(), accessType, isVerified: false },
      { isVerified: true },
    );
  }

  async validateOTP(userInput: OtpDto, accessType: OTP_TYPE) {
    await this.consumeOtp(userInput, accessType);

    // The reset credential is bound to this account here, at the moment the
    // OTP proves ownership of the mailbox. The previous version minted a JWT
    // with an empty `sub` and leaned on the caller to say which account to
    // reset later, which is precisely the binding this avoids.
    const user = await this.userModel.findOne({
      email: userInput.email.toLowerCase(),
    });

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        AUTH_ERRORS.USER_NOT_FOUND,
      );
    }

    const resetToken = await this.passwordResetService.issue(
      user._id.toString(),
    );

    return SerializeHttpResponse(
      { resetToken },
      HttpStatus.OK,
      OTP_SUCCESS.VERIFIED_OTP,
    );
  }

  async resendSignupOtp(userInput: UserEmailDto) {
    const email = userInput.email.toLowerCase();
    const user = await this.userModel.findOne({ email });

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        AUTH_ERRORS.USER_NOT_FOUND,
      );
    }

    // Must be the complement of the guard in `verifySignupOtp`, which only
    // activates a PENDING account. Gating on "not verified and not active"
    // instead let a suspended, never-verified account request an OTP that
    // could never be redeemed — and `consumeOtp` burns it before that guard
    // runs, so each attempt destroyed a credential and still failed.
    //
    // Issuing and redeeming have to agree on which accounts are mid-signup, or
    // one of them emails codes the other refuses.
    // NOTE: this assumes a mid-signup account is always PENDING, which holds
    // because nothing in the codebase ever sets UNAPPROVED — it exists only in
    // the enum and the deny-lists. If `AuthService.signup`'s "approval of
    // ADMIN" TODO is ever implemented and starts creating UNAPPROVED accounts,
    // this predicate and `verifySignupOtp`'s guard both have to learn about it
    // or resend silently stops working for every new user.
    if (user.emailVerified || user.status !== USER_STATUS.PENDING) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        AUTH_ERRORS.SIGNUP_ALREADY_VERIFIED,
      );
    }

    // `generateOTP` now throws on every failure, so reaching this line means
    // it succeeded. The only thing left to do is relabel the message for the
    // resend case.
    const result = await this.generateOTP(
      { email },
      OTP_TYPE.SIGNUP,
      EMAIL_SUBJECT.SIGNUP_OTP,
    );

    return SerializeHttpResponse(
      result.data,
      HttpStatus.OK,
      OTP_SUCCESS.RESEND_SIGNUP_OTP,
    );
  }

  async verifySignupOtp(userInput: OtpDto) {
    await this.consumeOtp(userInput, OTP_TYPE.SIGNUP);

    // New signups default to USER_STATUS.PENDING (see auth.service.ts's
    // `signup` — pending admin approval, per its TODO), and PENDING is in
    // NOT_ALLOWED_USERS, so a never-activated account cannot sign in. This
    // app has no separate admin-approval flow, so successful OTP
    // verification IS the activation checkpoint.
    // Only a pending account may be activated this way. The update used to be
    // unconditional, so an unredeemed signup OTP could reactivate an account an
    // admin had suspended — and hand back a session while doing it. Expressed
    // as a condition on the update so the check and the write cannot race.
    const user = await this.userModel.findOneAndUpdate(
      { email: userInput.email.toLowerCase(), status: USER_STATUS.PENDING },
      { emailVerified: true, status: USER_STATUS.ACTIVE },
      { new: true },
    );

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        AUTH_ERRORS.USER_NOT_FOUND,
      );
    }

    // Signup verification logs the user in immediately, through the same
    // session path as `AuthService.signIn` — there is one way to mint
    // credentials and this is it.
    const tokens = await this.refreshTokenService.issueSession(user);

    return SerializeHttpResponse(
      { ...tokens, user: user.toJSON() },
      HttpStatus.OK,
      AUTH_SUCCESS.ACCOUNT_LOGIN,
    );
  }
}
