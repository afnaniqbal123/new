import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  Customer,
  CustomerDocument,
} from 'src/modules/customer/customer.schema';
import {
  CustomerLedgerEntry,
  CustomerLedgerEntryDocument,
} from 'src/modules/customer/customer-ledger.schema';
import {
  AGING_BUCKET,
  AGING_BUCKET_LIMITS,
  CUSTOMER_LEDGER_TYPE,
} from 'src/modules/customer/constants/customer.constant';
import { CUSTOMER_RESPONSE } from 'src/modules/customer/constants/api-response/customer.response';
import {
  CreateCustomerDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from 'src/modules/customer/dto/customer.dto';
import { SerializeHttpError } from 'src/utils/serializer';

/** One movement to append to a customer's ledger. */
export interface CustomerLedgerMovement {
  customerId: string;
  type: CUSTOMER_LEDGER_TYPE;
  /** Signed, minor units. Positive increases what is owed. */
  amount: number;
  reference?: string;
  referenceType?: string;
  referenceNumber?: string;
  dueDate?: Date;
  note?: string;
}

/** The result of asking whether a customer may take on more credit. */
export interface CreditCheck {
  allowed: boolean;
  creditLimit: number;
  outstanding: number;
  /** What the balance would become. */
  projected: number;
  /** How far past the limit, or 0. */
  excess: number;
}

/**
 * Owns customers and the receivables ledger.
 *
 * The two responsibilities are one module because they are one aggregate: a
 * customer's balance has no meaning apart from the customer, and the
 * invariant that ties them (never exceed the credit limit) needs both in
 * hand to be enforced at all.
 */
@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(CustomerLedgerEntry.name)
    private readonly ledgerModel: Model<CustomerLedgerEntryDocument>,
  ) {}

  // --- Customers ---------------------------------------------------------

  async create(
    organizationId: string,
    dto: CreateCustomerDto,
  ): Promise<CustomerDocument> {
    if (dto.phone) {
      await this.assertPhoneFree(organizationId, dto.phone);
    }

    return this.customerModel.create({
      ...dto,
      organization: new Types.ObjectId(organizationId),
    });
  }

  async findAll(
    organizationId: string,
    query: CustomerQueryDto,
  ): Promise<{ items: CustomerDocument[]; total: number }> {
    const filter: Record<string, unknown> = {
      organization: new Types.ObjectId(organizationId),
    };

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [
        { name: pattern },
        { businessName: pattern },
        { phone: pattern },
        { email: pattern },
      ];
    }

    if (query.withBalance) {
      filter.outstanding = { $gt: 0 };
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const [items, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.customerModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  async findById(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerDocument> {
    const customer = await this.customerModel.findOne({
      _id: new Types.ObjectId(customerId),
      organization: new Types.ObjectId(organizationId),
    });

    if (!customer) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        CUSTOMER_RESPONSE.NOT_FOUND,
      );
    }

    return customer;
  }

  /**
   * Matches an inbound WhatsApp number to a customer.
   *
   * Compares against `phoneNormalized`, and normalises the incoming number
   * the same way, so that the format a phone happens to send in — with or
   * without country code, spaces, or a leading zero — does not decide whether
   * the message is recognised.
   *
   * Returns null rather than throwing: an unknown number is an ordinary event
   * on a public WhatsApp line, not an error.
   */
  async findByPhone(
    organizationId: string,
    phone: string,
  ): Promise<CustomerDocument | null> {
    const digits = phone.replace(/\D/g, '').replace(/^0+/, '');

    if (!digits) return null;

    // A number may arrive with or without its country code. Matching on the
    // trailing digits covers both without needing to know the country.
    const tail = digits.slice(-10);

    return this.customerModel.findOne({
      organization: new Types.ObjectId(organizationId),
      phoneNormalized: { $regex: `${tail}$` },
    });
  }

  async update(
    organizationId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerDocument> {
    const customer = await this.findById(organizationId, customerId);

    if (dto.phone && dto.phone !== customer.phone) {
      await this.assertPhoneFree(organizationId, dto.phone, customerId);
    }

    // `save` rather than `findOneAndUpdate`, so the phone-normalising pre-save
    // hook runs. An update that bypassed it would leave a customer
    // unreachable by WhatsApp matching without anything looking wrong.
    Object.assign(customer, dto);

    return customer.save();
  }

  /**
   * Deactivates a customer. Never a hard delete: their ledger rows and every
   * sale they ever made reference them.
   */
  async deactivate(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerDocument> {
    return this.update(organizationId, customerId, { isActive: false });
  }

  private async assertPhoneFree(
    organizationId: string,
    phone: string,
    exceptId?: string,
  ): Promise<void> {
    const digits = phone.replace(/\D/g, '').replace(/^0+/, '');

    if (!digits) return;

    const clash = await this.customerModel.exists({
      organization: new Types.ObjectId(organizationId),
      phoneNormalized: digits,
      ...(exceptId ? { _id: { $ne: new Types.ObjectId(exceptId) } } : {}),
    });

    if (clash) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        CUSTOMER_RESPONSE.PHONE_TAKEN,
      );
    }
  }

  // --- Credit ------------------------------------------------------------

  /**
   * Whether a customer can take on `amount` more debt.
   *
   * Reads the balance from the ledger, not from the cached `outstanding`
   * field — this decision gates real money, and a projection that a crashed
   * process left stale must not be what authorises a credit sale.
   */
  async checkCredit(
    organizationId: string,
    customerId: string,
    amount: number,
  ): Promise<CreditCheck> {
    const customer = await this.findById(organizationId, customerId);
    const outstanding = await this.getBalance(organizationId, customerId);
    const projected = outstanding + amount;

    return {
      allowed: projected <= customer.creditLimit,
      creditLimit: customer.creditLimit,
      outstanding,
      projected,
      excess: Math.max(0, projected - customer.creditLimit),
    };
  }

  /**
   * Refuses a credit sale that would breach the limit.
   *
   * `overrideAllowed` is passed by the caller after checking the
   * `CREDIT_OVERRIDE_SUBJECT` permission — the decision of *who* may override
   * belongs in a policy, not here. Invariant #2.
   */
  async assertCreditAvailable(
    organizationId: string,
    customerId: string,
    amount: number,
    overrideAllowed: boolean,
  ): Promise<CreditCheck> {
    const check = await this.checkCredit(organizationId, customerId, amount);

    if (check.allowed || overrideAllowed) return check;

    return SerializeHttpError(
      check,
      HttpStatus.CONFLICT,
      CUSTOMER_RESPONSE.CREDIT_LIMIT_EXCEEDED,
    );
  }

  // --- Ledger ------------------------------------------------------------

  /** The true balance, summed from the ledger. */
  async getBalance(
    organizationId: string,
    customerId: string,
  ): Promise<number> {
    const [result] = await this.ledgerModel.aggregate<{ total: number }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          customer: new Types.ObjectId(customerId),
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    return result?.total ?? 0;
  }

  /**
   * Appends movements and refreshes the cached balance.
   *
   * Same two-write shape as the stock ledger, and safe for the same reason:
   * the ledger is written first and is the truth, so a crash between the two
   * leaves a stale cache that `recalculateBalance` repairs — never a lost
   * transaction.
   */
  async recordMovements(
    organizationId: string,
    movements: readonly CustomerLedgerMovement[],
    performedBy?: string,
    session?: ClientSession,
  ): Promise<CustomerLedgerEntryDocument[]> {
    if (movements.length === 0) return [];

    const balances = new Map<string, number>();
    const rows: Record<string, unknown>[] = [];

    for (const movement of movements) {
      if (!balances.has(movement.customerId)) {
        balances.set(
          movement.customerId,
          await this.getBalance(organizationId, movement.customerId),
        );
      }

      const next = (balances.get(movement.customerId) ?? 0) + movement.amount;
      balances.set(movement.customerId, next);

      rows.push({
        organization: new Types.ObjectId(organizationId),
        customer: new Types.ObjectId(movement.customerId),
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

    const created = await this.ledgerModel.create(rows, {
      session,
      ordered: true,
    });

    await this.refreshBalances(organizationId, balances, session);

    return created;
  }

  private async refreshBalances(
    organizationId: string,
    balances: ReadonlyMap<string, number>,
    session?: ClientSession,
  ): Promise<void> {
    try {
      await Promise.all(
        [...balances.entries()].map(([customerId, balance]) =>
          this.customerModel.updateOne(
            {
              _id: new Types.ObjectId(customerId),
              organization: new Types.ObjectId(organizationId),
            },
            { $set: { outstanding: balance } },
            { session },
          ),
        ),
      );
    } catch (error) {
      this.logger.error(
        `Customer balance refresh failed for organization ${organizationId}; the ledger is authoritative and recalculateBalance will repair it.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async recalculateBalance(
    organizationId: string,
    customerId: string,
  ): Promise<number> {
    const balance = await this.getBalance(organizationId, customerId);

    await this.customerModel.updateOne(
      {
        _id: new Types.ObjectId(customerId),
        organization: new Types.ObjectId(organizationId),
      },
      { $set: { outstanding: balance } },
    );

    return balance;
  }

  async getLedger(
    organizationId: string,
    customerId: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: CustomerLedgerEntryDocument[]; total: number }> {
    const filter = {
      organization: new Types.ObjectId(organizationId),
      customer: new Types.ObjectId(customerId),
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

  /** Total receivables across the Organization — a dashboard figure. */
  async getTotalReceivables(organizationId: string): Promise<number> {
    const [result] = await this.customerModel.aggregate<{ total: number }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          outstanding: { $gt: 0 },
        },
      },
      { $group: { _id: null, total: { $sum: '$outstanding' } } },
    ]);

    return result?.total ?? 0;
  }

  /**
   * Receivables split by how overdue they are.
   *
   * Computed from unsettled debit rows rather than from customer balances: a
   * customer who owes 50,000 across one recent invoice and one from March is
   * two different collection problems, and a single balance cannot say so.
   *
   * Payments are applied oldest-first when settling, which is the convention
   * a distributor expects and the one that makes this report honest.
   */
  async getAging(organizationId: string): Promise<
    {
      bucket: AGING_BUCKET;
      amount: number;
      customers: number;
    }[]
  > {
    const rows = await this.ledgerModel.aggregate<{
      _id: Types.ObjectId;
      outstanding: number;
      oldestDue: Date | null;
    }>([
      { $match: { organization: new Types.ObjectId(organizationId) } },
      {
        $group: {
          _id: '$customer',
          outstanding: { $sum: '$amount' },
          oldestDue: {
            $min: {
              $cond: [{ $gt: ['$amount', 0] }, '$dueDate', null],
            },
          },
        },
      },
      { $match: { outstanding: { $gt: 0 } } },
    ]);

    const now = Date.now();
    const totals = new Map<AGING_BUCKET, { amount: number; customers: number }>(
      AGING_BUCKET_LIMITS.map(({ bucket }) => [
        bucket,
        { amount: 0, customers: 0 },
      ]),
    );

    for (const row of rows) {
      const overdueDays = row.oldestDue
        ? Math.floor((now - row.oldestDue.getTime()) / 86_400_000)
        : 0;

      const bucket =
        AGING_BUCKET_LIMITS.find(
          ({ maxDays }) => maxDays === null || overdueDays <= maxDays,
        )?.bucket ?? AGING_BUCKET.CURRENT;

      const entry = totals.get(bucket);

      if (entry) {
        entry.amount += row.outstanding;
        entry.customers += 1;
      }
    }

    return [...totals.entries()].map(([bucket, value]) => ({
      bucket,
      ...value,
    }));
  }

  /** Customers with something overdue — the reminder automation's input. */
  async findOverdue(
    organizationId: string,
    minDaysOverdue = 1,
  ): Promise<CustomerDocument[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - minDaysOverdue);

    const overdue = await this.ledgerModel.aggregate<{ _id: Types.ObjectId }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          amount: { $gt: 0 },
          dueDate: { $ne: null, $lte: cutoff },
        },
      },
      { $group: { _id: '$customer' } },
    ]);

    if (overdue.length === 0) return [];

    return this.customerModel.find({
      _id: { $in: overdue.map((row) => row._id) },
      organization: new Types.ObjectId(organizationId),
      outstanding: { $gt: 0 },
      isActive: true,
    });
  }

  async markPurchased(
    organizationId: string,
    customerId: string,
  ): Promise<void> {
    await this.customerModel.updateOne(
      {
        _id: new Types.ObjectId(customerId),
        organization: new Types.ObjectId(organizationId),
      },
      { $set: { lastPurchaseAt: new Date() } },
    );
  }

  /** Customers who have not bought in a while — a retention automation input. */
  async findDormant(
    organizationId: string,
    days: number,
  ): Promise<CustomerDocument[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.customerModel
      .find({
        organization: new Types.ObjectId(organizationId),
        isActive: true,
        lastPurchaseAt: { $ne: null, $lte: cutoff },
      })
      .sort({ lastPurchaseAt: 1 })
      .limit(50);
  }

  async countCustomers(organizationId: string): Promise<number> {
    return this.customerModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
      isActive: true,
    });
  }
}
