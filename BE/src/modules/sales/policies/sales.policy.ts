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
  DISCOUNT_OVERRIDE_SUBJECT,
  SALE_RETURN_SUBJECT,
  SALE_SUBJECT,
  SALE_VOID_SUBJECT,
} from 'src/modules/sales/constants/sales.constant';

/**
 * Who may sell, refund, void, and discount below the floor.
 *
 * The shape of this policy is the segregation of duties a distributor
 * actually needs: the person who rings up a sale is not the person who may
 * make one disappear. A CASHIER creates sales all day and holds neither
 * `SALE_VOID_SUBJECT` nor `DISCOUNT_OVERRIDE_SUBJECT`, because both are the
 * mechanisms by which counter fraud happens — voiding a completed sale to
 * pocket the cash, or discounting to nothing for a friend.
 */
@Injectable()
export class SalesPolicy implements AuthorizationPolicy, OnModuleInit {
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

    // Reading sales is universal — every role's screens show them.
    can(Action.List, SALE_SUBJECT);
    can(Action.Read, SALE_SUBJECT);
    can(Action.List, SALE_RETURN_SUBJECT);
    can(Action.Read, SALE_RETURN_SUBJECT);

    switch (role) {
      case USER_ROLES.OWNER:
      case USER_ROLES.ADMIN:
        can(Action.Manage, SALE_SUBJECT);
        can(Action.Manage, SALE_RETURN_SUBJECT);
        can(Action.Create, SALE_VOID_SUBJECT);
        can(Action.Create, DISCOUNT_OVERRIDE_SUBJECT);
        break;

      case USER_ROLES.MANAGER:
        can(Action.Manage, SALE_SUBJECT);
        can(Action.Manage, SALE_RETURN_SUBJECT);
        // A manager is the person a cashier calls over precisely for these
        // two, so withholding them would make the role pointless.
        can(Action.Create, SALE_VOID_SUBJECT);
        can(Action.Create, DISCOUNT_OVERRIDE_SUBJECT);
        break;

      case USER_ROLES.CASHIER:
        // The core of the job: ring up sales, take payments, accept returns.
        can(Action.Create, SALE_SUBJECT);
        can(Action.Update, SALE_SUBJECT);
        can(Action.Create, SALE_RETURN_SUBJECT);
        // Deliberately NOT SALE_VOID_SUBJECT or DISCOUNT_OVERRIDE_SUBJECT.
        break;

      case USER_ROLES.ACCOUNTANT:
        // Recording a payment against an existing invoice is bookkeeping.
        // Creating a sale is not — an accountant who can invent sales can
        // reconcile a till to any number they like.
        can(Action.Update, SALE_SUBJECT);
        break;

      case USER_ROLES.VIEWER:
        break;
    }
  }
}
