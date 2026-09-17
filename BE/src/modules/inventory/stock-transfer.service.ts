import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StockTransfer,
  StockTransferDocument,
} from 'src/modules/inventory/stock-transfer.schema';
import {
  CreateStockTransferDto,
  ReceiveStockTransferDto,
} from 'src/modules/inventory/dto/inventory.dto';
import {
  STOCK_REASON,
  TRANSFER_STATUS,
} from 'src/modules/inventory/constants/inventory.constant';
import { INVENTORY_RESPONSE } from 'src/modules/inventory/constants/api-response/inventory.response';
import { SerializeHttpError } from 'src/utils/serializer';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { OrganizationService } from 'src/modules/organization/organization.service';

/**
 * Moves stock between two Locations, in two steps.
 *
 * Dispatch writes `TRANSFER_OUT` at the source; receipt writes `TRANSFER_IN`
 * at the destination. Between the two, the goods are on a van and belong to
 * neither location — which is the honest answer, and the reason this is not
 * modelled as a single instantaneous swap.
 *
 * Shrinkage in transit falls straight out of the design: if 24 leave and 22
 * arrive, the two ledger rows differ by 2, and the difference is visible in
 * the ledger rather than silently absorbed.
 */
@Injectable()
export class StockTransferService {
  constructor(
    @InjectModel(StockTransfer.name)
    private readonly transferModel: Model<StockTransferDocument>,
    private readonly inventoryService: InventoryService,
    private readonly organizationService: OrganizationService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateStockTransferDto,
    userId: string,
  ): Promise<StockTransferDocument> {
    if (dto.fromLocation === dto.toLocation) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        INVENTORY_RESPONSE.TRANSFER_SAME_LOCATION,
      );
    }

    await this.organizationService.assertLocationBelongs(
      organizationId,
      dto.fromLocation,
    );
    await this.organizationService.assertLocationBelongs(
      organizationId,
      dto.toLocation,
    );

    return this.transferModel.create({
      organization: new Types.ObjectId(organizationId),
      reference: await this.nextReference(organizationId),
      fromLocation: new Types.ObjectId(dto.fromLocation),
      toLocation: new Types.ObjectId(dto.toLocation),
      lines: dto.lines.map((line) => ({
        product: new Types.ObjectId(line.product),
        quantity: line.quantity,
        receivedQuantity: 0,
        batchNo: line.batchNo,
      })),
      status: TRANSFER_STATUS.DRAFT,
      createdBy: new Types.ObjectId(userId),
      note: dto.note,
    });
  }

  /**
   * Transfer references are per-tenant and sequential for human legibility on
   * paperwork. Unlike invoice numbers these carry no legal weight, so a
   * count-based reference is adequate and a gap is harmless.
   */
  private async nextReference(organizationId: string): Promise<string> {
    const count = await this.transferModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
    });

    return `TRF-${String(count + 1).padStart(5, '0')}`;
  }

  async findAll(
    organizationId: string,
    status?: TRANSFER_STATUS,
  ): Promise<StockTransferDocument[]> {
    return this.transferModel
      .find({
        organization: new Types.ObjectId(organizationId),
        ...(status ? { status } : {}),
      })
      .sort({ createdAt: -1 })
      .populate('fromLocation', 'name code')
      .populate('toLocation', 'name code')
      .populate('lines.product', 'name sku unit');
  }

  async findById(
    organizationId: string,
    transferId: string,
  ): Promise<StockTransferDocument> {
    const transfer = await this.transferModel
      .findOne({
        _id: new Types.ObjectId(transferId),
        organization: new Types.ObjectId(organizationId),
      })
      .populate('fromLocation', 'name code')
      .populate('toLocation', 'name code')
      .populate('lines.product', 'name sku unit');

    if (!transfer) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        INVENTORY_RESPONSE.TRANSFER_NOT_FOUND,
      );
    }

    return transfer;
  }

  /**
   * Takes the goods out of the source location.
   *
   * Stock is checked at the source before anything is written — a transfer
   * that overdraws a warehouse is the same mistake as a sale that does, and
   * gets the same refusal.
   */
  async dispatch(
    organizationId: string,
    transferId: string,
    userId: string,
  ): Promise<StockTransferDocument> {
    const transfer = await this.findById(organizationId, transferId);

    if (transfer.status !== TRANSFER_STATUS.DRAFT) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        INVENTORY_RESPONSE.TRANSFER_NOT_DISPATCHABLE,
      );
    }

    const fromLocation = String(
      transfer.fromLocation._id ?? transfer.fromLocation,
    );

    await this.inventoryService.assertSufficientStock(
      organizationId,
      fromLocation,
      transfer.lines.map((line) => ({
        productId: String(line.product._id ?? line.product),
        quantity: line.quantity,
      })),
    );

    await this.inventoryService.recordMovements(
      organizationId,
      transfer.lines.map((line) => ({
        productId: String(line.product._id ?? line.product),
        locationId: fromLocation,
        quantity: -line.quantity,
        reason: STOCK_REASON.TRANSFER_OUT,
        reference: transferId,
        referenceType: 'StockTransfer',
        referenceNumber: transfer.reference,
        batchNo: line.batchNo,
      })),
      userId,
    );

    transfer.status = TRANSFER_STATUS.IN_TRANSIT;
    transfer.dispatchedAt = new Date();

    return transfer.save();
  }

  /**
   * Brings the goods into the destination location.
   *
   * The received quantity is taken from the request, not assumed equal to the
   * dispatched one. A line that arrives short leaves a permanent, visible
   * difference between the two ledger rows — which is exactly what someone
   * investigating a loss needs to find.
   */
  async receive(
    organizationId: string,
    transferId: string,
    dto: ReceiveStockTransferDto,
    userId: string,
  ): Promise<StockTransferDocument> {
    const transfer = await this.findById(organizationId, transferId);

    if (transfer.status !== TRANSFER_STATUS.IN_TRANSIT) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        INVENTORY_RESPONSE.TRANSFER_NOT_RECEIVABLE,
      );
    }

    const toLocation = String(transfer.toLocation._id ?? transfer.toLocation);
    const received = new Map(
      dto.lines.map((line) => [line.product, line.receivedQuantity]),
    );

    const movements = transfer.lines
      .map((line) => {
        const productId = String(line.product._id ?? line.product);
        const quantity = received.get(productId) ?? line.quantity;

        line.receivedQuantity = quantity;

        return {
          productId,
          locationId: toLocation,
          quantity,
          reason: STOCK_REASON.TRANSFER_IN,
          reference: transferId,
          referenceType: 'StockTransfer',
          referenceNumber: transfer.reference,
          batchNo: line.batchNo,
        };
      })
      // A line that arrived as zero writes no inbound row: the stock simply
      // never came in, and a zero-quantity movement is noise in the ledger.
      .filter((movement) => movement.quantity > 0);

    await this.inventoryService.recordMovements(
      organizationId,
      movements,
      userId,
    );

    transfer.status = TRANSFER_STATUS.COMPLETED;
    transfer.receivedAt = new Date();

    if (dto.note) transfer.note = dto.note;

    return transfer.save();
  }

  /**
   * Cancels a transfer, returning in-transit goods to their source.
   *
   * A dispatched transfer cannot simply be marked cancelled — the stock has
   * already left the source ledger, and forgetting to put it back is how a
   * warehouse loses a pallet on paper. The reversal is written explicitly.
   */
  async cancel(
    organizationId: string,
    transferId: string,
    userId: string,
  ): Promise<StockTransferDocument> {
    const transfer = await this.findById(organizationId, transferId);

    if (transfer.status === TRANSFER_STATUS.COMPLETED) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        INVENTORY_RESPONSE.TRANSFER_NOT_DISPATCHABLE,
      );
    }

    if (transfer.status === TRANSFER_STATUS.IN_TRANSIT) {
      await this.inventoryService.reverseMovementsFor(
        organizationId,
        transferId,
        STOCK_REASON.TRANSFER_IN,
        userId,
        `Transfer ${transfer.reference} cancelled`,
      );
    }

    transfer.status = TRANSFER_STATUS.CANCELLED;

    return transfer.save();
  }
}
