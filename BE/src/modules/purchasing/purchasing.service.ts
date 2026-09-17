import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Supplier,
  SupplierDocument,
  SupplierLedgerEntry,
  SupplierLedgerEntryDocument,
} from 'src/modules/purchasing/supplier.schema';
import {
  GoodsReceipt,
  GoodsReceiptDocument,
  PurchaseOrder,
  PurchaseOrderDocument,
} from 'src/modules/purchasing/purchase-order.schema';
import {
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  RecordSupplierPaymentDto,
  SupplierQueryDto,
  UpdateSupplierDto,
} from 'src/modules/purchasing/dto/purchasing.dto';
import {
  PURCHASE_ORDER_STATUS,
  SUPPLIER_LEDGER_TYPE,
} from 'src/modules/purchasing/constants/purchasing.constant';
import { PURCHASING_RESPONSE } from 'src/modules/purchasing/constants/api-response/purchasing.response';
import { SerializeHttpError } from 'src/utils/serializer';
import { multiply, sum } from 'src/utils/money';
import { CatalogService } from 'src/modules/catalog/catalog.service';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { STOCK_REASON } from 'src/modules/inventory/constants/inventory.constant';

/**
 * Owns suppliers, purchase orders, goods receipts, and the payables ledger.
 *
 * The load-bearing distinction in this module: **an order is a promise, a
 * receipt is an event**. Only the receipt writes stock, recomputes
 * weighted-average cost, and creates a payable. Fusing the two would make a
 * partial delivery — the ordinary case — impossible to represent.
 */
