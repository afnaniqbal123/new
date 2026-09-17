import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from 'src/modules/organization/organization.service';
import {
  CreateLocationDto,
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateLocationDto,
  UpdateMemberDto,
  UpdateOrganizationDto,
} from 'src/modules/organization/dto/organization.dto';
import { ORGANIZATION_RESPONSE } from 'src/modules/organization/constants/api-response/organization.response';
import {
  LOCATION_SUBJECT,
  ORGANIZATION_SUBJECT,
} from 'src/modules/organization/constants/organization.constant';
import { SerializeHttpResponse } from 'src/utils/serializer';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';

@Controller('organizations')
@ApiTags('Organizations')
@ApiBearerAuth()
// OrganizationAccessGuard first, so tenant context exists before
// PermissionsGuard builds the ability. See UserController for the full note.
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /**
   * Creates a workspace for the signed-in user.
   *
   * Deliberately not tenant-scoped: the caller has no organization yet, which
   * is the one moment in the system where that is legitimate.
   */
  @Post()
  async create(
    @Body() dto: CreateOrganizationDto,
    @GetUser('id') userId: string,
  ) {
    const organization = await this.organizationService.create(dto, userId);

    return SerializeHttpResponse(
      organization,
      201,
      ORGANIZATION_RESPONSE.CREATED,
    );
  }

  @Get('current')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: ORGANIZATION_SUBJECT })
  async current(@GetOrganizationId() organizationId: string) {
    const organization =
      await this.organizationService.findById(organizationId);

    return SerializeHttpResponse(
      organization,
      200,
      ORGANIZATION_RESPONSE.FETCHED,
    );
  }

  @Patch('current')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: ORGANIZATION_SUBJECT })
  async update(
    @GetOrganizationId() organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    const organization = await this.organizationService.update(
      organizationId,
      dto,
    );

    return SerializeHttpResponse(
      organization,
      200,
      ORGANIZATION_RESPONSE.UPDATED,
    );
  }

  // --- Locations ---------------------------------------------------------

  @Get('locations')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: LOCATION_SUBJECT })
  async listLocations(@GetOrganizationId() organizationId: string) {
    const locations =
      await this.organizationService.listLocations(organizationId);

    return SerializeHttpResponse(
      locations,
      200,
      ORGANIZATION_RESPONSE.LOCATIONS_FETCHED,
    );
  }

  @Post('locations')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: LOCATION_SUBJECT })
  async createLocation(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateLocationDto,
  ) {
    const location = await this.organizationService.createLocation(
      organizationId,
      dto,
    );

    return SerializeHttpResponse(
      location,
      201,
      ORGANIZATION_RESPONSE.LOCATION_CREATED,
    );
  }

  @Patch('locations/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: LOCATION_SUBJECT })
  async updateLocation(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    const location = await this.organizationService.updateLocation(
      organizationId,
      id,
      dto,
    );

    return SerializeHttpResponse(
      location,
      200,
      ORGANIZATION_RESPONSE.LOCATION_UPDATED,
    );
  }

  @Delete('locations/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Delete, subject: LOCATION_SUBJECT })
  async removeLocation(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const location = await this.organizationService.removeLocation(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      location,
      200,
      ORGANIZATION_RESPONSE.LOCATION_DELETED,
    );
  }

  // --- Team --------------------------------------------------------------

  @Get('members')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: ORGANIZATION_SUBJECT })
  async listMembers(@GetOrganizationId() organizationId: string) {
    const members = await this.organizationService.listMembers(organizationId);

    return SerializeHttpResponse(
      members,
      200,
      ORGANIZATION_RESPONSE.MEMBERS_FETCHED,
    );
  }

  @Post('members')
  @TenantScoped()
  @RequirePermissions({ action: Action.Manage, subject: ORGANIZATION_SUBJECT })
  async inviteMember(
    @GetOrganizationId() organizationId: string,
    @Body() dto: InviteMemberDto,
  ) {
    const member = await this.organizationService.inviteMember(
      organizationId,
      dto,
    );

    return SerializeHttpResponse(
      member,
      201,
      ORGANIZATION_RESPONSE.MEMBER_INVITED,
    );
  }

  @Patch('members/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Manage, subject: ORGANIZATION_SUBJECT })
  async updateMember(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const member = await this.organizationService.updateMember(
      organizationId,
      id,
      dto,
    );

    return SerializeHttpResponse(
      member,
      200,
      ORGANIZATION_RESPONSE.MEMBER_UPDATED,
    );
  }

  @Delete('members/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Manage, subject: ORGANIZATION_SUBJECT })
  async removeMember(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @GetUser('id') actingUserId: string,
  ) {
    const member = await this.organizationService.removeMember(
      organizationId,
      id,
      actingUserId,
    );

    return SerializeHttpResponse(
      member,
      200,
      ORGANIZATION_RESPONSE.MEMBER_REMOVED,
    );
  }
}
