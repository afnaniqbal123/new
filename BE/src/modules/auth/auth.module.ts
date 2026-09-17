import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from '../user/user.service';
import { MediaModule } from '../media/media.module';
import { CONFIG } from 'src/constants/config.constant';
import { User, UserSchema } from '../user/user.schema';
import { JwtStrategy } from 'src/modules/auth/strategies/jwt.strategy';
import { OtpService } from 'src/modules/auth/otp.service';
import { AuthService } from 'src/modules/auth/auth.service';
import { SocialAuthService } from 'src/modules/auth/social-auth.service';
import { RefreshTokenService } from 'src/modules/auth/refresh-token.service';
import { TokenService } from 'src/modules/auth/services/token.service';
import { PasswordResetService } from 'src/modules/auth/services/password-reset.service';
import { CredentialRevocationService } from 'src/modules/auth/services/credential-revocation.service';
import { JwtAccessGuard } from 'src/modules/auth/guards/jwt-access.guard';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from 'src/modules/email/email.module';
import { Otp, OtpSchema } from 'src/modules/auth/otp.schema';
import {
  RefreshToken,
  RefreshTokenSchema,
} from 'src/modules/auth/refresh-token.schema';
import {
  PasswordResetToken,
  PasswordResetTokenSchema,
} from 'src/modules/auth/password-reset-token.schema';
import { AuthController } from 'src/modules/auth/auth.controller';

const MODEL = [
  { name: User.name, schema: UserSchema },
  { name: Otp.name, schema: OtpSchema },
  { name: RefreshToken.name, schema: RefreshTokenSchema },
  { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
];

@Module({
  imports: [
    // Imported, not re-provided. A second copy of MediaService inside this
    // module's injector has to satisfy every one of its dependencies locally —
    // which is how EmailService silently stopped booting once it gained one
    // this module does not have.
    MediaModule,
    MongooseModule.forFeature(MODEL),
    EmailModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get<string>(CONFIG.JWT_SECRET),
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SocialAuthService,
    RefreshTokenService,
    TokenService,
    PasswordResetService,
    CredentialRevocationService,
    OtpService,
    UserService,
    JwtStrategy,
    ConfigService,
    OrganizationAccessGuard,
    {
      // Authentication is on by default for every route in the application.
      // The alternative — remembering `@UseGuards(...)` on each new
      // controller — fails open exactly once and nobody notices until it is
      // in production. Routes that are meant to be anonymous say so with
      // `@Public()`, which is visible in review.
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
    },
  ],
  exports: [
    AuthService,
    JwtStrategy,
    TokenService,
    RefreshTokenService,
    PasswordResetService,
    CredentialRevocationService,
    OrganizationAccessGuard,
    // Re-exported so that `UserModel` resolves in any module that applies
    // `@UseGuards(OrganizationAccessGuard)`.
    //
    // Nest instantiates a guard passed to `@UseGuards()` as a *class* in the
    // host controller's own module, not in the module that exported it — so
    // the guard's `@InjectModel(User.name)` has to be satisfiable there. The
    // alternative is every tenant-scoped module registering the User schema
    // itself, which would be a foreign-schema registration in eight places
    // instead of one re-export here.
    MongooseModule,
  ],
})
export class AuthModule {}
