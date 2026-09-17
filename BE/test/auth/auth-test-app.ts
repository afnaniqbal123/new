import * as jwt from 'jsonwebtoken';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import {
  CONFIG,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from 'src/constants/config.constant';
import { TOKEN_TYPES } from 'src/modules/auth/constants/auth.constant';
import { Public } from 'src/modules/auth/decorator/public.decorator';
import { Roles } from 'src/modules/auth/decorator/roles.decorator';
import { JwtAccessGuard } from 'src/modules/auth/guards/jwt-access.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { JwtStrategy } from 'src/modules/auth/strategies/jwt.strategy';
import { TokenService } from 'src/modules/auth/services/token.service';
import { AuthenticatedPrincipal } from 'src/modules/auth/types/authenticated-principal.type';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { UseGuards } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PasswordResetService } from 'src/modules/auth/services/password-reset.service';
import { User } from 'src/modules/user/user.schema';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';

/**
 * The organization a stubbed caller is actually a member of. Membership is
 * per-user mutable state, so the tenant guard — unlike authentication — does
 * read it; this stub stands in for that one read.
 */
export const MEMBER_ORGANIZATION = '507f1f77bcf86cd799439033';
export const FOREIGN_ORGANIZATION = '507f1f77bcf86cd799439044';

/** Counts every user-collection read the request path performs. */
export const userModelReads = { count: 0 };

const userModelStub = {
  findById: (_id: string) => {
    userModelReads.count += 1;
    return {
      select: () =>
        Promise.resolve({
          organization: { toString: () => MEMBER_ORGANIZATION },
        }),
    };
  },
};

export const TEST_SECRET = 'test-secret-that-is-long-enough-for-hs256';

/**
 * Routes that stand in for real ones, so the contract can be exercised over
 * HTTP without a database. The point of the bare `@Get('protected')` is that
 * it carries no guard decorator at all — if it is reachable anonymously, the
 * "authenticated by default" property has broken.
 */
@ApiTags('Contract')
@Controller()
class ContractController {
  @Get('protected')
  protectedRoute(@GetUser() user: AuthenticatedPrincipal) {
    return { user };
  }

  @Public()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('admin-only')
  @Roles(USER_ROLES.ADMIN)
  @UseGuards(RolesGuard)
  adminOnly() {
    return { ok: true };
  }

  // The guard is opt-in: it stands aside on any route without this marker, so
  // it can sit ahead of PermissionsGuard at controller level without forcing
  // an organization on every route. See tenant-scoped.decorator.ts.
  @ApiBearerAuth()
  @Get('tenant')
  @TenantScoped()
  @UseGuards(OrganizationAccessGuard)
  tenantScoped(@GetOrganizationId() organizationId: string) {
    return { organizationId };
  }

  // Deliberately unguarded, to prove the decorator cannot be used to smuggle
  // tenant context in without the guard having authorized it.
  @Get('tenant-unguarded')
  tenantUnguarded(@GetOrganizationId() organizationId: string) {
    return { organizationId };
  }
}

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [ContractController],
  providers: [
    TokenService,
    JwtStrategy,
    {
      provide: ConfigService,
      useValue: {
        get: (key: CONFIG) =>
          key === CONFIG.JWT_SECRET ? TEST_SECRET : undefined,
      },
    },
    OrganizationAccessGuard,
    { provide: getModelToken(User.name), useValue: userModelStub },
    { provide: APP_GUARD, useClass: JwtAccessGuard },
  ],
})
class AuthContractModule {}

/**
 * A reset credential produced by the real issuer, not a lookalike.
 *
 * The point of the test that consumes this is that a *genuine* password-reset
 * token — the exact string a user receives by email — cannot authenticate an
 * API request. A random hex string would prove only that gibberish is
 * rejected, which the malformed-credential tests already cover.
 */
export async function mintRealResetToken(): Promise<string> {
  const created: Record<string, unknown>[] = [];
  const service = new PasswordResetService({
    create: (doc: Record<string, unknown>) => {
      created.push(doc);
      return Promise.resolve(doc);
    },
    updateMany: () => Promise.resolve({}),
  } as never);

  return service.issue(new Types.ObjectId().toString());
}

export async function createAuthTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AuthContractModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

type ClaimOverrides = Record<string, unknown>;

/** A well-formed access token, with room to break one thing at a time. */
export function signToken(
  overrides: ClaimOverrides = {},
  options: jwt.SignOptions = {},
  secret: string = TEST_SECRET,
): string {
  const payload = {
    sub: '507f1f77bcf86cd799439011',
    email: 'user@example.com',
    role: USER_ROLES.ADMIN,
    type: TOKEN_TYPES.SIGNIN_TOKEN,
    ...overrides,
  };

  return jwt.sign(payload, secret, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: '15m',
    ...options,
  });
}
