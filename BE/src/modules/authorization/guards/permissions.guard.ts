import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SerializeHttpError } from 'src/utils/serializer';
import { AbilityFactory } from 'src/modules/authorization/ability.factory';
import { AUTHORIZATION_ERRORS } from 'src/modules/authorization/constants/api-response/authorization.response';
import { REQUIRED_PERMISSIONS_KEY } from 'src/modules/authorization/constants/authorization.constant';
import { RequiredPermission } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { AppAbility } from 'src/modules/authorization/types/app-ability.type';

/**
 * The request carried into authorization.
 *
 * Read structurally rather than by importing `AuthenticatedPrincipal`: this
 * module must not depend on `auth`, or `user -> authorization -> auth -> user`
 * becomes a module cycle and `pnpm run architecture:check` refuses it. The
 * shape is the contract; the type lives where it is produced.
 */
type AuthorizedRequest = {
  user?: { id: string; role: string };
  /** Written only by `OrganizationAccessGuard`, never from a raw header. */
  organizationId?: string;
  ability?: AppAbility;
};

/**
 * Enforces `@RequirePermissions()`.
 *
 * Runs after authentication and consumes its result. It builds the caller's
 * ability from claims and already-established tenant context, and reads
 * nothing from the database — the same argument as `RolesGuard` before it
 * (ADR 0001 §5): the access token is short-lived so its claims can be trusted
 * for their lifetime without a lookup.
 *
 * It is deliberately not a data-access layer. A permission that depends on the
 * specific record cannot be answered here, because the record is not loaded
 * yet; that check belongs in the service, via `AuthorizationService`.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<AuthorizedRequest>();

    // The ability is attached even when the route declares no permissions, so
    // a handler can still hand it to a service for a resource-level check.
    const ability = this.abilityFactory.createFor({
      principal: request.user,
      organizationId: request.organizationId,
    });
    request.ability = ability;

    if (!required || required.length === 0) {
      return true;
    }

    // A route declaring permissions but reachable anonymously is a wiring
    // mistake. Fail closed rather than evaluate rules for a caller who does
    // not exist.
    if (!request.user) {
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTHORIZATION_ERRORS.UNAUTHENTICATED,
      );
    }

    const allowed = required.every(({ action, subject }) =>
      ability.can(action, subject),
    );

    if (!allowed) {
      // 403, not 401: the caller is authenticated and simply not permitted.
      // Re-authenticating cannot change the outcome.
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        AUTHORIZATION_ERRORS.FORBIDDEN,
      );
    }

    return true;
  }
}
