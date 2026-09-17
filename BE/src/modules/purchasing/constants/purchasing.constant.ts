export enum PURCHASE_ORDER_STATUS {
  DRAFT = 'DRAFT',
  /** Sent to the supplier. Committed, but nothing has arrived. */
  SENT = 'SENT',
  /** Some lines received; the rest still expected. */
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

/**
 * What moved a supplier's balance.
 *
 * Sign convention, mirrored from the customer ledger but **inverted in
 * meaning**: positive increases what *we owe them*. A bill is positive; a
 * payment we make is negative. Stated here because getting it backwards
 * silently turns a payable into a receivable.
 */
export enum SUPPLIER_LEDGER_TYPE {
  /** Goods received and billed. Positive. */
  BILL = 'BILL',
  /** Money paid to the supplier. Negative. */
  PAYMENT = 'PAYMENT',
  /** Goods sent back. Negative. */
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  OPENING = 'OPENING',
}

/** The subject name for suppliers in authorization rules. */
export const SUPPLIER_SUBJECT = 'Supplier';

/** The subject name for purchase orders in authorization rules. */
export const PURCHASE_ORDER_SUBJECT = 'PurchaseOrder';

/** The subject name for goods receipts in authorization rules. */
export const GOODS_RECEIPT_SUBJECT = 'GoodsReceipt';
