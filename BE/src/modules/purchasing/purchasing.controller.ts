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
import { PurchasingService } from 'src/modules/purchasing/purchasing.service';
import {
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  PurchaseOrderQueryDto,
  RecordSupplierPaymentDto,
  SupplierLedgerQueryDto,
  SupplierQueryDto,
  UpdateSupplierDto,
} from 'src/modules/purchasing/dto/purchasing.dto';
import { PURCHASING_RESPONSE } from 'src/modules/purchasing/constants/api-response/purchasing.response';
import {
  GOODS_RECEIPT_SUBJECT,
  PURCHASE_ORDER_SUBJECT,
  SUPPLIER_SUBJECT,
} from 'src/modules/purchasing/constants/purchasing.constant';
import { SerializeHttpResponse } from 'src/utils/serializer';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';

@Controller('purchasing')
@ApiTags('Purchasing')
@ApiBearerAuth()
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  // --- Suppliers ---------------------------------------------------------

  @Get('suppliers')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: SUPPLIER_SUBJECT })
  async listSuppliers(
    @GetOrganizationId() organizationId: string,
    @Query() query: SupplierQueryDto,
  ) {
    const result = await this.purchasingService.findSuppliers(
      organizationId,
      query,
    );

    return SerializeHttpResponse(
      { ...result, page: query.page ?? 1, limit: query.limit ?? 25 },
      200,
      PURCHASING_RESPONSE.SUPPLIERS_FETCHED,
    );
  }

  @Post('suppliers')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: SUPPLIER_SUBJECT })
  async createSupplier(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    const supplier = await this.purchasingService.createSupplier(
      organizationId,
      dto,
    );

    return SerializeHttpResponse(
      supplier,
      201,
      PURCHASING_RESPONSE.SUPPLIER_CREATED,
    );
  }

  @Get('suppliers/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: SUPPLIER_SUBJECT })
  async findSupplier(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const supplier = await this.purchasingService.findSupplierById(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      supplier,
      200,
      PURCHASING_RESPONSE.SUPPLIER_FETCHED,
    );
  }

  @Get('suppliers/:id/ledger')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: SUPPLIER_SUBJECT })
  async supplierLedger(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query() query: SupplierLedgerQueryDto,
  ) {
    const result = await this.purchasingService.getSupplierLedger(
      organizationId,
      id,
      query.page ?? 1,
      query.limit ?? 50,
    );

    return SerializeHttpResponse(
      result,
      200,
      PURCHASING_RESPONSE.SUPPLIER_LEDGER_FETCHED,
    );
  }

  @Post('suppliers/:id/payments')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: SUPPLIER_SUBJECT })
  async paySupplier(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: RecordSupplierPaymentDto,
    @GetUser('id') userId: string,
  ) {
    const entries = await this.purchasingService.recordSupplierPayment(
      organizationId,
      id,
      dto,
      userId,
    );

    return SerializeHttpResponse(
      entries,
      201,
      PURCHASING_RESPONSE.SUPPLIER_PAYMENT_RECORDED,
    );
  }

  @Patch('suppliers/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: SUPPLIER_SUBJECT })
  async updateSupplier(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    const supplier = await this.purchasingService.updateSupplier(
      organizationId,
      id,
      dto,
    );

    return SerializeHttpResponse(
      supplier,
      200,
      PURCHASING_RESPONSE.SUPPLIER_UPDATED,
    );
  }

  @Delete('suppliers/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Delete, subject: SUPPLIER_SUBJECT })
  async deactivateSupplier(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const supplier = await this.purchasingService.deactivateSupplier(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      supplier,
      200,
      PURCHASING_RESPONSE.SUPPLIER_DELETED,
    );
  }

  // --- Purchase orders ---------------------------------------------------

  @Get('orders')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: PURCHASE_ORDER_SUBJECT })
  async listOrders(
    @GetOrganizationId() organizationId: string,
    @Query() query: PurchaseOrderQueryDto,
  ) {
    const orders = await this.purchasingService.findOrders(
      organizationId,
      query.status,
    );

    return SerializeHttpResponse(
      orders,
      200,
      PURCHASING_RESPONSE.ORDERS_FETCHED,
    );
  }

  /** What to reorder. Registered before `:id` so it is not read as an id. */
  @Get('orders/suggestions')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: PURCHASE_ORDER_SUBJECT })
  async suggestions(@GetOrganizationId() organizationId: string) {
    const items =
      await this.purchasingService.getReorderSuggestions(organizationId);

    return SerializeHttpResponse(
      items,
      200,
      PURCHASING_RESPONSE.SUGGESTIONS_FETCHED,
    );
  }

  @Post('orders')
  @TenantScoped()
  @RequirePermissions({
    action: Action.Create,
    subject: PURCHASE_ORDER_SUBJECT,
  })
  async createOrder(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreatePurchaseOrderDto,
    @GetUser('id') userId: string,
  ) {
    const order = await this.purchasingService.createOrder(
      organizationId,
      dto,
      userId,
    );

    return SerializeHttpResponse(order, 201, PURCHASING_RESPONSE.ORDER_CREATED);
  }

  @Get('orders/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: PURCHASE_ORDER_SUBJECT })
  async findOrder(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const order = await this.purchasingService.findOrderById(
      organizationId,
      id,
    );

    return SerializeHttpResponse(order, 200, PURCHASING_RESPONSE.ORDER_FETCHED);
  }

  @Post('orders/:id/send')
  @TenantScoped()
  @RequirePermissions({
    action: Action.Update,
    subject: PURCHASE_ORDER_SUBJECT,
  })
  async sendOrder(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const order = await this.purchasingService.sendOrder(organizationId, id);

    return SerializeHttpResponse(order, 200, PURCHASING_RESPONSE.ORDER_SENT);
  }

  @Post('orders/:id/cancel')
  @TenantScoped()
  @RequirePermissions({
    action: Action.Update,
    subject: PURCHASE_ORDER_SUBJECT,
  })
  async cancelOrder(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const order = await this.purchasingService.cancelOrder(organizationId, id);

    return SerializeHttpResponse(
      order,
      200,
      PURCHASING_RESPONSE.ORDER_CANCELLED,
    );
  }

  // --- Goods receipts ----------------------------------------------------

  @Get('receipts')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: GOODS_RECEIPT_SUBJECT })
  async listReceipts(@GetOrganizationId() organizationId: string) {
    const result = await this.purchasingService.findReceipts(organizationId);

    return SerializeHttpResponse(
      result,
      200,
      PURCHASING_RESPONSE.RECEIPTS_FETCHED,
    );
  }

  /**
   * Receives goods. This is the call that writes stock and moves the
   * weighted-average cost — not the purchase order.
   */
  @Post('receipts')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: GOODS_RECEIPT_SUBJECT })
  async receiveGoods(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateGoodsReceiptDto,
    @GetUser('id') userId: string,
  ) {
    const receipt = await this.purchasingService.receiveGoods(
      organizationId,
      dto,
      userId,
    );

    return SerializeHttpResponse(
      receipt,
      201,
      PURCHASING_RESPONSE.RECEIPT_CREATED,
    );
  }
}
