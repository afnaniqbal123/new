export enum SALE_STATUS {
  /** Held at the counter — a parked basket. Moves no stock, allocates no number. */
  DRAFT = 'DRAFT',
  /** Finalised. Immutable from here on. Invariant #7. */
  COMPLETED = 'COMPLETED',
  /**
   * Cancelled after completion. The document survives with its number, and
   * compensating ledger rows undo its effects — a sale that vanished is
   * indistinguishable from one that never happened, and the invoice number
   * must never be silently reused.
   */
  VOID = 'VOID',
}

/**
 * How the customer is paying.
 *
 * Derived from the payments attached, never chosen by the operator: a sale
 * with anything left unpaid *is* a credit sale, whatever the screen said.
 * Letting the two disagree is how a credit limit gets bypassed.
 */
export enum SALE_TYPE {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  PARTIAL = 'PARTIAL',
}

export enum PAYMENT_METHOD {
  CASH = 'CASH',
  BANK = 'BANK',
  CARD = 'CARD',
  WALLET = 'WALLET',
  /** Settled against the customer's account rather than paid now. */
  CREDIT = 'CREDIT',
}

/** Where a sale came from. Drives reporting on the WhatsApp channel's value. */
export enum SALE_SOURCE {
  POS = 'POS',
  WHATSAPP = 'WHATSAPP',
  API = 'API',
}

export enum DISCOUNT_TYPE {
  AMOUNT = 'AMOUNT',
  PERCENT = 'PERCENT',
}

export enum RETURN_STATUS {
  COMPLETED = 'COMPLETED',
  VOID = 'VOID',
}

/** The subject name for sales in authorization rules. */
export const SALE_SUBJECT = 'Sale';

/** The subject name for sale returns in authorization rules. */
export const SALE_RETURN_SUBJECT = 'SaleReturn';

/**
 * Voiding a completed sale is its own subject.
 *
 * It reverses stock and a customer's balance, and it is the obvious way to
 * cover up a till shortage — so it is a permission held by someone
 * accountable, not an action available to whoever rang the sale.
 */
export const SALE_VOID_SUBJECT = 'SaleVoid';

/**
 * Discounting below a product's minimum price is its own subject, for the
 * same reason a credit override is: it costs real margin.
 */
export const DISCOUNT_OVERRIDE_SUBJECT = 'DiscountOverride';
