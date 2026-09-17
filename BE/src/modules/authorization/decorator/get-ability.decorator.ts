import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppAbility } from 'src/modules/authorization/types/app-ability.type';

/**
 * Hands a controller the caller's ability so it can pass it to a service for
 * a resource-level check.
 *
 * Services take an `AppAbility`, never a request — that is what keeps them
 * usable from a queue worker, a socket handler, or a test without inventing a
 * fake HTTP context.
 *
 * Populated by `PermissionsGuard`. A route without that guard receives
 * `undefined`, and `AuthorizationService.assertCan` refuses on `undefined`
 * rather than assuming permission.
 *
 * Declare the parameter as `AppAbility | undefined`. Typing it as `AppAbility`
 * hides the case the fail-closed path exists for, and makes a route that
 * forgot the guard look safe at the call site.
 */
export const GetAbility = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AppAbility | undefined =>
    ctx.switchToHttp().getRequest<{ ability?: AppAbility }>().ability,
);
