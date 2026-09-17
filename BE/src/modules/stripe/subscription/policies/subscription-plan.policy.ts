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
import { SUBSCRIPTION_PLAN_SUBJECT } from '../constants/subscription-plan-subject.constant';

/**
 * Who may change the subscription plan catalogue.
 *
 * Creating a plan creates a real Product and Price in the Stripe account and
 * publishes it to every caller of `GET /stripe/subscriptions/plans`, so it is
 * an operator action rather than a customer one.
 *
 * Reading the catalogue is deliberately absent. That route is open to any
 * authenticated caller and declares no permissions, so granting `Read` here
 * would describe a rule nothing enforces — see the README's note on rules that
 * look load-bearing and are not.
 */
@Injectable()
export class SubscriptionPlanPolicy
  implements AuthorizationPolicy, OnModuleInit
{
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

    // Anonymous callers get nothing. Reaching here without a principal means a
    // guarded route, and the safe answer is no.
    if (!principal) {
      return;
    }

    // The mechanism keeps `role` an opaque string so it need not depend on this
    // module's vocabulary. Narrowing it is the policy's job, and an
    // unrecognised value falls through to no grants.
    const role = principal.role as USER_ROLES;

    switch (role) {
      case USER_ROLES.OWNER:
      case USER_ROLES.ADMIN:
        // `Create`, not `Manage`. The wildcard would pre-authorize every plan
        // action anyone adds later — editing prices, retiring plans — without
        // that grant ever being reviewed. Creation is the only plan route that
        // exists, so it is the only grant made.
        can(Action.Create, SUBSCRIPTION_PLAN_SUBJECT);
        break;

      // Billing is the Organization owner's concern. ADMIN is granted above
      // because it already administers the workspace; the operational roles
      // below have no reason to see or change a subscription plan.
      case USER_ROLES.MANAGER:
      case USER_ROLES.CASHIER:
      case USER_ROLES.ACCOUNTANT:
      case USER_ROLES.VIEWER:
        break;
    }
  }
}
