import {
  UserEmailDto,
  VerifyResetPasswordDto,
} from './dto/forgot-password.dto';
import { OtpDto } from './dto/otp.dto';
import { OtpService } from './otp.service';
import { SignupDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { AppleDto } from './dto/apple.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { OTP_TYPE } from 'src/modules/auth/types/otp.type';
import { UserService } from '../user/user.service';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';
import { EMAIL_SUBJECT } from 'src/modules/auth/types/email.type';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from 'src/modules/auth/decorator/public.decorator';
import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly otpService: OtpService,
    private readonly userService: UserService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @ApiBearerAuth()
  @Get('get-authenticated-user')
  getAuthenticatedUser(@GetUser('id') userId: string) {
    return this.userService.findOne(userId);
  }

  @Public()
  @Post('signup')
  signup(@Body() signUpDto: SignupDto) {
    return this.authService.signup(signUpDto);
  }

  @Public()
  @Post('login')
  async login(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() data: UserEmailDto) {
    return this.otpService.generateOTP(
      data,
      OTP_TYPE.FORGOT_PASSWORD,
      EMAIL_SUBJECT.FORGOT_PASSWORD_OTP,
    );
  }

  @Public()
  @Post('forgot-password-link')
  async forgotPasswordLink(@Body() data: UserEmailDto) {
    return this.authService.forgotPasswordLink(data);
  }

  @Public()
  @Post('verify-forgot-password-otp')
  async verifyForgotPasswordOtp(@Body() userInput: OtpDto) {
    return this.otpService.validateOTP(userInput, OTP_TYPE.FORGOT_PASSWORD);
  }

  @Public()
  @Post('verify-reset-password')
  async verifyResetPassword(@Body() data: VerifyResetPasswordDto) {
    return this.authService.verifyResetPassword(data);
  }

  @Public()
  @Post('resend-signup-otp')
  async resendSignupOtp(@Body() data: UserEmailDto) {
    return this.otpService.resendSignupOtp(data);
  }

  @Public()
  @Post('verify-signup-otp')
  async verifySignupOtp(@Body() userInput: OtpDto) {
    return this.otpService.verifySignupOtp(userInput);
  }

  @ApiBearerAuth()
  @Post('change-password')
  async changePassword(
    @GetUser('id') userId: string,
    @Body() data: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, data);
  }

  @Public()
  @Post('apple/callback')
  async handleAppleAuth(@Body() appleDto: AppleDto, @Res() res: Response) {
    const response = await this.authService.handleAppleAuth(appleDto);
    return res.status(response.status).json(response);
  }

  // Public in the sense that it needs no *access* token — by design, since
  // the usual reason to call it is that the access token just expired. The
  // refresh token in the body is the credential.
  @Public()
  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.refreshTokenService.refreshAccessToken(
      refreshTokenDto.refreshToken,
    );
  }

  /**
   * Ends the session the caller is currently using. The session id travels in
   * the access token, so logging out no longer depends on the client sending
   * a refresh token back — and cannot be aimed at somebody else's session by
   * sending a different one.
   */
  @ApiBearerAuth()
  @Post('logout')
  async logout(
    @GetUser('id') userId: string,
    @GetUser('sessionId') sessionId: string | undefined,
  ) {
    return this.refreshTokenService.revokeSession(userId, sessionId);
  }

  @ApiBearerAuth()
  @Post('logout-all-devices')
  async logoutAllDevices(@GetUser('id') userId: string) {
    return this.refreshTokenService.revokeAllUserTokens(userId);
  }

  @ApiBearerAuth()
  @Get('active-sessions')
  async getActiveSessions(@GetUser('id') userId: string) {
    return this.refreshTokenService.getUserActiveTokens(userId);
  }
}
