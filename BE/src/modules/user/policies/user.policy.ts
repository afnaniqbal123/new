import { AbilityBuilder } from '@casl/ability';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PolicyRegistry } from 'src/modules/authorization/policy.registry';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import {
  AppAbility,
  AuthorizationContext,
} from 'src/modules/authorization/types/app-ability.type';
import { AuthorizationPolicy } from 'src/modules/authorization/types/authorization-policy.type';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { USER_SUBJECT } from 'src/modules/user/constants/user-subject.constant';

/**
 * Who may do what to a user record.
 *
 * The reference policy: every other domain policy should read like this one.
 *
 * Roles appear here and only here. They are an *input* to the rules, not the
 * API — controllers ask for `Action.Read` on `USER_SUBJECT` and never learn
 * which roles satisfy it. That is what makes "who may read users?" a
 * one-file answer instead of a grep across every controller.
 */
/**
 * What a user may change about themselves.
 *
 * Both exclusions are the same rule: a field with its own verified flow must
 * not have a second, unverified way in.
 *
 * - `role` — self-elevation.
 * - `email` — `AuthService` requires the current password.
 * - `password` — `AuthService.changePassword` verifies the current password,
 *   then revokes every session and retires outstanding reset links. Writing it
 *   through the profile route does none of that, so a stolen access token
 *   would become permanent account takeover. `POST /auth/change-password` is
 *   the only way a user changes their own password.
 *
 * `avatar` is present because `UserService.update` writes it from an uploaded
 * file rather than the DTO; the update path enumerates it explicitly when a
 * file is attached, so this entry is load-bearing.
 */
const SELF_EDITABLE_FIELDS: string[] = [
  'name',
  'phone',
  'languagePreference',
  'avatar',
];

/**
 * Fields nobody may change on **their own** record through the profile route,
 * whatever their role.
 *
 * Listing them in `SELF_EDITABLE_FIELDS` is not enough. `Manage` is granted
 * unconditioned to OWNER/ADMIN, and an unconditioned grant matches every
 * record including the caller's own — so an admin would still reach these on
 * themselves. They need an explicit `cannot`, applied after the role grants,
 * which is how the self-delete carve-out below already works.
 */
const PROTECTED_SELF_FIELDS: string[] = ['password', 'email', 'role'];

@Injectable()
export class UserPolicy implements AuthorizationPolicy, OnModuleInit {
  constructor(private readonly registry: PolicyRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  define(
    builder: AbilityBuilder<AppAbility>,
    context: AuthorizationContext,
  ): void {
    const { can, cannot } = builder;
    const principal = context.principal;

    // Anonymous callers get nothing. Public routes bypass authorization
    // entirely via @Public(), so reaching here without a principal means a
    // guarded route — and the safe answer is no.
    if (!principal) {
      return;
    }

    // Everyone may read and update their own record. Expressed as a condition
    // on the subject rather than a role, so it holds regardless of role and
    // needs no special case in a controller.
    //
    // Conditions are only evaluated against a loaded record. A name-only
    // check — `can(Read, 'User')` in the route guard — returns true for
    // anyone holding this grant, which is why routes reading one record also
    // assert against the record itself. See authorization.md.
    can(Action.Read, USER_SUBJECT, { _id: principal.id });

    // Self-update is restricted to fields a user may safely change about
    // themselves. `role` is absent deliberately: without the field list, "edit
    // your own profile" also means "make yourself an OWNER", because the
    // record-level check would pass — it *is* their record. `email` is absent
    // too; it has a password-verified flow of its own in `changeEmail`.
    can(Action.Update, USER_SUBJECT, SELF_EDITABLE_FIELDS, {
      _id: principal.id,
    });

    // The mechanism keeps `role` an opaque string so it need not depend on
    // this module's vocabulary. Narrowing it is this policy's job — it owns
    // the role model, and an unrecognised value falls through to no grants.
    const role = principal.role as USER_ROLES;

    switch (role) {
      case USER_ROLES.OWNER:
      case USER_ROLES.ADMIN:
        can(Action.Manage, USER_SUBJECT);
        break;

      case USER_ROLES.MANAGER:
      case USER_ROLES.CASHIER:
      case USER_ROLES.ACCOUNTANT:
        // The organization directory, and nothing else — `List`, not `Read`.
        // Preserves what the old `@Roles(...)` list allowed on
        // `GET /users/all` without also opening `GET /users/:id`.
        //
        //
        // Deliberately unconditioned. A `{ organization: … }` condition here
        // would read as the tenant boundary and enforce nothing: the route
        // guard asks a name-only question, which CASL answers without
        // evaluating conditions, and the listing is already confined by
        // `OrganizationAccessGuard` (membership) plus the service's own
        // filter. A rule that looks load-bearing and is not is worse than no
        // rule. Tenant conditions belong on record-level checks — see
        // `test/authorization/` for one that bites.
        can(Action.List, USER_SUBJECT);
        break;

      case USER_ROLES.VIEWER:
        // Nothing beyond the self-grant above — which matches today: no
        // role-guarded user route admits a VIEWER.
        break;
    }

    // Both carve-outs are after the grants above, because `cannot` is
    // evaluated last regardless of where it is declared — which is the only
    // way to take something back from an unconditioned `Manage`.

    // Deleting your own account through the admin route would strand an
    // organization with no owner; account closure needs its own flow with its
    // own confirmation, not a side effect of Manage.
    cannot(Action.Delete, USER_SUBJECT, { _id: principal.id });

    // The verified-flow rule applies to everyone, admins included. An admin
    // changing their own password here would skip the current-password check
    // and the session revocation that makes a stolen token recoverable; their
    // own role here is ADMIN -> OWNER self-elevation.
    cannot(Action.Update, USER_SUBJECT, PROTECTED_SELF_FIELDS, {
      _id: principal.id,
    });
  }
}
