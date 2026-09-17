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
import { BILLING_SUBJECT } from 'src/modules/billing/constants/billing.constant';

/**
 * Who may see and change the subscription.
 *
 * Buying a plan spends the business's money on a recurring basis, so it is
 * the owner's alone — an admin administers the workspace, they do not commit
 * it to a monthly charge. An accountant may read it, because the invoice
 * lands on their desk.
 */
@Injectable()
export class BillingPolicy implements AuthorizationPolicy, OnModuleInit {
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

    switch (role) {
      case USER_ROLES.OWNER:
        can(Action.Manage, BILLING_SUBJECT);
        break;

      case USER_ROLES.ADMIN:
      case USER_ROLES.ACCOUNTANT:
        // Read the plan and its limits — needed to explain to a colleague why
        // they cannot add an eleventh user. Not to change it.
        can(Action.Read, BILLING_SUBJECT);
        can(Action.List, BILLING_SUBJECT);
        break;

      case USER_ROLES.MANAGER:
      case USER_ROLES.CASHIER:
      case USER_ROLES.VIEWER:
        // The plan limits themselves surface through the features they gate,
        // not through the billing screen.
        break;
    }
  }
}
