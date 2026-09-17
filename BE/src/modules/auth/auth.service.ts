import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { OtpService } from './otp.service';
import { SignupDto } from './dto/signup.dto';
import { AppleDto } from './dto/apple.dto';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  UserEmailDto,
  VerifyResetPasswordDto,
} from './dto/forgot-password.dto';
import { CONFIG } from 'src/constants/config.constant';

import { SignInDto } from './dto/signin.dto';
import {
  AUTH_ERRORS,
  AUTH_SUCCESS,
} from 'src/modules/auth/constants/api-response/auth.response';

import { createHashPassword } from 'src/modules/auth/utils/auth.util';
import {
  SerializeHttpError,
  SerializeHttpResponse,
} from 'src/utils/serializer';
import { HttpStatus, Injectable } from '@nestjs/common';

import { ITemplates } from 'src/types/templates.type';
import { User } from '../user/user.schema';
import {
  NOT_ALLOWED_USERS,
  USER_ROLES,
} from 'src/modules/user/constants/user.constant';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailService } from '../email/services/email-service';
import { SocialAuthService } from './social-auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { PasswordResetService } from './services/password-reset.service';
import { CredentialRevocationService } from './services/credential-revocation.service';
import { OTP_TYPE } from 'src/modules/auth/types/otp.type';
import { EMAIL_SUBJECT } from 'src/modules/auth/types/email.type';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly socialAuthService: SocialAuthService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly passwordResetService: PasswordResetService,
    private readonly credentialRevocation: CredentialRevocationService,
  ) {}

  async verifyPassword(plainTextPassword: string, hashedPassword: string) {
    return bcrypt.compare(plainTextPassword, hashedPassword);
  }

  // Admin will signup only!
  async signup(data: SignupDto) {
    const user = await this.userModel.findOne({
      email: data.email.toLowerCase(),
    });

    if (user) {
      // 409, not 400: the request is well-formed, it conflicts with state that
      // already exists. A client can distinguish "fix your input" from "this
      // account exists — offer sign-in instead" without parsing the message.
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        AUTH_ERRORS.DUPLICATE_EMAIL,
      );
    }

    const hashedPassword = await createHashPassword(data.password);

    // Self-signup creates a business, so the person signing up owns it.
    // Everyone else arrives by invitation with an explicitly assigned role
    // (see OrganizationService.inviteUser). CONTEXT.md D5.
    await this.userModel.create({
      ...data,
      password: hashedPassword,
      role: USER_ROLES.OWNER,
    });

    const otpData = { email: data.email.toLowerCase() };

    await this.otpService.generateOTP(
      otpData,
      OTP_TYPE.SIGNUP,
      EMAIL_SUBJECT.SIGNUP_OTP,
    );

    return SerializeHttpResponse(
      true,
      HttpStatus.CREATED,
      AUTH_SUCCESS.ACCOUNT_CREATION,
    );
  }

  async signIn(data: SignInDto) {
    const user = await this.userModel.findOne({
      email: data.email.toLowerCase(),
    });

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.INCORRECT_CREDENTIALS,
      );
    }

    const verify = await this.verifyPassword(data.password, user.password);

    if (!verify) {
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.INCORRECT_CREDENTIALS,
      );
    }

    // The same list the refresh path enforces. They used to differ — login
    // omitted PENDING — which was survivable only because the old guard
    // re-read the user and rejected PENDING on every request. Authentication
    // is stateless now, so a PENDING account admitted here would hold a
    // working token until it expired, and then have all its sessions revoked
    // at the first refresh. One list, one answer to "who may hold a session".
    if (NOT_ALLOWED_USERS.includes(user.status)) {
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.INCORRECT_CREDENTIALS,
      );
    }

    const tokens = await this.refreshTokenService.issueSession(user);

    return SerializeHttpResponse(
      { ...tokens, user: user.toJSON() },
      HttpStatus.OK,
      AUTH_SUCCESS.ACCOUNT_LOGIN,
    );
  }

  async forgotPasswordLink(data: UserEmailDto) {
    const email = data.email.toLowerCase();
    const user = await this.userModel.findOne({ email });

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        AUTH_ERRORS.USER_NOT_FOUND,
      );
    }

    const token = await this.passwordResetService.issue(user._id.toString());
    const resetLink = this.buildPasswordResetLink(token);

    const template = await this.emailService.loadTemplate(
      ITemplates.FORGOT_PASSWORD,
      {
        name: user.name,
        email: user.email,
        resetLink,
        currentYear: new Date().getFullYear(),
      },
    );

    await this.emailService.sendEmail(
      user.email,
      EMAIL_SUBJECT.FORGOT_PASSWORD_LINK,
      template,
    );

    return SerializeHttpResponse(
      null,
      HttpStatus.OK,
      AUTH_SUCCESS.FORGOT_PASSWORD_LINK,
    );
  }

  /**
   * The link carries the token and nothing else. It used to carry the address
   * too, which quietly made the recipient's email part of the reset request —
   * and therefore something the caller could change.
   */
  private buildPasswordResetLink(token: string): string {
    const base = (
      this.configService.get<string>(CONFIG.FRONTEND_URL) ?? ''
    ).replace(/\/$/, '');
    const params = new URLSearchParams({ token });
    return `${base}/reset-password?${params.toString()}`;
  }

  /**
   * Reset a password using a one-time credential.
   *
   * The account comes from the consumed token's own record — never from the
   * request. That is the entire security property here: proof of authority
   * and the identity it authorizes have to come from the same place, or a
   * token issued for one account can be pointed at another.
   */
  async verifyResetPassword(data: VerifyResetPasswordDto) {
    const userId = await this.passwordResetService.consume(data.token);

    if (!userId) {
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        AUTH_ERRORS.INVALID_TOKEN,
      );
    }

    const hashedPassword = await createHashPassword(data.password);

    const user = await this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        AUTH_ERRORS.USER_NOT_FOUND,
      );
    }

    // A reset is the standard response to "someone else may have my account".
    // Leaving anything derived from the old password alive would let whoever
    // prompted the reset keep the access they already had.
    await this.credentialRevocation.onPasswordChanged(userId, user.email);

    return SerializeHttpResponse(
      null,
      HttpStatus.OK,
      AUTH_SUCCESS.RESET_PASSWORD,
    );
  }

  async changePassword(userId: string, data: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        AUTH_ERRORS.USER_NOT_FOUND,
      );
    }

    const isPasswordValid = await this.verifyPassword(
      data.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        AUTH_ERRORS.INCORRECT_CURRENT_PASSWORD,
      );
    }

    const hashedPassword = await createHashPassword(data.newPassword);
    user.password = hashedPassword;
    await user.save();

    // Same reasoning as a reset: the old password is gone, so everything
    // derived from it goes too — sessions, reset links, and the OTPs that
    // mint reset links.
    await this.credentialRevocation.onPasswordChanged(userId, user.email);

    return SerializeHttpResponse(
      null,
      HttpStatus.OK,
      AUTH_SUCCESS.PASSWORD_CHANGED,
    );
  }

  async handleAppleAuth(data: AppleDto) {
    return await this.socialAuthService.verifyAppleToken(data.idToken);
  }
}
