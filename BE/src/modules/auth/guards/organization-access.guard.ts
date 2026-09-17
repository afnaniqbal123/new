import { Model, Types } from 'mongoose';
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import { SerializeHttpError } from 'src/utils/serializer';
import { User } from 'src/modules/user/user.schema';
import { AUTH_ERRORS } from 'src/modules/auth/constants/api-response/auth.response';
import { ORGANIZATION_HEADER } from 'src/modules/auth/constants/auth.constant';
import { TENANT_SCOPED_KEY } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { AuthenticatedPrincipal } from 'src/modules/auth/types/authenticated-principal.type';

type TenantRequest = {
  user?: AuthenticatedPrincipal;
  headers: Record<string, string | string[] | undefined>;
  /** What the caller asked for. Untrusted. */
  requestedOrganizationId?: string;
  /** What the caller was found to be entitled to. Written only here. */
  organizationId?: string;
};

/**
 * Turns a caller-supplied organization id into authorized tenant context.
 *
 * The header used to be copied straight onto the request by the auth guard,
 * which meant any authenticated user could name any organization and be
 * treated as belonging to it. Membership is per-user mutable state that a
 * short-lived token cannot speak for, so unlike role authorization this check
 * does read the database — deliberately, and on its own, well after identity
 * has been settled.
 *
 * Applied at controller level, ahead of `PermissionsGuard`, and skipped on any
 * route not marked `@TenantScoped()`. Ordering is why: Nest runs
 * controller-level guards before route-level ones, so a tenant guard declared
 * per route would run *after* the permissions guard and the ability would be
 * built with no tenant context — every tenant-conditioned rule silently
 * evaluating against `undefined`.
 */
@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isTenantScoped = this.reflector.getAllAndOverride<boolean>(
      TENANT_SCOPED_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Not a tenant route: establish nothing, demand nothing.
    if (!isTenantScoped) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TenantRequest>();
    const principal = request.user;

    if (!principal) {
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.UNAUTHORIZED,
      );
    }

    const header = request.headers[ORGANIZATION_HEADER];
    const requested = Array.isArray(header) ? header[0] : header;

    if (!requested || !Types.ObjectId.isValid(requested)) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        AUTH_ERRORS.ORGANIZATION_REQUIRED,
      );
    }

    // Named so it cannot be mistaken for the authorized value. Anything
    // reading `requestedOrganizationId` is reading caller input.
    request.requestedOrganizationId = requested;

    const user = await this.userModel
      .findById(principal.id)
      .select('organization');

    if (!user?.organization || user.organization.toString() !== requested) {
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        AUTH_ERRORS.ORGANIZATION_ACCESS_DENIED,
      );
    }

    // The single writer of the trusted value. `@GetOrganizationId()` reads
    // this and only this, so a controller cannot receive tenant context that
    // did not pass through here.
    request.organizationId = requested;

    return true;
  }
}
