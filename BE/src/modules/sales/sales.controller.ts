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
import { SalesService } from 'src/modules/sales/sales.service';
import { SaleReturnService } from 'src/modules/sales/sale-return.service';
import {
  CreateSaleDto,
  CreateSaleReturnDto,
  RecordSalePaymentDto,
  SaleQueryDto,
  VoidSaleDto,
} from 'src/modules/sales/dto/sales.dto';
import { SALES_RESPONSE } from 'src/modules/sales/constants/api-response/sales.response';
import {
  DISCOUNT_OVERRIDE_SUBJECT,
  SALE_RETURN_SUBJECT,
  SALE_SUBJECT,
  SALE_VOID_SUBJECT,
} from 'src/modules/sales/constants/sales.constant';
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

@Controller('sales')
@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly returnService: SaleReturnService,
  ) {}

  /**
   * Prices a basket without writing anything.
   *
   * The POS calls this on every change so the cashier sees a live total, and
   * `POST /sales` runs the same code before committing — one implementation,
   * so the displayed total and the charged total cannot drift.
   */
  @Post('quote')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: SALE_SUBJECT })
  async quote(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateSaleDto,
  ) {
    const quote = await this.salesService.quote(organizationId, dto);

    return SerializeHttpResponse(quote, 200, SALES_RESPONSE.QUOTED);
  }

  @Post()
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: SALE_SUBJECT })
  async create(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateSaleDto,
    @GetUser('id') userId: string,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    // The two overrides are resolved here, from the ability, and passed down.
    // The service enforces the limits; the policy decides who may pass them.
    // Keeping those separate is what stops "who may override?" from being
    // answered in two places.
    const sale = await this.salesService.create(organizationId, dto, userId, {
      credit: ability?.can(Action.Create, CREDIT_OVERRIDE_SUBJECT) ?? false,
      discount: ability?.can(Action.Create, DISCOUNT_OVERRIDE_SUBJECT) ?? false,
    });

    return SerializeHttpResponse(sale, 201, SALES_RESPONSE.CREATED);
  }

  @Get()
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: SALE_SUBJECT })
  async findAll(
    @GetOrganizationId() organizationId: string,
    @Query() query: SaleQueryDto,
  ) {
    const result = await this.salesService.findAll(organizationId, query);

    return SerializeHttpResponse(
      { ...result, page: query.page ?? 1, limit: query.limit ?? 25 },
      200,
      SALES_RESPONSE.LIST_FETCHED,
    );
  }

  /** Registered before `:id` so "returns" is never read as a sale id. */
  @Get('returns')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: SALE_RETURN_SUBJECT })
  async listReturns(@GetOrganizationId() organizationId: string) {
    const result = await this.returnService.findAll(organizationId);

    return SerializeHttpResponse(result, 200, SALES_RESPONSE.RETURNS_FETCHED);
  }

  @Post('returns')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: SALE_RETURN_SUBJECT })
  async createReturn(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateSaleReturnDto,
    @GetUser('id') userId: string,
  ) {
    const saleReturn = await this.returnService.create(
      organizationId,
      dto,
      userId,
    );

    return SerializeHttpResponse(
      saleReturn,
      201,
      SALES_RESPONSE.RETURN_CREATED,
    );
  }

  @Get('returns/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: SALE_RETURN_SUBJECT })
  async findReturn(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const saleReturn = await this.returnService.findById(organizationId, id);

    return SerializeHttpResponse(
      saleReturn,
      200,
      SALES_RESPONSE.RETURN_CREATED,
    );
  }

  @Get(':id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: SALE_SUBJECT })
  async findOne(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const sale = await this.salesService.findById(organizationId, id);

    return SerializeHttpResponse(sale, 200, SALES_RESPONSE.FETCHED);
  }

  @Post(':id/payments')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: SALE_SUBJECT })
  async recordPayment(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: RecordSalePaymentDto,
    @GetUser('id') userId: string,
  ) {
    const sale = await this.salesService.recordPayment(
      organizationId,
      id,
      dto,
      userId,
    );

    return SerializeHttpResponse(sale, 200, SALES_RESPONSE.PAYMENT_RECORDED);
  }

  /**
   * Voiding reverses stock and a customer's balance, and is the obvious way
   * to cover a till shortage — so it needs its own permission, not merely
   * update rights on the sale.
   */
  @Post(':id/void')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: SALE_VOID_SUBJECT })
  async voidSale(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: VoidSaleDto,
    @GetUser('id') userId: string,
  ) {
    const sale = await this.salesService.voidSale(
      organizationId,
      id,
      userId,
      dto.reason,
    );

    return SerializeHttpResponse(sale, 200, SALES_RESPONSE.VOIDED);
  }
}
