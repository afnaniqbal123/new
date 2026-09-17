import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityFactory } from 'src/modules/authorization/ability.factory';
import { AUTHORIZATION_ERRORS } from 'src/modules/authorization/constants/api-response/authorization.response';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import { RequiredPermission } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { AppAbility } from 'src/modules/authorization/types/app-ability.type';
import { PermissionsGuard } from './permissions.guard';

const SUBJECT = 'Widget';

type Request = {
  user?: { id: string; role: string };
  organizationId?: string;
  ability?: AppAbility;
};

function abilityGranting(...actions: Action[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  for (const action of actions) can(action, SUBJECT);
  return build();
}

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let factory: { createFor: jest.Mock };
  let guard: PermissionsGuard;
  let request: Request;

  const context = () =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  const require = (permissions: RequiredPermission[] | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permissions);

  const statusOf = (error: unknown) =>
    ((error as HttpException).getResponse() as { status: number }).status;
  const messageOf = (error: unknown) =>
    ((error as HttpException).getResponse() as { message: string }).message;

  beforeEach(() => {
    reflector = new Reflector();
    factory = { createFor: jest.fn().mockReturnValue(abilityGranting()) };
    guard = new PermissionsGuard(
      reflector,
      factory as unknown as AbilityFactory,
    );
    request = { user: { id: 'user-1', role: 'MEMBER' } };
  });

  it('allows a route that declares no permissions', () => {
    require(undefined);
    expect(guard.canActivate(context())).toBe(true);
  });

  it('allows a caller whose ability grants the permission', () => {
    require([{ action: Action.Read, subject: SUBJECT }]);
    factory.createFor.mockReturnValue(abilityGranting(Action.Read));

    expect(guard.canActivate(context())).toBe(true);
  });

  it('answers 403 when the ability does not grant it', () => {
    require([{ action: Action.Delete, subject: SUBJECT }]);
    factory.createFor.mockReturnValue(abilityGranting(Action.Read));

    try {
      guard.canActivate(context());
      fail('expected a refusal');
    } catch (error) {
      expect(statusOf(error)).toBe(HttpStatus.FORBIDDEN);
      expect(messageOf(error)).toBe(AUTHORIZATION_ERRORS.FORBIDDEN);
    }
  });

  it('requires every listed permission, not just one', () => {
    require([
      { action: Action.Read, subject: SUBJECT },
      { action: Action.Delete, subject: SUBJECT },
    ]);
    factory.createFor.mockReturnValue(abilityGranting(Action.Read));

    expect(() => guard.canActivate(context())).toThrow(HttpException);
  });

  // A route declaring permissions but reachable anonymously is a wiring
  // mistake; evaluating rules for a caller who does not exist would be worse.
  it('answers 401 when a permissioned route has no principal', () => {
    require([{ action: Action.Read, subject: SUBJECT }]);
    request.user = undefined;

    try {
      guard.canActivate(context());
      fail('expected a refusal');
    } catch (error) {
      expect(statusOf(error)).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('builds the ability from claims and authorized tenant context only', () => {
    require(undefined);
    request.organizationId = 'org-1';

    guard.canActivate(context());

    expect(factory.createFor).toHaveBeenCalledWith({
      principal: { id: 'user-1', role: 'MEMBER' },
      organizationId: 'org-1',
    });
  });

  /**
   * Regression for the ordering bug found in review on #26. PermissionsGuard
   * sat at controller level and OrganizationAccessGuard at route level; Nest
   * runs controller guards first, so the ability was always built with
   * `organizationId: undefined` and any tenant-conditioned rule silently
   * evaluated against nothing. Both now sit at controller level, in order.
   */
  it('builds the ability with tenant context once the tenant guard has run', () => {
    require(undefined);
    request.organizationId = 'org-authorized-by-the-tenant-guard';

    guard.canActivate(context());

    expect(factory.createFor).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-authorized-by-the-tenant-guard',
      }),
    );
  });

  // Attached even on routes with no declared permissions, so a handler can
  // still hand it to a service for a record-level check.
  it('attaches the ability to the request', () => {
    require(undefined);

    guard.canActivate(context());

    expect(request.ability).toBeDefined();
  });

  it('reads nothing from a database', () => {
    require([{ action: Action.Read, subject: SUBJECT }]);
    factory.createFor.mockReturnValue(abilityGranting(Action.Read));

    guard.canActivate(context());

    // Two collaborators, both synchronous and neither a model.
    expect(PermissionsGuard.length).toBe(2);
    expect(factory.createFor).toHaveBeenCalledTimes(1);
  });
});
