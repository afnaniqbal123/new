import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { OrganizationController } from 'src/modules/organization/organization.controller';
import {
  Organization,
  OrganizationSchema,
} from 'src/modules/organization/organization.schema';
import {
  Location,
  LocationSchema,
} from 'src/modules/organization/location.schema';
import { OrganizationPolicy } from 'src/modules/organization/policies/organization.policy';
import { UserModule } from 'src/modules/user/user.module';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * The tenant root. Almost every other domain module imports this one for
 * currency, tax configuration, location resolution and invoice numbering.
 *
 * `UserModule` is imported rather than re-providing `UserService`: a second
 * copy inside this injector would have to satisfy every one of that service's
 * dependencies locally, and stops the app booting the day it gains one.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: Location.name, schema: LocationSchema },
    ]),
    UserModule,
    // Provides OrganizationAccessGuard for the tenant-scoped routes.
    AuthModule,
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationPolicy],
  exports: [OrganizationService, MongooseModule],
})
export class OrganizationModule {}
