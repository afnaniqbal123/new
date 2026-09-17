import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerService } from 'src/modules/customer/customer.service';
import {
  CreateCustomerDto,
  CreateCustomerLedgerEntryDto,
  CustomerLedgerQueryDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from 'src/modules/customer/dto/customer.dto';
import { CUSTOMER_RESPONSE } from 'src/modules/customer/constants/api-response/customer.response';
import { CUSTOMER_SUBJECT } from 'src/modules/customer/constants/customer.constant';
import { SerializeHttpResponse } from 'src/utils/serializer';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';

@Controller('customers')
@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: CUSTOMER_SUBJECT })
  async findAll(
    @GetOrganizationId() organizationId: string,
    @Query() query: CustomerQueryDto,
  ) {
    const result = await this.customerService.findAll(organizationId, query);

    return SerializeHttpResponse(
      { ...result, page: query.page ?? 1, limit: query.limit ?? 25 },
      200,
      CUSTOMER_RESPONSE.LIST_FETCHED,
    );
  }

  /**
   * Receivables split by how overdue they are. Registered before `:id` so
   * "aging" is never read as a customer id.
   */
  @Get('aging')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: CUSTOMER_SUBJECT })
  async aging(@GetOrganizationId() organizationId: string) {
    const buckets = await this.customerService.getAging(organizationId);

    return SerializeHttpResponse(buckets, 200, CUSTOMER_RESPONSE.AGING_FETCHED);
  }

  @Get('overdue')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: CUSTOMER_SUBJECT })
  async overdue(@GetOrganizationId() organizationId: string) {
    const customers = await this.customerService.findOverdue(organizationId);

    return SerializeHttpResponse(
      customers,
      200,
      CUSTOMER_RESPONSE.LIST_FETCHED,
    );
  }

  @Get(':id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: CUSTOMER_SUBJECT })
  async findOne(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const customer = await this.customerService.findById(organizationId, id);

    return SerializeHttpResponse(customer, 200, CUSTOMER_RESPONSE.FETCHED);
  }

  @Get(':id/ledger')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: CUSTOMER_SUBJECT })
  async ledger(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query() query: CustomerLedgerQueryDto,
  ) {
    const result = await this.customerService.getLedger(
      organizationId,
      id,
      query.page ?? 1,
      query.limit ?? 50,
    );

    return SerializeHttpResponse(result, 200, CUSTOMER_RESPONSE.LEDGER_FETCHED);
  }

  @Post()
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: CUSTOMER_SUBJECT })
  async create(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    const customer = await this.customerService.create(organizationId, dto);

    return SerializeHttpResponse(customer, 201, CUSTOMER_RESPONSE.CREATED);
  }

  @Patch(':id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: CUSTOMER_SUBJECT })
  async update(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const customer = await this.customerService.update(organizationId, id, dto);

    return SerializeHttpResponse(customer, 200, CUSTOMER_RESPONSE.UPDATED);
  }

  /**
   * A manual balance movement — opening balance, correction, or write-off.
   * Sales and payments never come through here; they arrive with their own
   * documents, which is what keeps the ledger reconcilable.
   */
  @Post(':id/ledger')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: CUSTOMER_SUBJECT })
  async addLedgerEntry(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: CreateCustomerLedgerEntryDto,
    @GetUser('id') userId: string,
  ) {
    const entries = await this.customerService.recordMovements(
      organizationId,
      [
        {
          customerId: id,
          type: dto.type,
          amount: dto.amount,
          note: dto.note,
        },
      ],
      userId,
    );

    return SerializeHttpResponse(entries, 201, CUSTOMER_RESPONSE.ADJUSTED);
  }

  @Post(':id/recalculate')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: CUSTOMER_SUBJECT })
  async recalculate(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const balance = await this.customerService.recalculateBalance(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      { outstanding: balance },
      200,
      CUSTOMER_RESPONSE.BALANCE_RECALCULATED,
    );
  }

  @Delete(':id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Delete, subject: CUSTOMER_SUBJECT })
  async deactivate(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const customer = await this.customerService.deactivate(organizationId, id);

    return SerializeHttpResponse(customer, 200, CUSTOMER_RESPONSE.DELETED);
  }
}
