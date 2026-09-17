import { AbilityBuilder } from '@casl/ability';
import {
  AppAbility,
  AuthorizationContext,
} from 'src/modules/authorization/types/app-ability.type';

/**
 * A domain module's contribution to what a caller may do.
 *
 * Policies live in the module that owns the data, not here. `user` decides
 * what may be done to a user; this module only decides how policies are
 * composed and asked. Putting the rules here instead would recreate the
 * problem CASL is being adopted to solve — one file that has to change for
 * every feature.
 *
 * Implementations must be pure: read the context, add rules, return. No
 * database, no HTTP, no I/O. `PermissionsGuard` runs every policy on every
 * guarded request, so a policy that awaits something makes authorization as
 * slow as the slowest rule.
 */
export interface AuthorizationPolicy {
  define(
    builder: AbilityBuilder<AppAbility>,
    context: AuthorizationContext,
  ): void;
}
