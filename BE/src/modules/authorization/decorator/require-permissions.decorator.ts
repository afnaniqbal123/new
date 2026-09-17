import { SetMetadata } from '@nestjs/common';
import {
  Action,
  REQUIRED_PERMISSIONS_KEY,
} from 'src/modules/authorization/constants/authorization.constant';

/** One thing a caller must be allowed to do before a handler runs. */
export type RequiredPermission = {
  action: Action;
  subject: string;
};

/**
 * Declares what a route needs, semantically.
 *
 * ```ts
 * @RequirePermissions({ action: Action.Read, subject: USER_SUBJECT })
 * ```
 *
 * Controllers say *what the caller is trying to do*, never *which role they
 * must hold*. `@Roles(OWNER, ADMIN)` scatters the policy across every
 * controller that repeats the list, and changing who may read a user then
 * means finding all of them. With a permission, the rule lives in one policy
 * and the routes stop caring.
 *
 * Checks are ANDed — all listed permissions must hold.
 *
 * This handles permissions decidable from the caller alone. Anything
 * depending on the *specific record* cannot be answered before it is loaded;
 * use `AuthorizationService.assertCan()` in the service instead.
 */
export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
