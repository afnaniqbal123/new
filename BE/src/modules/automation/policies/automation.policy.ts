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
import { AUTOMATION_SUBJECT } from 'src/modules/automation/constants/automation.constant';

/**
 * Who may see and trigger automations.
 *
 * Triggering re-sends a digest to the whole team, so it is limited to the
 * roles that would be answerable for the noise. Reading the history is open
 * to everyone: "did the low-stock alert run this morning?" is an operational
 * question a cashier may reasonably have.
 */
@Injectable()
export class AutomationPolicy implements AuthorizationPolicy, OnModuleInit {
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

    can(Action.Read, AUTOMATION_SUBJECT);
    can(Action.List, AUTOMATION_SUBJECT);

    switch (role) {
      case USER_ROLES.OWNER:
      case USER_ROLES.ADMIN:
      case USER_ROLES.MANAGER:
        can(Action.Manage, AUTOMATION_SUBJECT);
        break;

      case USER_ROLES.ACCOUNTANT:
      case USER_ROLES.CASHIER:
      case USER_ROLES.VIEWER:
        break;
    }
  }
}
