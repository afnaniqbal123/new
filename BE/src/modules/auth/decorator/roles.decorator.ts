import { SetMetadata } from '@nestjs/common';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';

export const ROLES_KEY = 'roles';

/**
 * Requires the caller to hold one of these roles.
 *
 * @deprecated Legacy. Business authorization is expressed as permissions, not
 * roles — see `@RequirePermissions()` and ADR 0003.
 *
 * Two problems with asking for roles at the route. The policy ends up copied
 * across every controller that repeats the list, so "who may update a user?"
 * has no single answer; and a role cannot express a rule about the record
 * itself, so "their own profile" needs a special case in the handler.
 *
 * Migrating a route:
 *
 * 1. Name what the caller is doing — `Action.Update` on `USER_SUBJECT` — and
 *    put the role logic in that module's policy.
 * 2. Swap `@Roles(...)` for `@RequirePermissions(...)` and `RolesGuard` for
 *    `PermissionsGuard`.
 * 3. If the rule depends on the record, add
 *    `AuthorizationService.assertCan()` after the service loads it. The route
 *    guard runs before anything is loaded and cannot answer that.
 *
 * `src/modules/user/` is migrated and is the worked example.
 */
export const Roles = (...roles: USER_ROLES[]) => SetMetadata(ROLES_KEY, roles);
