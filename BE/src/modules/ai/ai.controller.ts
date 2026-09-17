import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkService } from 'src/modules/ai/clerk.service';
import { AskClerkDto, ParseMessageDto } from 'src/modules/ai/dto/ai.dto';
import { AI_RESPONSE } from 'src/modules/ai/constants/api-response/ai.response';
import { CLERK_SUBJECT } from 'src/modules/ai/constants/ai.constant';
import { PROFIT_REPORT_SUBJECT } from 'src/modules/reports/constants/reports.constant';
import { SerializeHttpResponse } from 'src/utils/serializer';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { GetAbility } from 'src/modules/authorization/decorator/get-ability.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import type { AppAbility } from 'src/modules/authorization/types/app-ability.type';

@Controller('clerk')
@ApiTags('AI Clerk')
@ApiBearerAuth()
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class AiController {
  constructor(private readonly clerkService: ClerkService) {}

  /**
   * Whether the clerk is usable, so the UI can say "add a key to enable this"
   * instead of offering a chat box that silently returns nothing.
   */
  @Get('status')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: CLERK_SUBJECT })
  status() {
    return SerializeHttpResponse(
      { configured: this.clerkService.isConfigured() },
      200,
      AI_RESPONSE.STATUS_FETCHED,
    );
  }

  /**
   * Asks a business question.
   *
   * The answer's figures come from a real report run with the caller's own
   * permissions — so a cashier asking about margin gets an honest refusal
   * rather than a number they should not see.
   */
  @Post('ask')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: CLERK_SUBJECT })
  async ask(
    @GetOrganizationId() organizationId: string,
    @Body() dto: AskClerkDto,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    const answer = await this.clerkService.ask(
      organizationId,
      dto.question,
      ability?.can(Action.Read, PROFIT_REPORT_SUBJECT) ?? false,
    );

    return SerializeHttpResponse(
      answer,
      200,
      answer.answerable ? AI_RESPONSE.ANSWERED : AI_RESPONSE.NOT_ANSWERABLE,
    );
  }

  /**
   * Parses a message into a matched order proposal, without saving anything.
   *
   * Used by the WhatsApp simulator and by anyone pasting an order in from
   * another channel — a phone call, an SMS, an email.
   */
  @Post('parse-order')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: CLERK_SUBJECT })
  async parseOrder(
    @GetOrganizationId() organizationId: string,
    @Body() dto: ParseMessageDto,
  ) {
    const parsed = await this.clerkService.parseOrderMessage(
      organizationId,
      dto.message,
      dto.customerName,
    );

    return SerializeHttpResponse(parsed, 200, AI_RESPONSE.PARSED);
  }
}
