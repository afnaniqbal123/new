import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sale, SaleDocument } from 'src/modules/sales/sale.schema';
import {
  CreateSaleDto,
  SaleLineDto,
  SaleQueryDto,
} from 'src/modules/sales/dto/sales.dto';
import {
  DISCOUNT_TYPE,
  PAYMENT_METHOD,
  SALE_SOURCE,
  SALE_STATUS,
  SALE_TYPE,
} from 'src/modules/sales/constants/sales.constant';
import { SALES_RESPONSE } from 'src/modules/sales/constants/api-response/sales.response';
import { SerializeHttpError } from 'src/utils/serializer';
import { multiply, percentOf, sum } from 'src/utils/money';
import { CatalogService } from 'src/modules/catalog/catalog.service';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { CustomerService } from 'src/modules/customer/customer.service';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { TaxService } from 'src/modules/tax/tax.service';
import { STOCK_REASON } from 'src/modules/inventory/constants/inventory.constant';
import { CUSTOMER_LEDGER_TYPE } from 'src/modules/customer/constants/customer.constant';
import { ProductView } from 'src/modules/catalog/types/product-view.type';

/** What the caller is permitted to override, decided by a policy upstream. */
export interface SaleOverrides {
  /** May complete a sale past the customer's credit limit. */
  credit: boolean;
  /** May discount below a product's minimum price. */
  discount: boolean;
}

/**
 * Owns sales, invoices, and the POS path.
 *
 * ## The order of operations, and why it is this order
 *
 * Completing a sale touches four things that must agree: stock, tax, the
 * customer's balance, and the invoice sequence. The sequence below is
 * deliberate, and reordering it introduces a real bug:
 *
 * 1. **Price the lines** — needs the catalogue, and nothing else.
 * 2. **Compute tax** — needs the priced lines and the buyer's registration.
 * 3. **Check credit** — needs the final total, so it cannot happen earlier.
 * 4. **Check stock** — cheap, and refusing here costs nothing.
 * 5. **Allocate the invoice number** — the first irreversible step, so it
 *    happens only once every refusal above has passed. Allocating earlier
 *    would burn a number on a sale that then failed a credit check, leaving
 *    a permanent gap in a sequence that must be gapless.
 * 6. **Write the sale, then the stock ledger, then the customer ledger.**
 *
 * Steps 6's three writes are not in a transaction, for the reason documented
 * on `InventoryService`: both ledgers are append-only and authoritative, and
 * their cached projections are repairable. Requiring transactions would
 * require a replica set, which would make a single-node database unable to
 * run the application at all.
 */
@Injectable()
export class SalesService {
  constructor(
    @InjectModel(Sale.name)
    private readonly saleModel: Model<SaleDocument>,
    private readonly catalogService: CatalogService,
    private readonly inventoryService: InventoryService,
    private readonly customerService: CustomerService,
    private readonly organizationService: OrganizationService,
    private readonly taxService: TaxService,
  ) {}

