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
import { CLERK_SUBJECT } from 'src/modules/ai/constants/ai.constant';

/**
 * Who may talk to the clerk.
 *
 * The clerk answers by running reports, and every report it runs is already
 * filtered by the caller's own permissions — a cashier asking about profit
 * gets "I can't answer that", not a leak. So the grant here is broad on
 * purpose: the restriction lives where the data does, not in front of the
 * chat box.
 */
@Injectable()
export class AiPolicy implements AuthorizationPolicy, OnModuleInit {
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
      case USER_ROLES.ACCOUNTANT:
      case USER_ROLES.CASHIER:
        can(Action.Read, CLERK_SUBJECT);
        can(Action.Create, CLERK_SUBJECT);
        break;

      case USER_ROLES.VIEWER:
        // Read-only roles may ask questions but not trigger a parse, which
        // is the more expensive operation.
        can(Action.Read, CLERK_SUBJECT);
        break;
    }
  }
}
