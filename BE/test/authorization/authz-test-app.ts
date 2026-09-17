import {
  Controller,
  Get,
  INestApplication,
  Module,
  UseGuards,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { AbilityBuilder, subject as tagSubject } from '@casl/ability';
import { CONFIG } from 'src/constants/config.constant';
import { Public } from 'src/modules/auth/decorator/public.decorator';
import { JwtAccessGuard } from 'src/modules/auth/guards/jwt-access.guard';
import { JwtStrategy } from 'src/modules/auth/strategies/jwt.strategy';
import { TokenService } from 'src/modules/auth/services/token.service';
import { AbilityFactory } from 'src/modules/authorization/ability.factory';
import { AuthorizationService } from 'src/modules/authorization/authorization.service';
import { PolicyRegistry } from 'src/modules/authorization/policy.registry';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { GetAbility } from 'src/modules/authorization/decorator/get-ability.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { AppAbility } from 'src/modules/authorization/types/app-ability.type';
import type { AuthorizationContext } from 'src/modules/authorization/types/app-ability.type';
import type { AuthorizationPolicy } from 'src/modules/authorization/types/authorization-policy.type';

export const TEST_SECRET = 'test-secret-that-is-long-enough-for-hs256';
export const WIDGET = 'Widget';

/**
 * A stand-in domain policy, shaped like a real one: an elevated role manages
 * everything, everyone else may only touch their own record.
 */
@Injectable()
class WidgetPolicy implements AuthorizationPolicy, OnModuleInit {
  constructor(private readonly registry: PolicyRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  define(
    builder: AbilityBuilder<AppAbility>,
    context: AuthorizationContext,
  ): void {
    const { can, cannot } = builder;
    const principal = context.principal;
    if (!principal) return;

    can([Action.Read, Action.Update], WIDGET, { ownerId: principal.id });

    // Narrowed here, as a real policy does — the mechanism keeps `role` an
    // opaque string so it need not know this vocabulary.
    const role = principal.role as USER_ROLES;

    if (role === USER_ROLES.ADMIN) {
      can(Action.Manage, WIDGET);
      // Same carve-out shape as UserPolicy: broad grant, one exception.
      cannot(Action.Delete, WIDGET, { ownerId: principal.id });
    }
    if (role === USER_ROLES.CASHIER) {
      // Tenant-conditioned, and it actually decides: checked against a loaded
      // record, so the condition is evaluated rather than skipped the way a
      // name-only guard check skips it.
      can(Action.List, WIDGET, { organization: context.organizationId });
    }
  }
}

/** Stands in for OrganizationAccessGuard: establishes authorized tenant context. */
@Injectable()
class StubTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ organizationId?: string; user?: unknown }>();
    if (request.user) request.organizationId = 'org-a';
    return true;
  }
}

@ApiTags('Authz contract')
@Controller()
// Same ordering the real controllers use: tenant context before the ability
// is built. Reversing these two reproduces the bug found in review on #26.
@UseGuards(StubTenantGuard, PermissionsGuard)
class AuthzController {
  constructor(private readonly authorization: AuthorizationService) {}

  @ApiBearerAuth()
  @Get('widgets')
  @RequirePermissions({ action: Action.List, subject: WIDGET })
  list() {
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('widgets/mine')
  @RequirePermissions({ action: Action.Read, subject: WIDGET })
  mine(@GetAbility() ability: AppAbility | undefined) {
    // The record-level half: the guard let anyone with a Read grant through,
    // this decides whether they may have *this* record.
    this.authorization.assertCan(ability, Action.Read, WIDGET, {
      ownerId: '507f1f77bcf86cd799439011',
    });
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('widgets/theirs')
  @RequirePermissions({ action: Action.Read, subject: WIDGET })
  theirs(@GetAbility() ability: AppAbility | undefined) {
    this.authorization.assertCan(ability, Action.Read, WIDGET, {
      ownerId: 'somebody-else',
    });
    return { ok: true };
  }

  /**
   * Reproduces the shape of `PATCH /users/:id`: the policy grants conditional
   * self-update, so every authenticated caller clears the name-only guard.
   * Only the record-level assertion separates them.
   */
  @ApiBearerAuth()
  @Get('widgets/update-theirs')
  @RequirePermissions({ action: Action.Update, subject: WIDGET })
  updateTheirs(@GetAbility() ability: AppAbility | undefined) {
    this.authorization.assertCan(ability, Action.Update, WIDGET, {
      ownerId: 'somebody-else',
    });
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('widgets/update-mine')
  @RequirePermissions({ action: Action.Update, subject: WIDGET })
  updateMine(@GetAbility() ability: AppAbility | undefined) {
    this.authorization.assertCan(ability, Action.Update, WIDGET, {
      ownerId: '507f1f77bcf86cd799439011',
    });
    return { ok: true };
  }

  /** Reproduces the `cannot(Delete, { _id: self })` carve-out. */
  @ApiBearerAuth()
  @Get('widgets/delete-own')
  @RequirePermissions({ action: Action.Delete, subject: WIDGET })
  deleteOwn(@GetAbility() ability: AppAbility | undefined) {
    this.authorization.assertCan(ability, Action.Delete, WIDGET, {
      ownerId: '507f1f77bcf86cd799439011',
    });
    return { ok: true };
  }

  /** Tenant boundary, decided against the record rather than the route. */
  @ApiBearerAuth()
  @Get('widgets/in-my-org')
  inMyOrg(@GetAbility() ability: AppAbility | undefined) {
    this.authorization.assertCan(ability, Action.List, WIDGET, {
      organization: 'org-a',
    });
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('widgets/in-other-org')
  inOtherOrg(@GetAbility() ability: AppAbility | undefined) {
    this.authorization.assertCan(ability, Action.List, WIDGET, {
      organization: 'org-b',
    });
    return { ok: true };
  }

  @Public()
  @Get('open')
  open() {
    return { ok: true };
  }
}

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthzController],
  providers: [
    TokenService,
    JwtStrategy,
    PolicyRegistry,
    AbilityFactory,
    AuthorizationService,
    PermissionsGuard,
    WidgetPolicy,
    StubTenantGuard,
    {
      provide: ConfigService,
      useValue: {
        get: (key: CONFIG) =>
          key === CONFIG.JWT_SECRET ? TEST_SECRET : undefined,
      },
    },
    { provide: APP_GUARD, useClass: JwtAccessGuard },
  ],
})
class AuthzContractModule {}

export async function createAuthzTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AuthzContractModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export { tagSubject };
