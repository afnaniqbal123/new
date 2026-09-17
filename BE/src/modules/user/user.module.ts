import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User, UserSchema } from './user.schema';
import { MediaModule } from '../media/media.module';
import { EmailModule } from '../email/email.module';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UserPolicy } from './policies/user.policy';

@Module({
  imports: [
    // Imported, not re-provided. A second copy of MediaService inside this
    // module's injector has to satisfy every one of its dependencies locally —
    // which is how EmailService silently stopped booting once it gained one
    // this module does not have.
    MediaModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Provides OrganizationAccessGuard, used on the tenant-scoped route.
    // Not a forwardRef: AuthModule declares UserService as its own provider
    // rather than importing UserModule, so there is no module-level cycle to
    // work around here. See docs/architecture/module-architecture.md.
    AuthModule,
    // Imported, not re-provided. Declaring EmailService here built a second
    // copy inside this module's injector, which then had to satisfy every one
    // of its dependencies locally — and silently stopped booting the moment
    // EmailService gained one this module does not have.
    EmailModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    ConfigService,
    // Rules for user records live here, with the data they govern. The policy
    // registers itself with PolicyRegistry on init, so the authorization
    // module never learns this module exists.
    UserPolicy,
  ],
  exports: [UserService],
})
export class UserModule {}
