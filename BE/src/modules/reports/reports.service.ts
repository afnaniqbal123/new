import { HttpStatus, Injectable } from '@nestjs/common';
import { REPORTS_RESPONSE } from 'src/modules/reports/constants/api-response/reports.response';
import {
  REPORT_KIND,
  REPORT_PERIOD,
} from 'src/modules/reports/constants/reports.constant';
import {
  ResolvedPeriod,
  resolvePeriod,
} from 'src/modules/reports/report-period.util';
import { SerializeHttpError } from 'src/utils/serializer';
import { SalesService } from 'src/modules/sales/sales.service';
import { SaleReturnService } from 'src/modules/sales/sale-return.service';
import { CatalogService } from 'src/modules/catalog/catalog.service';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { CustomerService } from 'src/modules/customer/customer.service';
import { AGING_BUCKET } from 'src/modules/customer/constants/customer.constant';
import { PurchasingService } from 'src/modules/purchasing/purchasing.service';
import { OrganizationService } from 'src/modules/organization/organization.service';

/** Every report returns this envelope, so one renderer handles all of them. */
export interface ReportResult {
  kind: REPORT_KIND;
  period: { from: string; to: string; label: string };
  currency: string;
  /** The headline figures, already computed. Never estimated. */
  summary: Record<string, number>;
  /** Row data, when the report has rows. */
  rows: Record<string, unknown>[];
}

