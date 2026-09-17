import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedPrincipal } from 'src/modules/auth/types/authenticated-principal.type';

/**
 * Reads the authenticated caller.
 *
 * `request.user` is written in exactly one place — `JwtStrategy.validate()` —
 * and is always an `AuthenticatedPrincipal`. Typing it as such is what makes
 * `@GetUser('sessionId')` a checked access rather than a hopeful one: the key
 * is constrained to fields the principal actually has, so a typo is a
 * compile error instead of `undefined` at runtime.
 */
export const GetUser = createParamDecorator(
  <K extends keyof AuthenticatedPrincipal>(
    data: K | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedPrincipal | AuthenticatedPrincipal[K] => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: AuthenticatedPrincipal }>();
    const user = request.user;

    return data ? user[data] : user;
  },
);