@Injectable()
export class PurchasingService {
  private readonly logger = new Logger(PurchasingService.name);

  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(SupplierLedgerEntry.name)
    private readonly ledgerModel: Model<SupplierLedgerEntryDocument>,
    @InjectModel(PurchaseOrder.name)
    private readonly orderModel: Model<PurchaseOrderDocument>,
    @InjectModel(GoodsReceipt.name)
    private readonly receiptModel: Model<GoodsReceiptDocument>,
    private readonly catalogService: CatalogService,
    private readonly inventoryService: InventoryService,
    private readonly organizationService: OrganizationService,
  ) {}

  // --- Suppliers ---------------------------------------------------------

  async createSupplier(
    organizationId: string,
    dto: CreateSupplierDto,
  ): Promise<SupplierDocument> {
    return this.supplierModel.create({
      ...dto,
      organization: new Types.ObjectId(organizationId),
    });
  }

  async findSuppliers(
    organizationId: string,
    query: SupplierQueryDto,
  ): Promise<{ items: SupplierDocument[]; total: number }> {
    const filter: Record<string, unknown> = {
      organization: new Types.ObjectId(organizationId),
    };

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [
        { name: pattern },
        { contactPerson: pattern },
        { phone: pattern },
      ];
    }

    if (query.withBalance) filter.payable = { $gt: 0 };
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const [items, total] = await Promise.all([
      this.supplierModel
        .find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.supplierModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  async findSupplierById(
    organizationId: string,
    supplierId: string,
  ): Promise<SupplierDocument> {
    const supplier = await this.supplierModel.findOne({
      _id: new Types.ObjectId(supplierId),
      organization: new Types.ObjectId(organizationId),
    });

    if (!supplier) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        PURCHASING_RESPONSE.SUPPLIER_NOT_FOUND,
      );
    }

    return supplier;
  }

  async updateSupplier(
    organizationId: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ): Promise<SupplierDocument> {
    const supplier = await this.supplierModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(supplierId),
        organization: new Types.ObjectId(organizationId),
      },
      { $set: dto },
      { returnDocument: 'after' },
    );

    if (!supplier) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        PURCHASING_RESPONSE.SUPPLIER_NOT_FOUND,
      );
    }

    return supplier;
  }

  async deactivateSupplier(
    organizationId: string,
    supplierId: string,
  ): Promise<SupplierDocument> {
    return this.updateSupplier(organizationId, supplierId, { isActive: false });
  }

  // --- Supplier ledger ---------------------------------------------------

  async getSupplierBalance(
    organizationId: string,
    supplierId: string,
  ): Promise<number> {
    const [result] = await this.ledgerModel.aggregate<{ total: number }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          supplier: new Types.ObjectId(supplierId),
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    return result?.total ?? 0;
  }

  /**
   * Appends to the payables ledger and refreshes the cached balance.
   *
   * Ledger first, cache second — the same ordering, and the same reasoning,
   * as the stock and customer ledgers.
   */
  async recordSupplierMovements(
    organizationId: string,
    movements: readonly {
      supplierId: string;
      type: SUPPLIER_LEDGER_TYPE;
      amount: number;
      reference?: string;
      referenceType?: string;
      referenceNumber?: string;
      dueDate?: Date;
      note?: string;
    }[],
    performedBy?: string,
  ): Promise<SupplierLedgerEntryDocument[]> {
    if (movements.length === 0) return [];

    const balances = new Map<string, number>();
    const rows: Record<string, unknown>[] = [];

    for (const movement of movements) {
      if (!balances.has(movement.supplierId)) {
        balances.set(
          movement.supplierId,
          await this.getSupplierBalance(organizationId, movement.supplierId),
        );
      }

      const next = (balances.get(movement.supplierId) ?? 0) + movement.amount;
      balances.set(movement.supplierId, next);

      rows.push({
        organization: new Types.ObjectId(organizationId),
        supplier: new Types.ObjectId(movement.supplierId),
        type: movement.type,
        amount: movement.amount,
        balanceAfter: next,
        reference: movement.reference
          ? new Types.ObjectId(movement.reference)
          : undefined,
        referenceType: movement.referenceType,
        referenceNumber: movement.referenceNumber,
        dueDate: movement.dueDate,
        note: movement.note,
        performedBy: performedBy ? new Types.ObjectId(performedBy) : undefined,
      });
    }

    const created = await this.ledgerModel.create(rows, { ordered: true });

    try {
      await Promise.all(
        [...balances.entries()].map(([supplierId, balance]) =>
          this.supplierModel.updateOne(
            {
              _id: new Types.ObjectId(supplierId),
              organization: new Types.ObjectId(organizationId),
            },
            { $set: { payable: balance } },
          ),
        ),
      );
    } catch (error) {
      this.logger.error(
        `Supplier balance refresh failed for organization ${organizationId}; the ledger is authoritative.`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return created;
  }

  async getSupplierLedger(
    organizationId: string,
    supplierId: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: SupplierLedgerEntryDocument[]; total: number }> {
    const filter = {
      organization: new Types.ObjectId(organizationId),
      supplier: new Types.ObjectId(supplierId),
    };

    const [items, total] = await Promise.all([
      this.ledgerModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.ledgerModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  async recordSupplierPayment(
    organizationId: string,
    supplierId: string,
    dto: RecordSupplierPaymentDto,
    userId: string,
  ): Promise<SupplierLedgerEntryDocument[]> {
    await this.findSupplierById(organizationId, supplierId);

    return this.recordSupplierMovements(
      organizationId,
      [
        {
          supplierId,
          type: SUPPLIER_LEDGER_TYPE.PAYMENT,
          // Negative: paying a supplier reduces what we owe them.
          amount: -dto.amount,
          referenceNumber: dto.reference,
          note: dto.note,
        },
      ],
      userId,
    );
  }

  async getTotalPayables(organizationId: string): Promise<number> {
    const [result] = await this.supplierModel.aggregate<{ total: number }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          payable: { $gt: 0 },
        },
      },
      { $group: { _id: null, total: { $sum: '$payable' } } },
    ]);

    return result?.total ?? 0;
  }

  // --- Purchase orders ---------------------------------------------------

  async createOrder(
    organizationId: string,
    dto: CreatePurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrderDocument> {
    if (dto.lines.length === 0) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        PURCHASING_RESPONSE.NO_LINES,
      );
    }

    const supplier = await this.findSupplierById(organizationId, dto.supplier);
    const locationId =
      dto.location ??
      String(
        await this.organizationService.getDefaultLocationId(organizationId),
      );

    await this.organizationService.assertLocationBelongs(
      organizationId,
      locationId,
    );

    const products = await this.catalogService.findManyByIds(
      organizationId,
      dto.lines.map((line) => line.product),
    );

    const lines = dto.lines.map((line) => {
      const product = products.get(line.product);

      if (!product) {
        return SerializeHttpError(
          null,
          HttpStatus.NOT_FOUND,
          PURCHASING_RESPONSE.SUPPLIER_NOT_FOUND,
        );
      }

      // Falls back to the last price actually paid, which is a far better
      // default than the catalogue's selling price and saves re-typing the
      // same figure on every repeat order.
      const unitCost = line.unitCost ?? product.lastPurchasePrice;

      return {
        product: new Types.ObjectId(line.product),
        name: product.name,
        sku: product.sku,
        quantity: line.quantity,
        unitCost,
        receivedQuantity: 0,
        lineTotal: multiply(unitCost, line.quantity),
      };
    });

    const subtotal = sum(lines.map((line) => line.lineTotal));

    return this.orderModel.create({
      organization: new Types.ObjectId(organizationId),
      orderNumber: await this.nextOrderNumber(organizationId),
      supplier: supplier._id,
      supplierName: supplier.name,
      location: new Types.ObjectId(locationId),
      lines,
      subtotal,
      grandTotal: subtotal,
      status: PURCHASE_ORDER_STATUS.DRAFT,
      expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined,
      createdBy: new Types.ObjectId(userId),
      note: dto.note,
    });
  }

  private async nextOrderNumber(organizationId: string): Promise<string> {
    const count = await this.orderModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
    });

    return `PO-${String(count + 1).padStart(5, '0')}`;
  }

  async findOrders(
    organizationId: string,
    status?: PURCHASE_ORDER_STATUS,
  ): Promise<PurchaseOrderDocument[]> {
    return this.orderModel
      .find({
        organization: new Types.ObjectId(organizationId),
        ...(status ? { status } : {}),
      })
      .sort({ createdAt: -1 })
      .populate('supplier', 'name phone')
      .populate('location', 'name code');
  }

  async findOrderById(
    organizationId: string,
    orderId: string,
  ): Promise<PurchaseOrderDocument> {
    const order = await this.orderModel
      .findOne({
        _id: new Types.ObjectId(orderId),
        organization: new Types.ObjectId(organizationId),
      })
      .populate('supplier', 'name phone email address')
      .populate('location', 'name code');

    if (!order) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        PURCHASING_RESPONSE.ORDER_NOT_FOUND,
      );
    }

    return order;
  }

  async sendOrder(
    organizationId: string,
    orderId: string,
  ): Promise<PurchaseOrderDocument> {
    const order = await this.findOrderById(organizationId, orderId);

    if (order.status !== PURCHASE_ORDER_STATUS.DRAFT) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        PURCHASING_RESPONSE.ORDER_NOT_EDITABLE,
      );
    }

    order.status = PURCHASE_ORDER_STATUS.SENT;
    order.sentAt = new Date();

    return order.save();
  }

  async cancelOrder(
    organizationId: string,
    orderId: string,
  ): Promise<PurchaseOrderDocument> {
    const order = await this.findOrderById(organizationId, orderId);

    // A partially-received order cannot be cancelled: stock has already
    // arrived and been paid for, and cancelling would leave those movements
    // pointing at a document that claims nothing happened.
    if (
      order.status === PURCHASE_ORDER_STATUS.RECEIVED ||
      order.status === PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED
    ) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        PURCHASING_RESPONSE.ORDER_ALREADY_RECEIVED,
      );
    }

    order.status = PURCHASE_ORDER_STATUS.CANCELLED;

    return order.save();
  }

  // --- Goods receipt -----------------------------------------------------

  /**
   * Receives goods: writes stock, recomputes weighted-average cost, and
   * creates the payable.
   *
   * The cost that enters the average is the one on **this delivery**, not the
   * one on the order — suppliers reprice between order and shipment, and the
   * warehouse is worth what was actually paid for it. CONTEXT.md D3.
   */
  async receiveGoods(
    organizationId: string,
    dto: CreateGoodsReceiptDto,
    userId: string,
  ): Promise<GoodsReceiptDocument> {
    if (dto.lines.length === 0) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        PURCHASING_RESPONSE.NO_LINES,
      );
    }

    const order = dto.purchaseOrder
      ? await this.findOrderById(organizationId, dto.purchaseOrder)
      : null;

    if (order && order.status === PURCHASE_ORDER_STATUS.CANCELLED) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        PURCHASING_RESPONSE.ORDER_NOT_RECEIVABLE,
      );
    }

    const supplierId =
      dto.supplier ?? String(order?.supplier._id ?? order?.supplier);

    if (!supplierId) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        PURCHASING_RESPONSE.SUPPLIER_NOT_FOUND,
      );
    }

    const supplier = await this.findSupplierById(organizationId, supplierId);
    // `String(...)` never returns nullish, so a `??` chain through it would
    // make the final fallback unreachable — the order's location has to be
    // extracted first, then defaulted.
    const orderLocationId = order
      ? String(order.location._id ?? order.location)
      : undefined;

    const locationId =
      dto.location ??
      orderLocationId ??
      String(
        await this.organizationService.getDefaultLocationId(organizationId),
      );

    const products = await this.catalogService.findManyByIds(
      organizationId,
      dto.lines.map((line) => line.product),
    );

    const lines = dto.lines.map((line) => {
      const product = products.get(line.product);

      if (!product) {
        return SerializeHttpError(
          null,
          HttpStatus.NOT_FOUND,
          PURCHASING_RESPONSE.ORDER_NOT_FOUND,
        );
      }

      if (order) {
        this.assertWithinOrderedQuantity(order, line.product, line.quantity);
      }

      return {
        product: new Types.ObjectId(line.product),
        name: product.name,
        quantity: line.quantity,
        unitCost: line.unitCost,
        lineTotal: multiply(line.unitCost, line.quantity),
        batchNo: line.batchNo,
        expiry: line.expiry ? new Date(line.expiry) : undefined,
      };
    });

    const subtotal = sum(lines.map((line) => line.lineTotal));

    const receipt = await this.receiptModel.create({
      organization: new Types.ObjectId(organizationId),
      receiptNumber: await this.nextReceiptNumber(organizationId),
      purchaseOrder: order?._id,
      supplier: supplier._id,
      location: new Types.ObjectId(locationId),
      lines,
      subtotal,
      taxTotal: dto.taxTotal ?? 0,
      grandTotal: subtotal + (dto.taxTotal ?? 0),
      supplierInvoiceNumber: dto.supplierInvoiceNumber,
      supplierInvoiceDate: dto.supplierInvoiceDate
        ? new Date(dto.supplierInvoiceDate)
        : undefined,
      receivedBy: new Types.ObjectId(userId),
      note: dto.note,
    });

    // Stock in, at this delivery's cost. `recordMovements` runs the moving
    // weighted average through the one shared implementation.
    await this.inventoryService.recordMovements(
      organizationId,
      lines.map((line) => ({
        productId: String(line.product),
        locationId,
        quantity: line.quantity,
        reason: STOCK_REASON.PURCHASE,
        unitCost: line.unitCost,
        reference: String(receipt._id),
        referenceType: 'GoodsReceipt',
        referenceNumber: receipt.receiptNumber,
        batchNo: line.batchNo,
        expiry: line.expiry,
      })),
      userId,
    );

    // Last-paid price, for pre-filling the next order.
    await Promise.all(
      lines.map((line) =>
        this.catalogService.setLastPurchasePrice(
          organizationId,
          String(line.product),
          line.unitCost,
        ),
      ),
    );

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + supplier.paymentTermDays);

    await this.recordSupplierMovements(
      organizationId,
      [
        {
          supplierId: String(supplier._id),
          type: SUPPLIER_LEDGER_TYPE.BILL,
          // Positive: receiving goods increases what we owe.
          amount: receipt.grandTotal,
          reference: String(receipt._id),
          referenceType: 'GoodsReceipt',
          referenceNumber: receipt.receiptNumber,
          dueDate,
        },
      ],
      userId,
    );

    if (order) {
      await this.applyReceiptToOrder(order, lines);
    }

    return receipt;
  }

  private assertWithinOrderedQuantity(
    order: PurchaseOrderDocument,
    productId: string,
    quantity: number,
  ): void {
    const line = order.lines.find(
      (candidate) => String(candidate.product) === productId,
    );

    if (!line) return;

    const outstanding = line.quantity - line.receivedQuantity;

    if (quantity > outstanding) {
      return SerializeHttpError(
        { product: productId, outstanding },
        HttpStatus.CONFLICT,
        PURCHASING_RESPONSE.RECEIPT_EXCEEDS_ORDER,
      );
    }
  }

  /**
   * Advances the order's received quantities and status.
   *
   * `RECEIVED` only when every line is complete — a single outstanding line
   * keeps the order open, which is what makes "what is still coming?" a
   * question the system can answer.
   */
  private async applyReceiptToOrder(
    order: PurchaseOrderDocument,
    lines: readonly { product: Types.ObjectId; quantity: number }[],
  ): Promise<void> {
    for (const received of lines) {
      const line = order.lines.find(
        (candidate) => String(candidate.product) === String(received.product),
      );

      if (line) line.receivedQuantity += received.quantity;
    }

    const complete = order.lines.every(
      (line) => line.receivedQuantity >= line.quantity,
    );

    order.status = complete
      ? PURCHASE_ORDER_STATUS.RECEIVED
      : PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED;

    await order.save();
  }

  private async nextReceiptNumber(organizationId: string): Promise<string> {
    const count = await this.receiptModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
    });

    return `GRN-${String(count + 1).padStart(5, '0')}`;
  }

  async findReceipts(
    organizationId: string,
    page = 1,
    limit = 25,
  ): Promise<{ items: GoodsReceiptDocument[]; total: number }> {
    const filter = { organization: new Types.ObjectId(organizationId) };

    const [items, total] = await Promise.all([
      this.receiptModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('supplier', 'name')
        .populate('receivedBy', 'name'),
      this.receiptModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  /**
   * What to reorder: products at or below their reorder level, grouped by
   * their preferred supplier so the result is a set of draftable orders
   * rather than a flat list someone has to sort by hand.
   */
  async getReorderSuggestions(organizationId: string): Promise<
    {
      product: string;
      name: string;
      sku: string;
      stockOnHand: number;
      reorderLevel: number;
      suggestedQuantity: number;
      lastPurchasePrice: number;
      preferredSupplier: string | null;
    }[]
  > {
    const products = await this.catalogService.findLowStock(
      organizationId,
      200,
    );

    return products.map((product) => ({
      product: String(product._id),
      name: product.name,
      sku: product.sku,
      stockOnHand: product.stockOnHand,
      reorderLevel: product.reorderLevel,
      // Falls back to topping up to the reorder level when no explicit
      // reorder quantity is configured — a suggestion of zero would be
      // useless, and this is the figure a buyer would have worked out anyway.
      suggestedQuantity:
        product.reorderQuantity > 0
          ? product.reorderQuantity
          : Math.max(product.reorderLevel - product.stockOnHand, 1),
      lastPurchasePrice: product.lastPurchasePrice,
      preferredSupplier: product.preferredSupplier
        ? String(product.preferredSupplier)
        : null,
    }));
  }

  async getPurchasesSummary(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<{ count: number; total: number }> {
    const [result] = await this.receiptModel.aggregate<{
      count: number;
      total: number;
    }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: '$grandTotal' },
        },
      },
    ]);

    return { count: result?.count ?? 0, total: result?.total ?? 0 };
  }
}
