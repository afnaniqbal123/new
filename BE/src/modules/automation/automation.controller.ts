import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AutomationService } from 'src/modules/automation/automation.service';
import {
  AUTOMATION_KIND,
  AUTOMATION_SUBJECT,
} from 'src/modules/automation/constants/automation.constant';
import { AUTOMATION_RESPONSE } from 'src/modules/automation/constants/api-response/automation.response';
import {
  LatestRunQueryDto,
  TriggerAutomationDto,
} from 'src/modules/automation/dto/automation.dto';
import { SerializeHttpResponse } from 'src/utils/serializer';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';

@Controller('automations')
@ApiTags('Automations')
@ApiBearerAuth()
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: AUTOMATION_SUBJECT })
  async history(@GetOrganizationId() organizationId: string) {
    const runs = await this.automationService.getRuns(organizationId);

    return SerializeHttpResponse(runs, 200, AUTOMATION_RESPONSE.RUNS_FETCHED);
  }

  /**
   * Whether jobs are durable.
   *
   * Surfaced rather than hidden: a deployment running in-process has no
   * retries and no persistence, and an operator should be able to see that
   * without reading the logs.
   */
  @Get('status')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: AUTOMATION_SUBJECT })
  status() {
    return SerializeHttpResponse(
      { distributed: this.automationService.isDistributed() },
      200,
      AUTOMATION_RESPONSE.RUNS_FETCHED,
    );
  }

  @Get('latest')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: AUTOMATION_SUBJECT })
  async latest(
    @GetOrganizationId() organizationId: string,
    @Query() query: LatestRunQueryDto,
  ) {
    const run = await this.automationService.getLatest(
      organizationId,
      query.kind,
    );

    return SerializeHttpResponse(run, 200, AUTOMATION_RESPONSE.DIGEST_FETCHED);
  }

  /** Runs an automation now — for testing one, or re-sending a digest. */
  @Post('trigger')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: AUTOMATION_SUBJECT })
  async trigger(
    @GetOrganizationId() organizationId: string,
    @Body() dto: TriggerAutomationDto,
  ) {
    await this.automationService.trigger(organizationId, dto.kind);

    return SerializeHttpResponse(
      { kind: dto.kind },
      202,
      AUTOMATION_RESPONSE.TRIGGERED,
    );
  }

  /** Which automations exist, so the settings screen need not hardcode them. */
  @Get('kinds')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: AUTOMATION_SUBJECT })
  kinds() {
    return SerializeHttpResponse(
      Object.values(AUTOMATION_KIND),
      200,
      AUTOMATION_RESPONSE.RUNS_FETCHED,
    );
  }
}
