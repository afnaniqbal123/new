import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SaleReturn,
  SaleReturnDocument,
} from 'src/modules/sales/sale-return.schema';
import { SalesService } from 'src/modules/sales/sales.service';
import { CreateSaleReturnDto } from 'src/modules/sales/dto/sales.dto';
import { SALE_STATUS } from 'src/modules/sales/constants/sales.constant';
import { SALES_RESPONSE } from 'src/modules/sales/constants/api-response/sales.response';
import { SerializeHttpError } from 'src/utils/serializer';
import { multiply, sum } from 'src/utils/money';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { CustomerService } from 'src/modules/customer/customer.service';
import { STOCK_REASON } from 'src/modules/inventory/constants/inventory.constant';
import { CUSTOMER_LEDGER_TYPE } from 'src/modules/customer/constants/customer.constant';

/**
 * Handles goods coming back.
 *
 * The rule that governs everything here: **a return refunds what the sale
 * charged**, never what the item is worth today. Prices move, tax rates move,
 * and a customer returning a March purchase in December is entitled to
 * March's money — so every figure is derived from the original sale line,
 * pro-rated by the quantity coming back.
 */
@Injectable()
export class SaleReturnService {
  constructor(
    @InjectModel(SaleReturn.name)
    private readonly returnModel: Model<SaleReturnDocument>,
    private readonly salesService: SalesService,
    private readonly inventoryService: InventoryService,
    private readonly customerService: CustomerService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateSaleReturnDto,
    userId: string,
  ): Promise<SaleReturnDocument> {
    const sale = await this.salesService.findById(organizationId, dto.sale);

    if (sale.status !== SALE_STATUS.COMPLETED) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        SALES_RESPONSE.RETURN_ON_VOID_SALE,
      );
    }

    const alreadyReturned = await this.getReturnedQuantities(
      organizationId,
      dto.sale,
    );

    const lines = dto.lines.map((requested) => {
      const original = sale.lines.find(
        (line) => String(line.product) === requested.product,
      );

      if (!original) {
        return SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          SALES_RESPONSE.RETURN_EXCEEDS_SALE,
        );
      }

      // Cumulative across every prior return, not just this one — otherwise
      // the same line could be returned repeatedly, each time passing a check
      // that only looked at the original quantity.
      const returnable =
        original.quantity - (alreadyReturned.get(requested.product) ?? 0);

      if (requested.quantity > returnable) {
        return SerializeHttpError(
          { product: requested.product, returnable },
          HttpStatus.CONFLICT,
          SALES_RESPONSE.RETURN_EXCEEDS_SALE,
        );
      }

      // Pro-rate by quantity so the refund matches what was charged,
      // discounts and tax included, without recomputing either.
      const share = requested.quantity / original.quantity;
      const netRefund = multiply(original.taxableAmount, share);
      const taxRefund = multiply(
        original.taxAmount + original.additionalTaxAmount,
        share,
      );

      return {
        product: new Types.ObjectId(requested.product),
        name: original.name,
        quantity: requested.quantity,
        unitPrice: original.unitPrice,
        taxAmount: taxRefund,
        lineTotal: netRefund + taxRefund,
        unitCost: original.unitCost,
      };
    });

    const subtotal = sum(lines.map((line) => line.lineTotal - line.taxAmount));
    const taxTotal = sum(lines.map((line) => line.taxAmount));
    const costTotal = sum(
      lines.map((line) => multiply(line.unitCost, line.quantity)),
    );

    const saleReturn = await this.returnModel.create({
      organization: new Types.ObjectId(organizationId),
      sale: sale._id,
      saleInvoiceNumber: sale.invoiceNumber,
      returnNumber: await this.nextReturnNumber(organizationId),
      customer: sale.customer?._id ?? sale.customer,
      location: sale.location._id ?? sale.location,
      lines,
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal,
      costTotal,
      refunded: dto.refundNow ?? false,
      reason: dto.reason,
      processedBy: new Types.ObjectId(userId),
    });

    // Stock comes back at the cost the sale recorded, not at today's average.
    // Restoring it at a different cost would silently rewrite the margin on
    // every unit already in the warehouse.
    await this.inventoryService.recordMovements(
      organizationId,
      lines.map((line) => ({
        productId: String(line.product),
        locationId: String(sale.location._id ?? sale.location),
        quantity: line.quantity,
        reason: STOCK_REASON.SALE_RETURN,
        unitCost: line.unitCost,
        reference: String(saleReturn._id),
        referenceType: 'SaleReturn',
        referenceNumber: saleReturn.returnNumber,
      })),
      userId,
    );

    // Crediting the account is the default, and is what a distributor
    // normally does — cash back across the counter is the exception, so it is
    // opt-in rather than assumed.
    if (sale.customer && !saleReturn.refunded) {
      await this.customerService.recordMovements(
        organizationId,
        [
          {
            customerId: String(sale.customer._id ?? sale.customer),
            type: CUSTOMER_LEDGER_TYPE.RETURN,
            // Negative: a return reduces what the customer owes.
            amount: -saleReturn.grandTotal,
            reference: String(saleReturn._id),
            referenceType: 'SaleReturn',
            referenceNumber: saleReturn.returnNumber,
            note: dto.reason,
          },
        ],
        userId,
      );
    }

    return saleReturn;
  }

  /**
   * How much of each line has already come back across every prior return.
   *
   * Without this, a line sold once could be returned an unlimited number of
   * times, each return individually passing a check against the original
   * quantity.
   */
  private async getReturnedQuantities(
    organizationId: string,
    saleId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.returnModel.aggregate<{
      _id: Types.ObjectId;
      quantity: number;
    }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          sale: new Types.ObjectId(saleId),
          status: { $ne: 'VOID' },
        },
      },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.product',
          quantity: { $sum: '$lines.quantity' },
        },
      },
    ]);

    return new Map(rows.map((row) => [String(row._id), row.quantity]));
  }

  private async nextReturnNumber(organizationId: string): Promise<string> {
    const count = await this.returnModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
    });

    return `RET-${String(count + 1).padStart(5, '0')}`;
  }

  async findAll(
    organizationId: string,
    page = 1,
    limit = 25,
  ): Promise<{ items: SaleReturnDocument[]; total: number }> {
    const filter = { organization: new Types.ObjectId(organizationId) };

    const [items, total] = await Promise.all([
      this.returnModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customer', 'name businessName')
        .populate('processedBy', 'name'),
      this.returnModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  async findById(
    organizationId: string,
    returnId: string,
  ): Promise<SaleReturnDocument> {
    const saleReturn = await this.returnModel
      .findOne({
        _id: new Types.ObjectId(returnId),
        organization: new Types.ObjectId(organizationId),
      })
      .populate('customer', 'name businessName phone')
      .populate('processedBy', 'name');

    if (!saleReturn) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        SALES_RESPONSE.RETURN_NOT_FOUND,
      );
    }

    return saleReturn;
  }

  /** Total value returned in a period — a figure the profit report nets off. */
  async getReturnsTotal(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<{ count: number; amount: number; cost: number }> {
    const [result] = await this.returnModel.aggregate<{
      count: number;
      amount: number;
      cost: number;
    }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          status: { $ne: 'VOID' },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: '$grandTotal' },
          cost: { $sum: '$costTotal' },
        },
      },
    ]);

    return {
      count: result?.count ?? 0,
      amount: result?.amount ?? 0,
      cost: result?.cost ?? 0,
    };
  }
}