  /**
   * Prices, taxes, and validates a basket **without writing anything**.
   *
   * The POS calls this on every basket change to show a live total, and
   * `create` calls it again before committing — so the number the cashier saw
   * and the number that gets written come from the same code, not from two
   * implementations that drift.
   */
  async quote(
    organizationId: string,
    dto: CreateSaleDto,
  ): Promise<{
    lines: Sale['lines'];
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    additionalTaxTotal: number;
    grandTotal: number;
    costTotal: number;
    taxLabel: string;
    additionalTaxLabel?: string;
  }> {
    const settings = await this.organizationService.getSettings(organizationId);
    const products = await this.catalogService.findManyByIds(
      organizationId,
      dto.lines.map((line) => line.product),
    );

    // A customer's standing discount and tax registration both change the
    // arithmetic, so they are resolved before any line is priced.
    const customer = dto.customer
      ? await this.customerService.findById(organizationId, dto.customer)
      : null;

    const priced = dto.lines.map((line) =>
      this.priceLine(line, products, customer?.discountPercent ?? 0),
    );

    const taxTotals = this.taxService.calculate(
      priced.map((line) => ({
        amount: line.taxableAmount,
        ratePercent: line.taxRatePercent,
        treatment: line.treatment,
      })),
      {
        country: settings.country,
        defaultRatePercent: settings.defaultRatePercent,
        pricesIncludeTax: settings.pricesIncludeTax,
        furtherTaxPercent: settings.furtherTaxPercent,
        // Absent registration is treated as unregistered — the conservative
        // direction, since over-collecting is recoverable.
        buyerRegistered: Boolean(customer?.taxRegistrationNumber),
      },
    );

    const lines: Sale['lines'] = priced.map((line, index) => {
      const tax = taxTotals.lines[index];

      return {
        product: new Types.ObjectId(line.productId),
        name: line.name,
        sku: line.sku,
        unit: line.unit,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxableAmount: tax.taxable,
        taxRatePercent: tax.appliedRatePercent,
        taxAmount: tax.tax,
        additionalTaxAmount: tax.additionalTax,
        lineTotal: tax.total,
        unitCost: line.unitCost,
        batchNo: line.batchNo ?? '',
      };
    });

    const subtotal = sum(priced.map((line) => line.grossAmount));
    const lineDiscounts = sum(priced.map((line) => line.discountAmount));
    const invoiceDiscount = this.resolveInvoiceDiscount(
      dto,
      taxTotals.netTotal,
    );

    return {
      lines,
      subtotal,
      discountTotal: lineDiscounts + invoiceDiscount,
      taxTotal: taxTotals.taxTotal,
      additionalTaxTotal: taxTotals.additionalTaxTotal,
      grandTotal: taxTotals.grossTotal - invoiceDiscount,
      costTotal: sum(
        priced.map((line) => multiply(line.unitCost, line.quantity)),
      ),
      taxLabel: taxTotals.taxLabel,
      additionalTaxLabel: taxTotals.additionalTaxLabel,
    };
  }

