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
import {
  LOCATION_SUBJECT,
  ORGANIZATION_SUBJECT,
} from 'src/modules/organization/constants/organization.constant';

/**
 * Who may read and change the tenant itself.
 *
 * The distinction that matters here: every role may *read* the Organization —
 * currency, tax rates and invoice prefix are needed to render a sale, so
 * withholding them would break the POS for a cashier. Almost nobody may
 * *change* it, because those same settings silently alter the arithmetic on
 * every future document.
 */
@Injectable()
export class OrganizationPolicy implements AuthorizationPolicy, OnModuleInit {
  constructor(private readonly registry: PolicyRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  define(
    builder: AbilityBuilder<AppAbility>,
    context: AuthorizationContext,
  ): void {
    const { can } = builder;
    const principal = context.principal;

    if (!principal) {
      return;
    }

    const role = principal.role as USER_ROLES;

    // Everyone signed in may read their own tenant's configuration. Without
    // this a CASHIER could not price a line, because the tax rate lives here.
    can(Action.Read, ORGANIZATION_SUBJECT);
    can(Action.List, LOCATION_SUBJECT);
    can(Action.Read, LOCATION_SUBJECT);

    switch (role) {
      case USER_ROLES.OWNER:
        can(Action.Manage, ORGANIZATION_SUBJECT);
        can(Action.Manage, LOCATION_SUBJECT);
        break;

      case USER_ROLES.ADMIN:
        // Update, not Manage. Deleting or transferring the Organization is the
        // owner's alone — an admin is an operator, not a proprietor.
        can(Action.Update, ORGANIZATION_SUBJECT);
        can(Action.Manage, LOCATION_SUBJECT);
        break;

      case USER_ROLES.MANAGER:
        // Locations are operational: a manager opening a second warehouse
        // should not need the owner. The Organization's tax and billing
        // settings are not.
        can(Action.Create, LOCATION_SUBJECT);
        can(Action.Update, LOCATION_SUBJECT);
        break;

      case USER_ROLES.ACCOUNTANT:
      case USER_ROLES.CASHIER:
      case USER_ROLES.VIEWER:
        // Read-only, granted unconditionally above.
        break;
    }
  }
}
