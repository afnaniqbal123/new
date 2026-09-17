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
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { StockTransferService } from 'src/modules/inventory/stock-transfer.service';
import {
  CreateStockAdjustmentDto,
  CreateStockTransferDto,
  ExpiringBatchesQueryDto,
  ReceiveStockTransferDto,
  StockByLocationQueryDto,
  StockLedgerQueryDto,
} from 'src/modules/inventory/dto/inventory.dto';
import { INVENTORY_RESPONSE } from 'src/modules/inventory/constants/api-response/inventory.response';
import {
  STOCK_SUBJECT,
  STOCK_TRANSFER_SUBJECT,
} from 'src/modules/inventory/constants/inventory.constant';
import { SerializeHttpResponse } from 'src/utils/serializer';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';

@Controller('inventory')
@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly transferService: StockTransferService,
  ) {}

  /**
   * The movement history — the "why is the stock this number?" answer that
   * the append-only ledger exists to make answerable.
   */
  @Get('ledger')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: STOCK_SUBJECT })
  async ledger(
    @GetOrganizationId() organizationId: string,
    @Query() query: StockLedgerQueryDto,
  ) {
    const result = await this.inventoryService.getLedger(
      organizationId,
      {
        productId: query.product,
        locationId: query.location,
        reason: query.reason,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      query.page ?? 1,
      query.limit ?? 50,
    );

    return SerializeHttpResponse(
      result,
      200,
      INVENTORY_RESPONSE.LEDGER_FETCHED,
    );
  }

  @Get('stock-by-location')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: STOCK_SUBJECT })
  async stockByLocation(
    @GetOrganizationId() organizationId: string,
    @Query() query: StockByLocationQueryDto,
  ) {
    const breakdown = await this.inventoryService.getStockByLocation(
      organizationId,
      query.product,
    );

    return SerializeHttpResponse(
      breakdown,
      200,
      INVENTORY_RESPONSE.STOCK_FETCHED,
    );
  }

  @Get('valuation')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: STOCK_SUBJECT })
  async valuation(@GetOrganizationId() organizationId: string) {
    const value = await this.inventoryService.getStockValue(organizationId);

    return SerializeHttpResponse(
      { value },
      200,
      INVENTORY_RESPONSE.VALUATION_FETCHED,
    );
  }

  @Get('expiring')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: STOCK_SUBJECT })
  async expiring(
    @GetOrganizationId() organizationId: string,
    @Query() query: ExpiringBatchesQueryDto,
  ) {
    const batches = await this.inventoryService.getExpiringBatches(
      organizationId,
      query.withinDays ?? 30,
    );

    return SerializeHttpResponse(
      batches,
      200,
      INVENTORY_RESPONSE.EXPIRING_FETCHED,
    );
  }

  /**
   * Records a manual movement — a stock count correction, opening stock, or
   * a write-off. Always additive: never an edit of an existing movement.
   */
  @Post('adjustments')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: STOCK_SUBJECT })
  async adjust(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateStockAdjustmentDto,
    @GetUser('id') userId: string,
  ) {
    const locationId =
      dto.location ??
      String(
        await this.inventoryService.resolveDefaultLocation(organizationId),
      );

    const entries = await this.inventoryService.recordAdjustment(
      organizationId,
      locationId,
      dto.lines.map((line) => ({
        productId: line.product,
        locationId,
        quantity: line.quantity,
        reason: dto.reason,
        unitCost: line.unitCost,
        batchNo: line.batchNo,
        expiry: line.expiry ? new Date(line.expiry) : undefined,
        note: dto.note,
      })),
      userId,
    );

    return SerializeHttpResponse(entries, 201, INVENTORY_RESPONSE.ADJUSTED);
  }

  /**
   * Rebuilds a product's cached stock from the ledger. The repair path for
   * the projection — safe to run at any time, since the ledger is the truth.
   */
  @Post('recalculate/:productId')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: STOCK_SUBJECT })
  async recalculate(
    @GetOrganizationId() organizationId: string,
    @Param('productId') productId: string,
  ) {
    const total = await this.inventoryService.recalculateStock(
      organizationId,
      productId,
    );

    return SerializeHttpResponse(
      { stockOnHand: total },
      200,
      INVENTORY_RESPONSE.RECALCULATED,
    );
  }

  // --- Transfers ---------------------------------------------------------

  @Get('transfers')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: STOCK_TRANSFER_SUBJECT })
  async listTransfers(@GetOrganizationId() organizationId: string) {
    const transfers = await this.transferService.findAll(organizationId);

    return SerializeHttpResponse(
      transfers,
      200,
      INVENTORY_RESPONSE.TRANSFERS_FETCHED,
    );
  }

  @Post('transfers')
  @TenantScoped()
  @RequirePermissions({
    action: Action.Create,
    subject: STOCK_TRANSFER_SUBJECT,
  })
  async createTransfer(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateStockTransferDto,
    @GetUser('id') userId: string,
  ) {
    const transfer = await this.transferService.create(
      organizationId,
      dto,
      userId,
    );

    return SerializeHttpResponse(
      transfer,
      201,
      INVENTORY_RESPONSE.TRANSFER_CREATED,
    );
  }

  @Post('transfers/:id/dispatch')
  @TenantScoped()
  @RequirePermissions({
    action: Action.Update,
    subject: STOCK_TRANSFER_SUBJECT,
  })
  async dispatchTransfer(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ) {
    const transfer = await this.transferService.dispatch(
      organizationId,
      id,
      userId,
    );

    return SerializeHttpResponse(
      transfer,
      200,
      INVENTORY_RESPONSE.TRANSFER_DISPATCHED,
    );
  }

  @Post('transfers/:id/receive')
  @TenantScoped()
  @RequirePermissions({
    action: Action.Update,
    subject: STOCK_TRANSFER_SUBJECT,
  })
  async receiveTransfer(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: ReceiveStockTransferDto,
    @GetUser('id') userId: string,
  ) {
    const transfer = await this.transferService.receive(
      organizationId,
      id,
      dto,
      userId,
    );

    return SerializeHttpResponse(
      transfer,
      200,
      INVENTORY_RESPONSE.TRANSFER_RECEIVED,
    );
  }

  @Post('transfers/:id/cancel')
  @TenantScoped()
  @RequirePermissions({
    action: Action.Update,
    subject: STOCK_TRANSFER_SUBJECT,
  })
  async cancelTransfer(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ) {
    const transfer = await this.transferService.cancel(
      organizationId,
      id,
      userId,
    );

    return SerializeHttpResponse(
      transfer,
      200,
      INVENTORY_RESPONSE.TRANSFER_CANCELLED,
    );
  }
}
