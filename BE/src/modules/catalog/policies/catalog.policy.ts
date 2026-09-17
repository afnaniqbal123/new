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
  CATEGORY_SUBJECT,
  PRODUCT_COST_SUBJECT,
  PRODUCT_SUBJECT,
} from 'src/modules/catalog/constants/catalog.constant';

/**
 * Who may read and change the catalogue.
 *
 * The interesting rule here is `PRODUCT_COST_SUBJECT`, which is a separate
 * subject from the product itself. A CASHIER must be able to read products —
 * they cannot sell otherwise — but must not see what those products cost.
 * Margin is not a cashier's business, and in a family firm it is actively
 * sensitive information.
 *
 * Splitting it into its own subject is what makes "read the record, but
 * strictly fewer of its fields" expressible. The controller strips the cost
 * fields when the ability says no; there is no route that returns them
 * unconditionally.
 */
@Injectable()
export class CatalogPolicy implements AuthorizationPolicy, OnModuleInit {
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

    // Everyone signed in may browse the catalogue. A role that cannot see
    // products cannot use any screen in the application.
    can(Action.List, PRODUCT_SUBJECT);
    can(Action.Read, PRODUCT_SUBJECT);
    can(Action.List, CATEGORY_SUBJECT);
    can(Action.Read, CATEGORY_SUBJECT);

    switch (role) {
      case USER_ROLES.OWNER:
      case USER_ROLES.ADMIN:
        can(Action.Manage, PRODUCT_SUBJECT);
        can(Action.Manage, CATEGORY_SUBJECT);
        can(Action.Read, PRODUCT_COST_SUBJECT);
        break;

      case USER_ROLES.MANAGER:
        // A manager runs the catalogue day to day — adding products, setting
        // prices, reorganising categories — and needs cost to do any of it.
        can(Action.Manage, PRODUCT_SUBJECT);
        can(Action.Manage, CATEGORY_SUBJECT);
        can(Action.Read, PRODUCT_COST_SUBJECT);
        break;

      case USER_ROLES.ACCOUNTANT:
        // Cost, yes — stock valuation is an accounting figure. Editing the
        // catalogue, no: an accountant changing a selling price would change
        // the business's pricing without anyone in sales knowing.
        can(Action.Read, PRODUCT_COST_SUBJECT);
        break;

      case USER_ROLES.CASHIER:
      case USER_ROLES.VIEWER:
        // Read-only, and deliberately without PRODUCT_COST_SUBJECT.
        break;
    }
  }
}
