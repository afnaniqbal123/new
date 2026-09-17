import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from 'src/modules/reports/reports.service';
import { RunReportQueryDto } from 'src/modules/reports/dto/reports.dto';
import { REPORTS_RESPONSE } from 'src/modules/reports/constants/api-response/reports.response';
import {
  PROFIT_REPORT_SUBJECT,
  PROFIT_REPORTS,
  REPORT_KIND,
  REPORT_SUBJECT,
} from 'src/modules/reports/constants/reports.constant';
import {
  SerializeHttpError,
  SerializeHttpResponse,
} from 'src/utils/serializer';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { GetAbility } from 'src/modules/authorization/decorator/get-ability.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import type { AppAbility } from 'src/modules/authorization/types/app-ability.type';
import { stripProfitFigures } from 'src/modules/reports/utils/strip-profit.util';

@Controller('reports')
@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Everything the morning dashboard shows, in one round trip.
   *
   * Profit figures are stripped for roles without `PROFIT_REPORT_SUBJECT` —
   * a cashier sees today's takings and the low-stock list, and no margin.
   */
  @Get('dashboard')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: REPORT_SUBJECT })
  async dashboard(
    @GetOrganizationId() organizationId: string,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    const dashboard = await this.reportsService.getDashboard(organizationId);

    return SerializeHttpResponse(
      stripProfitFigures(dashboard, ability),
      200,
      REPORTS_RESPONSE.DASHBOARD_FETCHED,
    );
  }

  /**
   * Runs one of the named reports.
   *
   * The same entry point the AI clerk uses, so a question asked in chat and
   * the same question asked on a screen return identical numbers — there is
   * no second implementation to drift.
   */
  @Get('run')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: REPORT_SUBJECT })
  async run(
    @GetOrganizationId() organizationId: string,
    @Query() query: RunReportQueryDto,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    // Refused outright rather than returned with the margin fields removed:
    // a report whose entire content is profit, served with the profit taken
    // out, is a confusing empty screen. An honest refusal is more useful.
    if (
      PROFIT_REPORTS.has(query.kind) &&
      !(ability?.can(Action.Read, PROFIT_REPORT_SUBJECT) ?? false)
    ) {
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        REPORTS_RESPONSE.PROFIT_NOT_PERMITTED,
      );
    }

    const report = await this.reportsService.run(
      organizationId,
      query.kind,
      query.period,
      { from: query.from, to: query.to },
    );

    return SerializeHttpResponse(
      stripProfitFigures(report, ability),
      200,
      REPORTS_RESPONSE.REPORT_FETCHED,
    );
  }

  /** Which reports exist, for building a picker without hardcoding the list. */
  @Get('kinds')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: REPORT_SUBJECT })
  kinds(@GetAbility() ability: AppAbility | undefined) {
    const canSeeProfit =
      ability?.can(Action.Read, PROFIT_REPORT_SUBJECT) ?? false;

    const available = Object.values(REPORT_KIND).filter(
      (kind) => canSeeProfit || !PROFIT_REPORTS.has(kind),
    );

    return SerializeHttpResponse(
      available,
      200,
      REPORTS_RESPONSE.REPORT_FETCHED,
    );
  }
}
