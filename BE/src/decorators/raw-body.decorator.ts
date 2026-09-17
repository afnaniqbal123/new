import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * The exact bytes of the request body, for signature verification.
 *
 * Exists so that webhook handlers never reach for `@Req()` — which
 * `nestjs/no-raw-request-decorator` bans, and rightly: handing a controller
 * the whole Express request invites it to read anything at all, and hides
 * what a route actually depends on.
 *
 * Only meaningful because `main.ts` creates the app with `rawBody: true`.
 * Without that, this is `undefined` and every signature check fails closed —
 * which is the safe direction, but worth knowing when one mysteriously does.
 */
export const RawBody = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Buffer | undefined => {
    return ctx.switchToHttp().getRequest<{ rawBody?: Buffer }>().rawBody;
  },
);
