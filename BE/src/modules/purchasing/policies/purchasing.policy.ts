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
  GOODS_RECEIPT_SUBJECT,
  PURCHASE_ORDER_SUBJECT,
  SUPPLIER_SUBJECT,
} from 'src/modules/purchasing/constants/purchasing.constant';

/**
 * Who may buy, receive, and pay suppliers.
 *
 * A CASHIER gets nothing here at all — not even read. Purchase costs are
 * margin information by another name, and the segregation that matters is
 * that the person at the till never sees what the shop pays for its stock.
 */
@Injectable()
export class PurchasingPolicy implements AuthorizationPolicy, OnModuleInit {
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
      case USER_ROLES.ADMIN:
      case USER_ROLES.MANAGER:
        // Buying is the manager's core job in a distribution business.
        can(Action.Manage, SUPPLIER_SUBJECT);
        can(Action.Manage, PURCHASE_ORDER_SUBJECT);
        can(Action.Manage, GOODS_RECEIPT_SUBJECT);
        break;

      case USER_ROLES.ACCOUNTANT:
        // Payables are accounting work: read everything, record payments,
        // maintain supplier records. Not raising orders or receiving stock —
        // an accountant who can do both can create a payable for goods that
        // never arrived and then pay it.
        can(Action.Read, SUPPLIER_SUBJECT);
        can(Action.List, SUPPLIER_SUBJECT);
        can(Action.Create, SUPPLIER_SUBJECT);
        can(Action.Update, SUPPLIER_SUBJECT);
        can(Action.Read, PURCHASE_ORDER_SUBJECT);
        can(Action.List, PURCHASE_ORDER_SUBJECT);
        can(Action.Read, GOODS_RECEIPT_SUBJECT);
        can(Action.List, GOODS_RECEIPT_SUBJECT);
        break;

      case USER_ROLES.VIEWER:
        can(Action.Read, SUPPLIER_SUBJECT);
        can(Action.List, SUPPLIER_SUBJECT);
        can(Action.Read, PURCHASE_ORDER_SUBJECT);
        can(Action.List, PURCHASE_ORDER_SUBJECT);
        break;

      case USER_ROLES.CASHIER:
        // Nothing. See the class comment.
        break;
    }
  }
}
