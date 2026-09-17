import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WhatsAppService } from 'src/modules/whatsapp/whatsapp.service';
import { DraftOrderService } from 'src/modules/whatsapp/draft-order.service';
import {
  ConfirmDraftOrderDto,
  ConversationQueryDto,
  DraftOrderQueryDto,
  LinkCustomerDto,
  RejectDraftOrderDto,
  SendWhatsAppMessageDto,
  SimulateInboundDto,
} from 'src/modules/whatsapp/dto/whatsapp.dto';
import { WHATSAPP_RESPONSE } from 'src/modules/whatsapp/constants/api-response/whatsapp.response';
import {
  CONVERSATION_SUBJECT,
  DRAFT_ORDER_SUBJECT,
} from 'src/modules/whatsapp/constants/whatsapp.constant';
import { DISCOUNT_OVERRIDE_SUBJECT } from 'src/modules/sales/constants/sales.constant';
import { CREDIT_OVERRIDE_SUBJECT } from 'src/modules/customer/constants/customer.constant';
import { SerializeHttpResponse } from 'src/utils/serializer';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { GetAbility } from 'src/modules/authorization/decorator/get-ability.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import type { AppAbility } from 'src/modules/authorization/types/app-ability.type';

@Controller('whatsapp')
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class WhatsAppController {
  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly draftService: DraftOrderService,
  ) {}

  // --- Conversations -----------------------------------------------------

  @Get('conversations')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: CONVERSATION_SUBJECT })
  async listConversations(
    @GetOrganizationId() organizationId: string,
    @Query() query: ConversationQueryDto,
  ) {
    const conversations = await this.whatsappService.findConversations(
      organizationId,
      query.status,
    );

    return SerializeHttpResponse(
      conversations,
      200,
      WHATSAPP_RESPONSE.CONVERSATIONS_FETCHED,
    );
  }

  /** Badge counts for the sidebar, in one call rather than two. */
  @Get('badges')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: CONVERSATION_SUBJECT })
  async badges(@GetOrganizationId() organizationId: string) {
    const [unread, pendingDrafts] = await Promise.all([
      this.whatsappService.countUnread(organizationId),
      this.draftService.countPending(organizationId),
    ]);

    return SerializeHttpResponse(
      { unread, pendingDrafts },
      200,
      WHATSAPP_RESPONSE.CONVERSATIONS_FETCHED,
    );
  }

  /**
   * Injects an inbound message as though Meta had delivered it.
   *
   * Runs the real `handleInbound` path — same customer matching, same AI
   * parse, same draft order. This is what makes the whole feature usable
   * before a Meta Business account exists. CONTEXT.md D10.
   */
  @Post('simulate')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: CONVERSATION_SUBJECT })
  async simulate(
    @GetOrganizationId() organizationId: string,
    @Body() dto: SimulateInboundDto,
  ) {
    const result = await this.whatsappService.handleInbound(organizationId, {
      phone: dto.phone,
      contactName: dto.contactName,
      text: dto.text,
      simulated: true,
    });

    return SerializeHttpResponse(result, 201, WHATSAPP_RESPONSE.SIMULATED);
  }

  @Get('conversations/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: CONVERSATION_SUBJECT })
  async findConversation(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const conversation = await this.whatsappService.findConversation(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      conversation,
      200,
      WHATSAPP_RESPONSE.CONVERSATION_FETCHED,
    );
  }

  @Get('conversations/:id/messages')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: CONVERSATION_SUBJECT })
  async messages(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const messages = await this.whatsappService.findMessages(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      messages,
      200,
      WHATSAPP_RESPONSE.MESSAGES_FETCHED,
    );
  }

  @Post('conversations/:id/messages')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: CONVERSATION_SUBJECT })
  async send(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: SendWhatsAppMessageDto,
    @GetUser('id') userId: string,
  ) {
    const message = await this.whatsappService.sendMessage(
      organizationId,
      id,
      dto.text,
      userId,
    );

    return SerializeHttpResponse(message, 201, WHATSAPP_RESPONSE.MESSAGE_SENT);
  }

  @Post('conversations/:id/read')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: CONVERSATION_SUBJECT })
  async markRead(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const conversation = await this.whatsappService.markRead(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      conversation,
      200,
      WHATSAPP_RESPONSE.CONVERSATION_FETCHED,
    );
  }

  @Post('conversations/:id/link-customer')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: CONVERSATION_SUBJECT })
  async linkCustomer(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: LinkCustomerDto,
  ) {
    const conversation = await this.whatsappService.linkCustomer(
      organizationId,
      id,
      dto.customer,
    );

    return SerializeHttpResponse(
      conversation,
      200,
      WHATSAPP_RESPONSE.CONVERSATION_FETCHED,
    );
  }

  @Post('conversations/:id/close')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: CONVERSATION_SUBJECT })
  async close(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const conversation = await this.whatsappService.closeConversation(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      conversation,
      200,
      WHATSAPP_RESPONSE.CONVERSATION_CLOSED,
    );
  }

  // --- Draft orders ------------------------------------------------------

  @Get('drafts')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: DRAFT_ORDER_SUBJECT })
  async listDrafts(
    @GetOrganizationId() organizationId: string,
    @Query() query: DraftOrderQueryDto,
  ) {
    const drafts = await this.draftService.findAll(
      organizationId,
      query.status,
    );

    return SerializeHttpResponse(drafts, 200, WHATSAPP_RESPONSE.DRAFTS_FETCHED);
  }

  @Get('drafts/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: DRAFT_ORDER_SUBJECT })
  async findDraft(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const draft = await this.draftService.findById(organizationId, id);

    return SerializeHttpResponse(draft, 200, WHATSAPP_RESPONSE.DRAFT_FETCHED);
  }

  /**
   * Confirms a draft into a real sale.
   *
   * Requires `Create` on `SALE_SUBJECT`, not merely on the draft: confirming
   * *is* selling, and the permission has to match the consequence. The same
   * credit and discount overrides the POS resolves are resolved here too.
   */
  @Post('drafts/:id/confirm')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: DRAFT_ORDER_SUBJECT })
  async confirmDraft(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: ConfirmDraftOrderDto,
    @GetUser('id') userId: string,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    const result = await this.draftService.confirm(
      organizationId,
      id,
      dto,
      userId,
      {
        credit: ability?.can(Action.Create, CREDIT_OVERRIDE_SUBJECT) ?? false,
        discount:
          ability?.can(Action.Create, DISCOUNT_OVERRIDE_SUBJECT) ?? false,
      },
    );

    return SerializeHttpResponse(
      result,
      201,
      WHATSAPP_RESPONSE.DRAFT_CONFIRMED,
    );
  }

  @Post('drafts/:id/reject')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: DRAFT_ORDER_SUBJECT })
  async rejectDraft(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: RejectDraftOrderDto,
    @GetUser('id') userId: string,
  ) {
    const draft = await this.draftService.reject(
      organizationId,
      id,
      userId,
      dto.reason,
    );

    return SerializeHttpResponse(draft, 200, WHATSAPP_RESPONSE.DRAFT_REJECTED);
  }
}
