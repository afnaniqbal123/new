/**
 * What moved a customer's balance.
 *
 * Signed convention, applied everywhere: **positive increases what the
 * customer owes**, negative reduces it. So a credit sale is positive and a
 * payment is negative. Stated once here because a ledger where half the
 * callers guess the sign is a ledger that cannot be trusted.
 */
export enum CUSTOMER_LEDGER_TYPE {
  /** A sale made on credit. Positive. */
  SALE = 'SALE',
  /** Money received. Negative. */
  PAYMENT = 'PAYMENT',
  /** Goods returned against a credit sale. Negative. */
  RETURN = 'RETURN',
  /** A manual correction. Signed either way, and always explained. */
  ADJUSTMENT = 'ADJUSTMENT',
  /** What was owed before the system existed. Positive. */
  OPENING = 'OPENING',
  /** Debt written off as uncollectable. Negative. */
  WRITE_OFF = 'WRITE_OFF',
}

/**
 * How overdue a receivable is.
 *
 * The buckets a distributor actually chases in — 30/60/90 is the near-universal
 * convention, and matching it means the report can be read without a legend.
 */
export enum AGING_BUCKET {
  CURRENT = 'CURRENT',
  D1_30 = 'D1_30',
  D31_60 = 'D31_60',
  D61_90 = 'D61_90',
  D90_PLUS = 'D90_PLUS',
}

/** Upper bound in days for each bucket. `null` is the open-ended tail. */
export const AGING_BUCKET_LIMITS: readonly {
  bucket: AGING_BUCKET;
  maxDays: number | null;
}[] = [
  { bucket: AGING_BUCKET.CURRENT, maxDays: 0 },
  { bucket: AGING_BUCKET.D1_30, maxDays: 30 },
  { bucket: AGING_BUCKET.D31_60, maxDays: 60 },
  { bucket: AGING_BUCKET.D61_90, maxDays: 90 },
  { bucket: AGING_BUCKET.D90_PLUS, maxDays: null },
];

/** The subject name for customer records in authorization rules. */
export const CUSTOMER_SUBJECT = 'Customer';

/**
 * Overriding a customer's credit limit is its own subject, not merely an
 * update to a sale.
 *
 * Selling past a credit limit is a genuine commercial decision with a real
 * cost, so it is a permission someone holds rather than a checkbox anyone at
 * the counter can tick. Invariant #2.
 */
export const CREDIT_OVERRIDE_SUBJECT = 'CreditOverride';
