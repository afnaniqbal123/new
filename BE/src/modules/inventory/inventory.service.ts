import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  StockLedgerEntry,
  StockLedgerEntryDocument,
} from 'src/modules/inventory/stock-ledger.schema';
import {
  INBOUND_REASONS,
  STOCK_REASON,
} from 'src/modules/inventory/constants/inventory.constant';
import { INVENTORY_RESPONSE } from 'src/modules/inventory/constants/api-response/inventory.response';
import { SerializeHttpError } from 'src/utils/serializer';
import { movingAverageCost } from 'src/utils/money';
import { CatalogService } from 'src/modules/catalog/catalog.service';
import { OrganizationService } from 'src/modules/organization/organization.service';

/**
 * One requested stock movement, before it is written.
 *
 * `quantity` is signed the same way the ledger row is — the caller states the
 * direction, and this service does not infer it from the reason. Inferring
 * would mean two places encode the same rule and can disagree.
 */
export interface StockMovementRequest {
  productId: string;
  locationId: string;
  quantity: number;
  reason: STOCK_REASON;
  /** Required for inbound movements; ignored for outbound, which use the WAC. */
  unitCost?: number;
  reference?: string;
  referenceType?: string;
  referenceNumber?: string;
  batchNo?: string;
  expiry?: Date;
  note?: string;
}

export interface StockAvailability {
  productId: string;
  productName: string;
  available: number;
  requested: number;
  sufficient: boolean;
}

