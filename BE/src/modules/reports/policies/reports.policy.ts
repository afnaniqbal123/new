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
  PROFIT_REPORT_SUBJECT,
  REPORT_SUBJECT,
} from 'src/modules/reports/constants/reports.constant';

/**
 * Who may run reports, and who may see margin.
 *
 * Two subjects, for the same reason the catalogue splits cost out: a cashier
 * can legitimately be shown what they sold today, and must not be shown what
 * it earned. `PROFIT_REPORT_SUBJECT` gates the reports whose whole content is
 * margin — profit, top products, dead stock, stock valuation.
 */
@Injectable()
export class ReportsPolicy implements AuthorizationPolicy, OnModuleInit {
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

    // Everyone gets the operational reports — a cashier seeing their own
    // day's takings is the point of having a dashboard at all.
    can(Action.Read, REPORT_SUBJECT);
    can(Action.List, REPORT_SUBJECT);

    switch (role) {
      case USER_ROLES.OWNER:
      case USER_ROLES.ADMIN:
      case USER_ROLES.MANAGER:
      case USER_ROLES.ACCOUNTANT:
        can(Action.Read, PROFIT_REPORT_SUBJECT);
        break;

      case USER_ROLES.CASHIER:
      case USER_ROLES.VIEWER:
        // Operational reports only. No margin.
        break;
    }
  }
}
