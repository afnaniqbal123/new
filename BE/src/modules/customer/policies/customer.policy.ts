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
  CREDIT_OVERRIDE_SUBJECT,
  CUSTOMER_SUBJECT,
} from 'src/modules/customer/constants/customer.constant';

/**
 * Who may see and change customers, and who may sell past a credit limit.
 *
 * `CREDIT_OVERRIDE_SUBJECT` is the interesting grant. Selling to a customer
 * who is already over their limit is a real commercial decision with a real
 * cost, so it is a permission somebody holds rather than a confirmation
 * dialog anyone at the counter can click through. A CASHIER rings up sales
 * all day and never gets it. Invariant #2.
 */
@Injectable()
export class CustomerPolicy implements AuthorizationPolicy, OnModuleInit {
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

    // Every role reads customers: a cashier needs the customer's balance and
    // discount to complete a sale correctly.
    can(Action.List, CUSTOMER_SUBJECT);
    can(Action.Read, CUSTOMER_SUBJECT);

    switch (role) {
      case USER_ROLES.OWNER:
      case USER_ROLES.ADMIN:
        can(Action.Manage, CUSTOMER_SUBJECT);
        can(Action.Create, CREDIT_OVERRIDE_SUBJECT);
        break;

      case USER_ROLES.MANAGER:
        can(Action.Manage, CUSTOMER_SUBJECT);
        // A manager carries commercial responsibility for the customer
        // relationship, so extending credit past the limit is theirs to make.
        can(Action.Create, CREDIT_OVERRIDE_SUBJECT);
        break;

      case USER_ROLES.ACCOUNTANT:
        // Receivables are the accountant's work: they record payments,
        // correct balances and write off bad debt. They do not set credit
        // limits — that is a commercial decision, not a bookkeeping one.
        can(Action.Update, CUSTOMER_SUBJECT);
        can(Action.Create, CUSTOMER_SUBJECT);
        break;

      case USER_ROLES.CASHIER:
        // Creating a customer at the counter is routine — a walk-in who wants
        // an invoice should not require a manager. Editing one is not.
        can(Action.Create, CUSTOMER_SUBJECT);
        break;

      case USER_ROLES.VIEWER:
        break;
    }
  }
}