/**
 * Owns the stock ledger: the append-only record of every movement, and the
 * derived numbers everything else reads.
 *
 * ## Why there is no transaction around a movement
 *
 * Writing the ledger row and updating `Product.stockOnHand` are two writes,
 * and they are deliberately *not* wrapped in a transaction. The ledger is the
 * truth (CONTEXT.md D2); the product field is a cache of it. Ordering the
 * writes ledger-first means the worst outcome of a crash between them is a
 * stale cache — which `recalculateStock` repairs from the ledger, and the
 * reconciliation job repairs unattended.
 *
 * The alternative would require MongoDB transactions, which need a replica
 * set, which would make a single-node local database unable to run the
 * application at all. An architecture that is correct without transactions is
 * worth more here than one that is correct only with them.
 *
 * A caller that *does* have a session (a sale, which must also write a
 * customer ledger row atomically) can pass one, and these writes join it.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectModel(StockLedgerEntry.name)
    private readonly ledgerModel: Model<StockLedgerEntryDocument>,
    private readonly catalogService: CatalogService,
    private readonly organizationService: OrganizationService,
  ) {}

  /**
   * The location a movement lands in when the request names none.
   *
   * Re-exposed here so the controller has one collaborator rather than two —
   * every other inventory operation already goes through this service, and a
   * controller reaching into OrganizationService for one id would be the only
   * exception.
   */
  async resolveDefaultLocation(
    organizationId: string,
  ): Promise<Types.ObjectId> {
    return this.organizationService.getDefaultLocationId(organizationId);
  }

  /**
   * Current stock for one product at one location, read from the ledger.
   *
   * Deliberately not `Product.stockOnHand`. This is the number that decides
   * whether a sale may complete, and that decision must come from the truth,
   * not from a cache that a crashed process may have left stale.
   */
  async getAvailable(
    organizationId: string,
    productId: string,
    locationId: string,
  ): Promise<number> {
    const [result] = await this.ledgerModel.aggregate<{ total: number }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          product: new Types.ObjectId(productId),
          location: new Types.ObjectId(locationId),
        },
      },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);

    return result?.total ?? 0;
  }

  /**
   * Stock for many products at one location, in a single aggregation.
   *
   * Used by the sale path, which needs every line checked before any of them
   * is written — one query rather than N, because a ten-line invoice issuing
   * ten round trips is what makes a POS feel slow.
   */
  async getAvailableMany(
    organizationId: string,
    productIds: readonly string[],
    locationId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.ledgerModel.aggregate<{
      _id: Types.ObjectId;
      total: number;
    }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          product: { $in: productIds.map((id) => new Types.ObjectId(id)) },
          location: new Types.ObjectId(locationId),
        },
      },
      { $group: { _id: '$product', total: { $sum: '$quantity' } } },
    ]);

    const available = new Map<string, number>();

    for (const productId of productIds) {
      available.set(productId, 0);
    }

    for (const row of rows) {
      available.set(String(row._id), row.total);
    }

    return available;
  }

  /**
   * Checks whether every requested line can be satisfied.
   *
   * Returns the full picture rather than throwing on the first shortfall: a
   * cashier needs to be told about all three unavailable items at once, not
   * made to discover them one failed submission at a time.
   *
   * Products with `trackStock: false` (delivery charges, services) are always
   * sufficient — they are sold but never counted.
   */
  async checkAvailability(
    organizationId: string,
    locationId: string,
    lines: readonly { productId: string; quantity: number }[],
  ): Promise<StockAvailability[]> {
    const productIds = lines.map((line) => line.productId);
    const products = await this.catalogService.findManyByIds(
      organizationId,
      productIds,
    );
    const available = await this.getAvailableMany(
      organizationId,
      productIds,
      locationId,
    );

    return lines.map((line) => {
      const product = products.get(line.productId);
      const stock = available.get(line.productId) ?? 0;
      const tracked = product?.trackStock ?? true;

      return {
        productId: line.productId,
        productName: product?.name ?? '',
        available: stock,
        requested: line.quantity,
        sufficient: !tracked || stock >= line.quantity,
      };
    });
  }

  /**
   * Refuses the whole operation unless every line is satisfiable.
   *
   * Honours the Organization's `allowNegativeStock` setting: a business that
   * genuinely sells ahead of receipt turns it on deliberately, and everyone
   * else is protected from selling what they do not have. Invariant #1.
   */
  async assertSufficientStock(
    organizationId: string,
    locationId: string,
    lines: readonly { productId: string; quantity: number }[],
  ): Promise<void> {
    const settings = await this.organizationService.getSettings(organizationId);

    if (settings.allowNegativeStock) return;

    const availability = await this.checkAvailability(
      organizationId,
      locationId,
      lines,
    );
    const short = availability.filter((line) => !line.sufficient);

    if (short.length === 0) return;

    return SerializeHttpError(
      short,
      HttpStatus.CONFLICT,
      INVENTORY_RESPONSE.INSUFFICIENT_STOCK,
    );
  }

  /**
   * Records a manual adjustment, refusing one that would drive stock negative.
   *
   * Sales (`sales.service.ts`) and transfers (`stock-transfer.service.ts`)
   * both call `assertSufficientStock` before they move anything; this path did
   * not, so a write-off larger than the quantity on hand wrote an impossible
   * balance straight into the ledger. A physical count may correct a figure in
   * either direction, but no warehouse holds -29 cartons — the invariant is
   * about the balance, not about which document caused the movement.
   * Invariant #1.
   *
   * Only outbound lines are checked: an inbound correction (opening stock, a
   * carton found behind a pallet) can never breach it. The check honours
   * `allowNegativeStock` exactly like the other two callers, because a
   * business that genuinely sells ahead of receipt turned it on deliberately.
   */
  async recordAdjustment(
    organizationId: string,
    locationId: string,
    movements: readonly StockMovementRequest[],
    performedBy?: string,
  ): Promise<StockLedgerEntryDocument[]> {
    const outbound = movements
      .filter((movement) => movement.quantity < 0)
      .map((movement) => ({
        productId: movement.productId,
        // `assertSufficientStock` speaks in positive quantities required.
        quantity: -movement.quantity,
      }));

    if (outbound.length > 0) {
      await this.assertSufficientStock(organizationId, locationId, outbound);
    }

    return this.recordMovements(organizationId, movements, performedBy);
  }

  /**
   * Writes movements to the ledger and refreshes the cached projections.
   *
   * The whole batch is written before any product cache is touched, so a
   * partial failure leaves the ledger — the truth — internally consistent.
   *
   * Inbound movements recompute the product's moving weighted-average cost
   * through the one shared implementation in `money.ts`; outbound movements
   * are stamped with the current average, which is what makes historical
   * margin computable. CONTEXT.md D3.
   */
  async recordMovements(
    organizationId: string,
    movements: readonly StockMovementRequest[],
    performedBy?: string,
    session?: ClientSession,
  ): Promise<StockLedgerEntryDocument[]> {
    if (movements.length === 0) return [];

    const productIds = [...new Set(movements.map((m) => m.productId))];
    const products = await this.catalogService.findManyByIds(
      organizationId,
      productIds,
    );

    // Running balances are tracked per (product, location) across the batch so
    // that two lines touching the same product in one sale record the correct
    // sequential balances rather than both reporting the pre-batch figure.
    const balances = new Map<string, number>();
    const costs = new Map<string, number>();
    const rows: Record<string, unknown>[] = [];

    for (const movement of movements) {
      const product = products.get(movement.productId);

      if (!product) {
        return SerializeHttpError(
          null,
          HttpStatus.NOT_FOUND,
          INVENTORY_RESPONSE.PRODUCT_NOT_FOUND,
        );
      }

      const key = `${movement.productId}:${movement.locationId}`;

      if (!balances.has(key)) {
        balances.set(
          key,
          await this.getAvailable(
            organizationId,
            movement.productId,
            movement.locationId,
          ),
        );
      }

      if (!costs.has(movement.productId)) {
        costs.set(movement.productId, product.averageCost);
      }

      const previousBalance = balances.get(key) ?? 0;
      const previousCost = costs.get(movement.productId) ?? 0;
      const isInbound = INBOUND_REASONS.includes(movement.reason);

      // Outbound movements carry the current average cost, not a caller-
      // supplied one: what leaving stock "cost" is a property of the stock,
      // not of the transaction taking it out.
      const unitCost = isInbound
        ? (movement.unitCost ?? previousCost)
        : previousCost;

      const nextBalance = previousBalance + movement.quantity;
      balances.set(key, nextBalance);

      if (isInbound && movement.quantity > 0) {
        costs.set(
          movement.productId,
          movingAverageCost(
            previousBalance,
            previousCost,
            movement.quantity,
            unitCost,
          ),
        );
      }

      rows.push({
        organization: new Types.ObjectId(organizationId),
        product: new Types.ObjectId(movement.productId),
        location: new Types.ObjectId(movement.locationId),
        quantity: movement.quantity,
        unitCost,
        balanceAfter: nextBalance,
        reason: movement.reason,
        reference: movement.reference
          ? new Types.ObjectId(movement.reference)
          : undefined,
        referenceType: movement.referenceType,
        referenceNumber: movement.referenceNumber,
        batchNo: movement.batchNo,
        expiry: movement.expiry,
        note: movement.note,
        performedBy: performedBy ? new Types.ObjectId(performedBy) : undefined,
      });
    }

    const created = await this.ledgerModel.create(rows, {
      session,
      // `create` with an array and `ordered: true` stops at the first failure,
      // which is what we want: a half-written batch of movements is easier to
      // reason about than an arbitrary subset.
      ordered: true,
    });

    await this.refreshProjections(organizationId, movements, costs, session);

    return created;
  }

  /**
   * Updates the cached `stockOnHand` and `averageCost` on affected products.
   *
   * Failures here are logged, not thrown. The ledger rows are already
   * committed and are the truth; refusing the whole operation because a cache
   * write failed would reject a sale that has, in every sense that matters,
   * already happened. `recalculateStock` repairs the difference.
   */
  private async refreshProjections(
    organizationId: string,
    movements: readonly StockMovementRequest[],
    costs: ReadonlyMap<string, number>,
    session?: ClientSession,
  ): Promise<void> {
    const deltas = new Map<string, number>();

    for (const movement of movements) {
      deltas.set(
        movement.productId,
        (deltas.get(movement.productId) ?? 0) + movement.quantity,
      );
    }

    try {
      await Promise.all(
        [...deltas.entries()].map(([productId, delta]) =>
          this.catalogService.applyStockDelta(
            organizationId,
            productId,
            delta,
            costs.get(productId),
            session,
          ),
        ),
      );
    } catch (error) {
      this.logger.error(
        `Stock projection refresh failed for organization ${organizationId}; the ledger is authoritative and recalculateStock will repair it.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Rebuilds a product's cached stock from the ledger.
   *
   * The repair path for the projection, and the reason the two-write design
   * above is safe. Runs per product so it can be used both by the
   * reconciliation job and by a support request about one specific item.
   */
  async recalculateStock(
    organizationId: string,
    productId: string,
  ): Promise<number> {
    const [result] = await this.ledgerModel.aggregate<{ total: number }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          product: new Types.ObjectId(productId),
        },
      },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);

    const total = result?.total ?? 0;

    await this.catalogService.setStockOnHand(organizationId, productId, total);

    return total;
  }

  /**
   * Per-location breakdown for one product, for the stock detail screen.
   */
  async getStockByLocation(
    organizationId: string,
    productId: string,
  ): Promise<{ location: Types.ObjectId; quantity: number }[]> {
    return this.ledgerModel.aggregate<{
      location: Types.ObjectId;
      quantity: number;
    }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          product: new Types.ObjectId(productId),
        },
      },
      { $group: { _id: '$location', quantity: { $sum: '$quantity' } } },
      { $project: { _id: 0, location: '$_id', quantity: 1 } },
    ]);
  }

  /**
   * The movement history for one product — the "why is the stock this?"
   * answer that the whole append-only design exists to make possible.
   */
  async getLedger(
    organizationId: string,
    filters: {
      productId?: string;
      locationId?: string;
      reason?: STOCK_REASON;
      from?: Date;
      to?: Date;
    },
    page = 1,
    limit = 50,
  ): Promise<{ items: StockLedgerEntryDocument[]; total: number }> {
    const query: Record<string, unknown> = {
      organization: new Types.ObjectId(organizationId),
    };

    if (filters.productId)
      query.product = new Types.ObjectId(filters.productId);
    if (filters.locationId)
      query.location = new Types.ObjectId(filters.locationId);
    if (filters.reason) query.reason = filters.reason;

    if (filters.from || filters.to) {
      query.createdAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.ledgerModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('product', 'name sku unit')
        .populate('location', 'name code')
        .populate('performedBy', 'name'),
      this.ledgerModel.countDocuments(query),
    ]);

    return { items, total };
  }

  /**
   * Reverses the movements a document caused, by writing opposite rows.
   *
   * Never deletes the originals. A cancelled sale that leaves no trace is
   * indistinguishable from one that never happened, and "why did stock go up
   * on Tuesday?" must always have an answer. Invariant #3.
   */
  async reverseMovementsFor(
    organizationId: string,
    referenceId: string,
    reason: STOCK_REASON,
    performedBy?: string,
    note?: string,
  ): Promise<StockLedgerEntryDocument[]> {
    const original = await this.ledgerModel.find({
      organization: new Types.ObjectId(organizationId),
      reference: new Types.ObjectId(referenceId),
    });

    if (original.length === 0) return [];

    return this.recordMovements(
      organizationId,
      original.map((row) => ({
        productId: String(row.product),
        locationId: String(row.location),
        quantity: -row.quantity,
        reason,
        unitCost: row.unitCost,
        reference: referenceId,
        referenceType: row.referenceType,
        referenceNumber: row.referenceNumber,
        batchNo: row.batchNo,
        expiry: row.expiry,
        note,
      })),
      performedBy,
    );
  }

  /**
   * Batch-tracked stock approaching or past expiry.
   *
   * Only rows with a positive remaining balance matter, so this sums by batch
   * rather than listing movements — a batch that was fully sold is not a
   * write-off risk, however old it is.
   */
  async getExpiringBatches(
    organizationId: string,
    withinDays: number,
  ): Promise<
    {
      product: Types.ObjectId;
      batchNo: string;
      expiry: Date;
      quantity: number;
    }[]
  > {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);

    return this.ledgerModel.aggregate([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          batchNo: { $nin: [null, ''] },
          expiry: { $ne: null, $lte: cutoff },
        },
      },
      {
        $group: {
          _id: { product: '$product', batchNo: '$batchNo', expiry: '$expiry' },
          quantity: { $sum: '$quantity' },
        },
      },
      { $match: { quantity: { $gt: 0 } } },
      {
        $project: {
          _id: 0,
          product: '$_id.product',
          batchNo: '$_id.batchNo',
          expiry: '$_id.expiry',
          quantity: 1,
        },
      },
      { $sort: { expiry: 1 } },
    ]);
  }

  /**
   * Total value of stock on hand, at weighted-average cost.
   *
   * Computed from the product cache rather than the ledger: this is a
   * dashboard figure over the whole catalogue, and a full ledger scan for it
   * would be the most expensive query in the application.
   */
  async getStockValue(organizationId: string): Promise<number> {
    return this.catalogService.getStockValue(organizationId);
  }
}
