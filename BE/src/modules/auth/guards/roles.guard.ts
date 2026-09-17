import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SerializeHttpError } from 'src/utils/serializer';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { AUTH_ERRORS } from 'src/modules/auth/constants/api-response/auth.response';
import { ROLES_KEY } from 'src/modules/auth/decorator/roles.decorator';
import { AuthenticatedPrincipal } from 'src/modules/auth/types/authenticated-principal.type';

/**
 * Role authorization.
 *
 * @deprecated Legacy, retained only for routes not yet migrated. New work
 * uses `PermissionsGuard` with `@RequirePermissions()` — see ADR 0003 and
 * `docs/architecture/security/authorization.md`. Nothing in `src/` still
 * applies this guard; it stays so an adopter's own routes keep working
 * while they migrate.
 *
 * Runs after authentication and consumes its result. It does not re-verify
 * the caller and does not read the user document — the role travels in the
 * access token, which is short-lived precisely so that claims can be trusted
 * for their lifetime without a lookup (ADR 0001).
 *
 * The practical consequence, stated plainly: a role change takes effect when
 * the caller's current access token expires, not on their next request.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<USER_ROLES[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedPrincipal;
    }>();
    const principal = request.user;

    // No principal means the route is reachable anonymously but declares role
    // requirements — a wiring mistake. Fail closed rather than guess.
    if (!principal) {
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.UNAUTHORIZED,
      );
    }

    if (!requiredRoles.includes(principal.role)) {
      // 403, not 401. The caller is authenticated; they are just not allowed.
      // Answering 401 would tell a client to go and re-authenticate, which
      // cannot possibly change the outcome.
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        AUTH_ERRORS.FORBIDDEN_ROLE,
      );
    }

    return true;
  }
}
