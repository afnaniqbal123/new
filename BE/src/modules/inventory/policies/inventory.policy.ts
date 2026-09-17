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
  STOCK_SUBJECT,
  STOCK_TRANSFER_SUBJECT,
} from 'src/modules/inventory/constants/inventory.constant';

/**
 * Who may see and move stock.
 *
 * The line that matters: a CASHIER may *read* stock — they must know whether
 * an item is available before promising it to a customer — but may not write
 * an adjustment. An adjustment with no document behind it is indistinguishable
 * from covering up a shortage, so it belongs to roles that answer for the
 * count.
 */
@Injectable()
export class InventoryPolicy implements AuthorizationPolicy, OnModuleInit {
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

    // Reading stock is universal: no role in this system can do its job
    // without knowing what is on the shelf.
    can(Action.Read, STOCK_SUBJECT);
    can(Action.List, STOCK_SUBJECT);

    switch (role) {
      case USER_ROLES.OWNER:
      case USER_ROLES.ADMIN:
      case USER_ROLES.MANAGER:
        can(Action.Manage, STOCK_SUBJECT);
        can(Action.Manage, STOCK_TRANSFER_SUBJECT);
        break;

      case USER_ROLES.ACCOUNTANT:
        // Stock valuation is an accounting figure, and the ledger is the
        // evidence for it — so: full read, including transfers. No writes;
        // an accountant adjusting a physical count has no way to have
        // observed it.
        can(Action.List, STOCK_TRANSFER_SUBJECT);
        can(Action.Read, STOCK_TRANSFER_SUBJECT);
        break;

      case USER_ROLES.CASHIER:
      case USER_ROLES.VIEWER:
        // Read-only, granted above.
        break;
    }
  }
}
