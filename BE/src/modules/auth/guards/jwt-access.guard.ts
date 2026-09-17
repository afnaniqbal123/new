import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { SerializeHttpError } from 'src/utils/serializer';
import { AUTH_ERRORS } from 'src/modules/auth/constants/api-response/auth.response';
import { JWT_ACCESS_STRATEGY } from 'src/modules/auth/constants/auth.constant';
import { IS_PUBLIC_KEY } from 'src/modules/auth/decorator/public.decorator';
import { AuthenticatedPrincipal } from 'src/modules/auth/types/authenticated-principal.type';

/**
 * The global access guard. Registered via `APP_GUARD` in `AuthModule`, so
 * every route in the application is authenticated unless it is marked
 * `@Public()`.
 *
 * It is intentionally thin. It decides *whether* a route needs authentication
 * and normalizes the failure response; it does not parse headers, verify
 * tokens, or load users. All of that belongs to `JwtStrategy`, and keeping it
 * there is what stops a second, subtly different verification path from
 * growing here.
 */
@Injectable()
export class JwtAccessGuard extends AuthGuard(JWT_ACCESS_STRATEGY) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Passport reports every failure the same way — missing header, bad
   * signature, expired token, wrong issuer, rejected claim shape. That
   * uniformity is deliberate: distinguishing them for the client would tell
   * an attacker which part of a forged token to fix next.
   */
  handleRequest<TUser = AuthenticatedPrincipal>(
    err: unknown,
    user: TUser | false,
  ): TUser {
    if (err || !user) {
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.UNAUTHORIZED,
      );
    }

    return user;
  }
}