  /**
   * Prices one line: unit price, then the customer's standing discount, then
   * the line's own discount.
   *
   * Order matters and is fixed here rather than at the call site — applying a
   * 10% line discount before a 5% customer discount gives a different answer
   * from the reverse, and the business expects the customer's terms to be the
   * baseline the line discount then moves from.
   */
  private priceLine(
    line: SaleLineDto,
    products: ReadonlyMap<string, ProductView>,
    customerDiscountPercent: number,
  ): {
    productId: string;
    name: string;
    sku: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    grossAmount: number;
    discountAmount: number;
    taxableAmount: number;
    taxRatePercent: number | null;
    treatment: ProductView['taxTreatment'];
    unitCost: number;
    batchNo?: string;
  } {
    const product = products.get(line.product);

    if (!product) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        SALES_RESPONSE.PRODUCT_NOT_FOUND,
      );
    }

    // An explicit unit price overrides the catalogue — negotiated pricing is
    // normal in distribution. The minimum-price floor is checked separately,
    // in `assertDiscountsAllowed`, where the override permission is known.
    const unitPrice = line.unitPrice ?? product.sellingPrice;
    const grossAmount = multiply(unitPrice, line.quantity);

    const customerDiscount = percentOf(grossAmount, customerDiscountPercent);
    const lineDiscount =
      line.discountType === DISCOUNT_TYPE.PERCENT
        ? percentOf(grossAmount - customerDiscount, line.discount ?? 0)
        : (line.discount ?? 0);

    const discountAmount = customerDiscount + lineDiscount;

    return {
      productId: line.product,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      quantity: line.quantity,
      unitPrice,
      grossAmount,
      discountAmount,
      taxableAmount: grossAmount - discountAmount,
      taxRatePercent: product.taxRatePercent,
      treatment: product.taxTreatment,
      unitCost: product.averageCost,
      batchNo: line.batchNo,
    };
  }

  private resolveInvoiceDiscount(dto: CreateSaleDto, net: number): number {
    if (!dto.discount) return 0;

    return dto.discountType === DISCOUNT_TYPE.PERCENT
      ? percentOf(net, dto.discount)
      : dto.discount;
  }

  /**
   * Completes a sale: the whole POS path, in the order documented above.
   */
  async create(
    organizationId: string,
    dto: CreateSaleDto,
    userId: string,
    overrides: SaleOverrides,
    source: SALE_SOURCE = SALE_SOURCE.POS,
  ): Promise<SaleDocument> {
    if (dto.lines.length === 0) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        SALES_RESPONSE.NO_LINES,
      );
    }

    const locationId =
      dto.location ??
      String(
        await this.organizationService.getDefaultLocationId(organizationId),
      );

    await this.organizationService.assertLocationBelongs(
      organizationId,
      locationId,
    );

    // 1 & 2 — price and tax.
    const quote = await this.quote(organizationId, dto);

    await this.assertDiscountsAllowed(organizationId, dto, overrides);

    const paidTotal = sum((dto.payments ?? []).map((p) => p.amount));
    const dueTotal = quote.grandTotal - paidTotal;

    if (paidTotal > quote.grandTotal) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        SALES_RESPONSE.OVERPAID,
      );
    }

    // 3 — credit. A sale with anything outstanding is a credit sale whatever
    // the operator selected, and it needs a customer to owe it.
    const customer = dto.customer
      ? await this.customerService.findById(organizationId, dto.customer)
      : null;

    if (dueTotal > 0) {
      if (!customer) {
        return SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          SALES_RESPONSE.CREDIT_NEEDS_CUSTOMER,
        );
      }

      await this.customerService.assertCreditAvailable(
        organizationId,
        String(customer._id),
        dueTotal,
        overrides.credit,
      );
    }

    // 4 — stock. Untracked products (delivery charges, services) are ignored
    // by the availability check itself.
    await this.inventoryService.assertSufficientStock(
      organizationId,
      locationId,
      dto.lines.map((line) => ({
        productId: line.product,
        quantity: line.quantity,
      })),
    );

    // 5 — the first irreversible step, taken only once everything above has
    // passed. See the class doc comment.
    const invoiceNumber =
      await this.organizationService.allocateInvoiceNumber(organizationId);

    const dueDate = this.resolveDueDate(customer?.paymentTermDays ?? 0);

    // 6 — write the sale, then the two ledgers.
    const sale = await this.saleModel.create({
      organization: new Types.ObjectId(organizationId),
      location: new Types.ObjectId(locationId),
      invoiceNumber,
      customer: customer?._id,
      customerName: customer?.name,
      lines: quote.lines,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      taxTotal: quote.taxTotal,
      additionalTaxTotal: quote.additionalTaxTotal,
      grandTotal: quote.grandTotal,
      costTotal: quote.costTotal,
      paidTotal,
      dueTotal,
      payments: dto.payments ?? [],
      saleType: this.resolveSaleType(paidTotal, quote.grandTotal),
      status: SALE_STATUS.COMPLETED,
      source,
      dueDate: dueTotal > 0 ? dueDate : undefined,
      completedAt: new Date(),
      soldBy: new Types.ObjectId(userId),
      creditOverrideBy:
        dueTotal > 0 && overrides.credit
          ? new Types.ObjectId(userId)
          : undefined,
      note: dto.note,
      conversation: dto.conversation
        ? new Types.ObjectId(dto.conversation)
        : undefined,
    });

    await this.inventoryService.recordMovements(
      organizationId,
      quote.lines.map((line) => ({
        productId: String(line.product),
        locationId,
        quantity: -line.quantity,
        reason: STOCK_REASON.SALE,
        reference: String(sale._id),
        referenceType: 'Sale',
        referenceNumber: invoiceNumber,
        batchNo: line.batchNo || undefined,
      })),
      userId,
    );

    if (customer) {
      // Only the unpaid part touches the balance. A fully-paid sale still
      // records nothing here, which is right: the customer owes nothing for it.
      if (dueTotal > 0) {
        await this.customerService.recordMovements(
          organizationId,
          [
            {
              customerId: String(customer._id),
              type: CUSTOMER_LEDGER_TYPE.SALE,
              amount: dueTotal,
              reference: String(sale._id),
              referenceType: 'Sale',
              referenceNumber: invoiceNumber,
              dueDate,
            },
          ],
          userId,
        );
      }

      await this.customerService.markPurchased(
        organizationId,
        String(customer._id),
      );
    }

    return sale;
  }

  /**
   * A sale is credit if anything is outstanding, partial if something was
   * paid. Derived, never taken from the request — see `SALE_TYPE`.
   */
  private resolveSaleType(paid: number, total: number): SALE_TYPE {
    if (paid >= total) return SALE_TYPE.CASH;
    if (paid > 0) return SALE_TYPE.PARTIAL;

    return SALE_TYPE.CREDIT;
  }

  private resolveDueDate(termDays: number): Date {
    const due = new Date();
    due.setDate(due.getDate() + termDays);

    return due;
  }

  /**
   * Refuses a line priced below the product's floor, unless the caller holds
   * the discount override.
   *
   * Checked against the *effective* price after every discount, not the
   * headline unit price — a 40% invoice-level discount evades a check that
   * only looks at the line.
   */
  private async assertDiscountsAllowed(
    organizationId: string,
    dto: CreateSaleDto,
    overrides: SaleOverrides,
  ): Promise<void> {
    if (overrides.discount) return;

    const products = await this.catalogService.findManyByIds(
      organizationId,
      dto.lines.map((line) => line.product),
    );

    const breached = dto.lines.filter((line) => {
      const product = products.get(line.product);

      if (!product || product.minimumPrice <= 0) return false;

      const unitPrice = line.unitPrice ?? product.sellingPrice;
      const discount =
        line.discountType === DISCOUNT_TYPE.PERCENT
          ? percentOf(unitPrice, line.discount ?? 0)
          : Math.round((line.discount ?? 0) / Math.max(line.quantity, 1));

      return unitPrice - discount < product.minimumPrice;
    });

    if (breached.length === 0) return;

    return SerializeHttpError(
      breached.map((line) => line.product),
      HttpStatus.CONFLICT,
      SALES_RESPONSE.BELOW_MINIMUM_PRICE,
    );
  }

  // --- Reading -----------------------------------------------------------

  async findAll(
    organizationId: string,
    query: SaleQueryDto,
  ): Promise<{ items: SaleDocument[]; total: number }> {
    const filter: Record<string, unknown> = {
      organization: new Types.ObjectId(organizationId),
    };

    if (query.status) filter.status = query.status;
    if (query.customer) filter.customer = new Types.ObjectId(query.customer);
    if (query.source) filter.source = query.source;
    if (query.unpaid) filter.dueTotal = { $gt: 0 };

    if (query.from || query.to) {
      filter.completedAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [{ invoiceNumber: pattern }, { customerName: pattern }];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const [items, total] = await Promise.all([
      this.saleModel
        .find(filter)
        .sort({ completedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customer', 'name businessName phone')
        .populate('soldBy', 'name'),
      this.saleModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  async findById(
    organizationId: string,
    saleId: string,
  ): Promise<SaleDocument> {
    const sale = await this.saleModel
      .findOne({
        _id: new Types.ObjectId(saleId),
        organization: new Types.ObjectId(organizationId),
      })
      .populate(
        'customer',
        'name businessName phone address taxRegistrationNumber',
      )
      .populate('location', 'name code address')
      .populate('soldBy', 'name');

    if (!sale) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        SALES_RESPONSE.NOT_FOUND,
      );
    }

    return sale;
  }

  /**
   * Records a payment against an already-completed credit sale.
   *
   * Appends to both the sale's payment list and the customer ledger. The sale
   * document's `paidTotal`/`dueTotal` are updated — which is *not* a breach of
   * immutability: the sale's lines, totals and invoice number never change,
   * only the settlement state, and the ledger remains the record of what was
   * actually received.
   */
  async recordPayment(
    organizationId: string,
    saleId: string,
    payment: { method: PAYMENT_METHOD; amount: number; reference?: string },
    userId: string,
  ): Promise<SaleDocument> {
    const sale = await this.findById(organizationId, saleId);

    if (sale.status !== SALE_STATUS.COMPLETED) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        SALES_RESPONSE.NOT_COMPLETED,
      );
    }

    if (payment.amount <= 0 || payment.amount > sale.dueTotal) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        SALES_RESPONSE.INVALID_PAYMENT_AMOUNT,
      );
    }

    sale.payments.push({
      method: payment.method,
      amount: payment.amount,
      reference: payment.reference ?? '',
      receivedAt: new Date(),
    });
    sale.paidTotal += payment.amount;
    sale.dueTotal -= payment.amount;
    sale.saleType = this.resolveSaleType(sale.paidTotal, sale.grandTotal);

    await sale.save();

    if (sale.customer) {
      await this.customerService.recordMovements(
        organizationId,
        [
          {
            customerId: String(sale.customer._id ?? sale.customer),
            type: CUSTOMER_LEDGER_TYPE.PAYMENT,
            // Negative: a payment reduces what is owed. See the sign
            // convention on CUSTOMER_LEDGER_TYPE.
            amount: -payment.amount,
            reference: String(sale._id),
            referenceType: 'Sale',
            referenceNumber: sale.invoiceNumber,
          },
        ],
        userId,
      );
    }

    return sale;
  }

  /**
   * Voids a completed sale, reversing stock and the customer's balance.
   *
   * The document survives with its invoice number — a sale that vanished is
   * indistinguishable from one that never happened, and reusing the number
   * would break the gapless sequence a tax authority expects.
   */
  async voidSale(
    organizationId: string,
    saleId: string,
    userId: string,
    reason: string,
  ): Promise<SaleDocument> {
    const sale = await this.findById(organizationId, saleId);

    if (sale.status !== SALE_STATUS.COMPLETED) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        SALES_RESPONSE.NOT_COMPLETED,
      );
    }

    await this.inventoryService.reverseMovementsFor(
      organizationId,
      saleId,
      STOCK_REASON.SALE_RETURN,
      userId,
      `Invoice ${sale.invoiceNumber} voided: ${reason}`,
    );

    if (sale.customer && sale.dueTotal > 0) {
      await this.customerService.recordMovements(
        organizationId,
        [
          {
            customerId: String(sale.customer._id ?? sale.customer),
            type: CUSTOMER_LEDGER_TYPE.ADJUSTMENT,
            amount: -sale.dueTotal,
            reference: String(sale._id),
            referenceType: 'Sale',
            referenceNumber: sale.invoiceNumber,
            note: `Voided: ${reason}`,
          },
        ],
        userId,
      );
    }

    sale.status = SALE_STATUS.VOID;
    sale.note = sale.note
      ? `${sale.note}\nVoided: ${reason}`
      : `Voided: ${reason}`;
    sale.dueTotal = 0;

    return sale.save();
  }

  // --- Figures other modules need ---------------------------------------

  /** Completed sales between two instants — the reporting primitive. */
  async getSalesBetween(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<SaleDocument[]> {
    return this.saleModel.find({
      organization: new Types.ObjectId(organizationId),
      status: SALE_STATUS.COMPLETED,
      completedAt: { $gte: from, $lte: to },
    });
  }

  async getSalesSummary(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<{
    count: number;
    revenue: number;
    cost: number;
    profit: number;
    collected: number;
    outstanding: number;
  }> {
    const [result] = await this.saleModel.aggregate<{
      count: number;
      revenue: number;
      cost: number;
      collected: number;
      outstanding: number;
    }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          status: SALE_STATUS.COMPLETED,
          completedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: '$grandTotal' },
          cost: { $sum: '$costTotal' },
          collected: { $sum: '$paidTotal' },
          outstanding: { $sum: '$dueTotal' },
        },
      },
    ]);

    const revenue = result?.revenue ?? 0;
    const cost = result?.cost ?? 0;

    return {
      count: result?.count ?? 0,
      revenue,
      cost,
      profit: revenue - cost,
      collected: result?.collected ?? 0,
      outstanding: result?.outstanding ?? 0,
    };
  }

  async countSalesThisMonth(organizationId: string): Promise<number> {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    return this.saleModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
      status: SALE_STATUS.COMPLETED,
      completedAt: { $gte: start },
    });
  }

  /**
   * Revenue per calendar day, in the organization's timezone.
   *
   * Bucketed with `$dateToString` and an explicit `timezone` so a sale at
   * 01:00 Karachi lands on the Karachi day, not the previous UTC one. Doing
   * this grouping in JavaScript after the fact would pull every sale in the
   * range into memory for what the database does in one pass.
   */
  async getSalesByDay(
    organizationId: string,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<{ date: string; revenue: number; cost: number; count: number }[]> {
    return this.saleModel.aggregate([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          status: SALE_STATUS.COMPLETED,
          completedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$completedAt',
              timezone,
            },
          },
          revenue: { $sum: '$grandTotal' },
          cost: { $sum: '$costTotal' },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: '$_id', revenue: 1, cost: 1, count: 1 } },
      { $sort: { date: 1 } },
    ]);
  }

  /**
   * Best sellers by revenue, with the margin each one actually earned.
   *
   * Ranked by revenue rather than units: a distributor moving 10,000 sachets
   * and 40 cartons cares which line pays the rent, not which is bulkier.
   */
  async getTopProducts(
    organizationId: string,
    from: Date,
    to: Date,
    limit = 10,
  ): Promise<
    {
      product: Types.ObjectId;
      name: string;
      sku: string;
      quantity: number;
      revenue: number;
      cost: number;
      profit: number;
    }[]
  > {
    return this.saleModel.aggregate([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          status: SALE_STATUS.COMPLETED,
          completedAt: { $gte: from, $lte: to },
        },
      },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.product',
          name: { $first: '$lines.name' },
          sku: { $first: '$lines.sku' },
          quantity: { $sum: '$lines.quantity' },
          revenue: { $sum: '$lines.lineTotal' },
          cost: {
            $sum: { $multiply: ['$lines.unitCost', '$lines.quantity'] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          product: '$_id',
          name: 1,
          sku: 1,
          quantity: 1,
          revenue: 1,
          cost: 1,
          profit: { $subtract: ['$revenue', '$cost'] },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
    ]);
  }

  /** Biggest customers by revenue in a period. */
  async getTopCustomers(
    organizationId: string,
    from: Date,
    to: Date,
    limit = 10,
  ): Promise<
    {
      customer: Types.ObjectId | null;
      name: string;
      orders: number;
      revenue: number;
      profit: number;
    }[]
  > {
    return this.saleModel.aggregate([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          status: SALE_STATUS.COMPLETED,
          completedAt: { $gte: from, $lte: to },
          // Walk-in cash sales have no customer and would otherwise collapse
          // into a single meaningless "null" row at the top of the ranking.
          customer: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$customer',
          name: { $first: '$customerName' },
          orders: { $sum: 1 },
          revenue: { $sum: '$grandTotal' },
          cost: { $sum: '$costTotal' },
        },
      },
      {
        $project: {
          _id: 0,
          customer: '$_id',
          name: 1,
          orders: 1,
          revenue: 1,
          profit: { $subtract: ['$revenue', '$cost'] },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
    ]);
  }

  /**
   * Products that have not sold at all in a period.
   *
   * Returns the ids that *did* sell; the caller subtracts them from the
   * catalogue. Phrased this way because "what did not happen" is not
   * something a query over sales can answer on its own.
   */
  async getSoldProductIds(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<Set<string>> {
    const rows = await this.saleModel.aggregate<{ _id: Types.ObjectId }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          status: SALE_STATUS.COMPLETED,
          completedAt: { $gte: from, $lte: to },
        },
      },
      { $unwind: '$lines' },
      { $group: { _id: '$lines.product' } },
    ]);

    return new Set(rows.map((row) => String(row._id)));
  }

  /**
   * Money actually taken in a period, split by method.
   *
   * Reads the payment sub-documents rather than the sale totals, because a
   * credit sale contributes nothing to the till on the day it is made — and
   * a payment against an old invoice contributes today.
   */
  async getCashPosition(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<{ method: string; amount: number; count: number }[]> {
    return this.saleModel.aggregate([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          status: SALE_STATUS.COMPLETED,
        },
      },
      { $unwind: '$payments' },
      { $match: { 'payments.receivedAt': { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$payments.method',
          amount: { $sum: '$payments.amount' },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, method: '$_id', amount: 1, count: 1 } },
      { $sort: { amount: -1 } },
    ]);
  }
}