/**
 * Produces every number the product reports.
 *
 * ## Why this module exists at all
 *
 * It owns no collection. Every figure here comes from the module that owns
 * the underlying data — sales from `SalesService`, stock from
 * `InventoryService`, and so on. What it adds is the *composition*: a profit
 * figure needs sales, returns, and cost together, and putting that arithmetic
 * in any one of those modules would make it the odd one out.
 *
 * ## Why the report list is a closed enum
 *
 * `REPORT_KIND` is also the AI clerk's tool surface. The model chooses which
 * report to run and with which arguments; **this code does the arithmetic**.
 * That is the deterministic boundary in CONTEXT.md D9 made concrete: there is
 * no path by which a language model produces a number a user sees.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly salesService: SalesService,
    private readonly returnService: SaleReturnService,
    private readonly catalogService: CatalogService,
    private readonly inventoryService: InventoryService,
    private readonly customerService: CustomerService,
    private readonly purchasingService: PurchasingService,
    private readonly organizationService: OrganizationService,
  ) {}

  /**
   * The single screen an owner opens in the morning.
   *
   * Deliberately one round trip: six separate endpoints would render six
   * loading spinners, and the owner's question is "how is the business?", not
   * six unrelated questions.
   */
  async getDashboard(organizationId: string): Promise<{
    today: {
      revenue: number;
      count: number;
      profit: number;
      collected: number;
    };
    month: { revenue: number; count: number; profit: number };
    receivables: number;
    payables: number;
    stockValue: number;
    lowStockCount: number;
    currency: string;
    lowStock: {
      id: string;
      name: string;
      sku: string;
      stockOnHand: number;
      reorderLevel: number;
    }[];
    recentSales: unknown[];
    salesByDay: {
      date: string;
      revenue: number;
      cost: number;
      count: number;
    }[];
  }> {
    const settings = await this.organizationService.getSettings(organizationId);
    const today = resolvePeriod(REPORT_PERIOD.TODAY, settings.timezone);
    const month = resolvePeriod(REPORT_PERIOD.THIS_MONTH, settings.timezone);
    const last30 = resolvePeriod(REPORT_PERIOD.LAST_30_DAYS, settings.timezone);

    const [
      todaySummary,
      monthSummary,
      receivables,
      payables,
      stockValue,
      lowStock,
      recentSales,
      salesByDay,
    ] = await Promise.all([
      this.salesService.getSalesSummary(organizationId, today.from, today.to),
      this.salesService.getSalesSummary(organizationId, month.from, month.to),
      this.customerService.getTotalReceivables(organizationId),
      this.purchasingService.getTotalPayables(organizationId),
      this.inventoryService.getStockValue(organizationId),
      this.catalogService.findLowStock(organizationId, 10),
      this.salesService.findAll(organizationId, { limit: 8, page: 1 }),
      this.salesService.getSalesByDay(
        organizationId,
        last30.from,
        last30.to,
        settings.timezone,
      ),
    ]);

    return {
      today: {
        revenue: todaySummary.revenue,
        count: todaySummary.count,
        profit: todaySummary.profit,
        collected: todaySummary.collected,
      },
      month: {
        revenue: monthSummary.revenue,
        count: monthSummary.count,
        profit: monthSummary.profit,
      },
      receivables,
      payables,
      stockValue,
      lowStockCount: lowStock.length,
      currency: settings.currency,
      lowStock: lowStock.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stockOnHand: product.stockOnHand,
        reorderLevel: product.reorderLevel,
      })),
      recentSales: recentSales.items,
      salesByDay,
    };
  }

  /**
   * Runs a named report.
   *
   * The single entry point the AI clerk calls, and the same one the UI uses —
   * so a question answered in chat and the same question answered on a screen
   * produce identical numbers by construction.
   */
  async run(
    organizationId: string,
    kind: REPORT_KIND,
    period: REPORT_PERIOD = REPORT_PERIOD.THIS_MONTH,
    custom?: { from?: string; to?: string },
  ): Promise<ReportResult> {
    const settings = await this.organizationService.getSettings(organizationId);
    const resolved = resolvePeriod(period, settings.timezone, custom);

    const base = {
      kind,
      period: {
        from: resolved.from.toISOString(),
        to: resolved.to.toISOString(),
        label: resolved.label,
      },
      currency: settings.currency,
    };

    switch (kind) {
      case REPORT_KIND.SALES_SUMMARY:
        return {
          ...base,
          ...(await this.salesSummary(organizationId, resolved)),
        };

      case REPORT_KIND.SALES_BY_DAY:
        return {
          ...base,
          ...(await this.salesByDay(
            organizationId,
            resolved,
            settings.timezone,
          )),
        };

      case REPORT_KIND.TOP_PRODUCTS:
        return {
          ...base,
          ...(await this.topProducts(organizationId, resolved)),
        };

      case REPORT_KIND.TOP_CUSTOMERS:
        return {
          ...base,
          ...(await this.topCustomers(organizationId, resolved)),
        };

      case REPORT_KIND.PROFIT:
        return { ...base, ...(await this.profit(organizationId, resolved)) };

      case REPORT_KIND.RECEIVABLES_AGING:
        return { ...base, ...(await this.receivablesAging(organizationId)) };

      case REPORT_KIND.PAYABLES:
        return { ...base, ...(await this.payables(organizationId)) };

      case REPORT_KIND.LOW_STOCK:
        return { ...base, ...(await this.lowStock(organizationId)) };

      case REPORT_KIND.STOCK_VALUATION:
        return { ...base, ...(await this.stockValuation(organizationId)) };

      case REPORT_KIND.DEAD_STOCK:
        return { ...base, ...(await this.deadStock(organizationId, resolved)) };

      case REPORT_KIND.EXPIRING_STOCK:
        return { ...base, ...(await this.expiringStock(organizationId)) };

      case REPORT_KIND.PURCHASES_SUMMARY:
        return {
          ...base,
          ...(await this.purchasesSummary(organizationId, resolved)),
        };

      case REPORT_KIND.CASH_POSITION:
        return {
          ...base,
          ...(await this.cashPosition(organizationId, resolved)),
        };

      default:
        return SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          REPORTS_RESPONSE.UNKNOWN_REPORT,
        );
    }
  }

  private async salesSummary(organizationId: string, period: ResolvedPeriod) {
    const summary = await this.salesService.getSalesSummary(
      organizationId,
      period.from,
      period.to,
    );

    return {
      summary: {
        orders: summary.count,
        revenue: summary.revenue,
        collected: summary.collected,
        outstanding: summary.outstanding,
        averageOrderValue:
          summary.count > 0 ? Math.round(summary.revenue / summary.count) : 0,
      },
      rows: [],
    };
  }

  private async salesByDay(
    organizationId: string,
    period: ResolvedPeriod,
    timezone: string,
  ) {
    const rows = await this.salesService.getSalesByDay(
      organizationId,
      period.from,
      period.to,
      timezone,
    );

    return {
      summary: {
        days: rows.length,
        revenue: rows.reduce((total, row) => total + row.revenue, 0),
        orders: rows.reduce((total, row) => total + row.count, 0),
      },
      rows,
    };
  }

  private async topProducts(organizationId: string, period: ResolvedPeriod) {
    const rows = await this.salesService.getTopProducts(
      organizationId,
      period.from,
      period.to,
      20,
    );

    const revenue = rows.reduce((total, row) => total + row.revenue, 0);

    // The concentration figure the pitch calls out: how much of the business
    // the top ten lines actually carry.
    const topTenRevenue = rows
      .slice(0, 10)
      .reduce((total, row) => total + row.revenue, 0);

    return {
      summary: {
        products: rows.length,
        revenue,
        topTenRevenue,
        topTenSharePercent:
          revenue > 0 ? Math.round((topTenRevenue / revenue) * 100) : 0,
      },
      rows: rows as unknown as Record<string, unknown>[],
    };
  }

  private async topCustomers(organizationId: string, period: ResolvedPeriod) {
    const rows = await this.salesService.getTopCustomers(
      organizationId,
      period.from,
      period.to,
      20,
    );

    return {
      summary: {
        customers: rows.length,
        revenue: rows.reduce((total, row) => total + row.revenue, 0),
      },
      rows: rows as unknown as Record<string, unknown>[],
    };
  }

  /**
   * Gross profit, net of returns.
   *
   * Returns are subtracted from both revenue and cost — netting only the
   * revenue would inflate margin every time goods came back, which is exactly
   * when a business most wants an honest number.
   */
  private async profit(organizationId: string, period: ResolvedPeriod) {
    const [sales, returns] = await Promise.all([
      this.salesService.getSalesSummary(organizationId, period.from, period.to),
      this.returnService.getReturnsTotal(
        organizationId,
        period.from,
        period.to,
      ),
    ]);

    const revenue = sales.revenue - returns.amount;
    const cost = sales.cost - returns.cost;
    const profit = revenue - cost;

    return {
      summary: {
        grossRevenue: sales.revenue,
        returns: returns.amount,
        netRevenue: revenue,
        cost,
        profit,
        // Integer percent: a margin quoted to two decimals implies a
        // precision the underlying weighted-average cost does not have.
        marginPercent: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      },
      rows: [],
    };
  }

  private async receivablesAging(organizationId: string) {
    const buckets = await this.customerService.getAging(organizationId);
    const total = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
    const overdue = buckets
      .filter((bucket) => bucket.bucket !== AGING_BUCKET.CURRENT)
      .reduce((sum, bucket) => sum + bucket.amount, 0);

    return {
      summary: { total, overdue },
      rows: buckets as unknown as Record<string, unknown>[],
    };
  }

  private async payables(organizationId: string) {
    const total = await this.purchasingService.getTotalPayables(organizationId);
    const { items } = await this.purchasingService.findSuppliers(
      organizationId,
      { withBalance: true, limit: 100 },
    );

    return {
      summary: { total, suppliers: items.length },
      rows: items.map((supplier) => ({
        id: String(supplier._id),
        name: supplier.name,
        payable: supplier.payable,
        paymentTermDays: supplier.paymentTermDays,
      })),
    };
  }

  private async lowStock(organizationId: string) {
    const products = await this.catalogService.findLowStock(
      organizationId,
      200,
    );

    return {
      summary: {
        products: products.length,
        // What it would cost to bring everything back to its reorder level —
        // the number that turns a list into a purchasing decision.
        restockCost: products.reduce(
          (total, product) =>
            total +
            Math.max(product.reorderLevel - product.stockOnHand, 0) *
              product.lastPurchasePrice,
          0,
        ),
      },
      rows: products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stockOnHand: product.stockOnHand,
        reorderLevel: product.reorderLevel,
        reorderQuantity: product.reorderQuantity,
        lastPurchasePrice: product.lastPurchasePrice,
      })),
    };
  }

  private async stockValuation(organizationId: string) {
    const [value, count] = await Promise.all([
      this.inventoryService.getStockValue(organizationId),
      this.catalogService.countProducts(organizationId),
    ]);

    return { summary: { value, products: count }, rows: [] };
  }

  /**
   * Stock that has not moved at all in the period — cash sitting on a shelf.
   *
   * The other half of the phantom-inventory problem: overstock ties up money
   * as surely as a shortage loses a sale, and nothing else in the product
   * surfaces it.
   */
  private async deadStock(organizationId: string, period: ResolvedPeriod) {
    const sold = await this.salesService.getSoldProductIds(
      organizationId,
      period.from,
      period.to,
    );

    const { items } = await this.catalogService.findProducts(organizationId, {
      limit: 200,
      page: 1,
    });

    const dead = items.filter(
      (product) => product.stockOnHand > 0 && !sold.has(String(product._id)),
    );

    return {
      summary: {
        products: dead.length,
        tiedUpCapital: dead.reduce(
          (total, product) => total + product.stockOnHand * product.averageCost,
          0,
        ),
      },
      rows: dead.map((product) => ({
        id: String(product._id),
        name: product.name,
        sku: product.sku,
        stockOnHand: product.stockOnHand,
        value: product.stockOnHand * product.averageCost,
      })),
    };
  }

  private async expiringStock(organizationId: string) {
    const batches = await this.inventoryService.getExpiringBatches(
      organizationId,
      60,
    );

    return {
      summary: { batches: batches.length },
      rows: batches as unknown as Record<string, unknown>[],
    };
  }

  private async purchasesSummary(
    organizationId: string,
    period: ResolvedPeriod,
  ) {
    const summary = await this.purchasingService.getPurchasesSummary(
      organizationId,
      period.from,
      period.to,
    );

    return {
      summary: { receipts: summary.count, total: summary.total },
      rows: [],
    };
  }

  private async cashPosition(organizationId: string, period: ResolvedPeriod) {
    const rows = await this.salesService.getCashPosition(
      organizationId,
      period.from,
      period.to,
    );

    return {
      summary: {
        total: rows.reduce((sum, row) => sum + row.amount, 0),
        transactions: rows.reduce((sum, row) => sum + row.count, 0),
      },
      rows: rows as unknown as Record<string, unknown>[],
    };
  }
}
