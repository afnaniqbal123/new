/**
 * Why stock moved.
 *
 * Closed set on purpose: every reason maps to a document type that can be
 * audited, and "OTHER" would become the bucket that hides real problems.
 * A genuine new movement type gets a member here and a reviewed decision.
 */
export enum STOCK_REASON {
  /** Goods received against a purchase order. Inbound, recomputes average cost. */
  PURCHASE = 'PURCHASE',
  /** Sold to a customer. Outbound. */
  SALE = 'SALE',
  /** A customer returned goods. Inbound, at the cost the sale recorded. */
  SALE_RETURN = 'SALE_RETURN',
  /** Returned to a supplier. Outbound. */
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  /** A physical count differed from the book. Signed either way. */
  ADJUSTMENT = 'ADJUSTMENT',
  /** Arrived from another location. Inbound half of a transfer. */
  TRANSFER_IN = 'TRANSFER_IN',
  /** Left for another location. Outbound half of a transfer. */
  TRANSFER_OUT = 'TRANSFER_OUT',
  /** Stock that existed before the system did. Inbound, sets the cost basis. */
  OPENING = 'OPENING',
  /** Damaged, expired, or stolen. Outbound, and reported separately from sales. */
  WRITE_OFF = 'WRITE_OFF',
}

/** Movements that increase stock, and so recompute weighted-average cost. */
export const INBOUND_REASONS: readonly STOCK_REASON[] = [
  STOCK_REASON.PURCHASE,
  STOCK_REASON.SALE_RETURN,
  STOCK_REASON.TRANSFER_IN,
  STOCK_REASON.OPENING,
];

export enum TRANSFER_STATUS {
  DRAFT = 'DRAFT',
  /** Stock has left the source location but not yet arrived. */
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** The subject name for stock records in authorization rules. */
export const STOCK_SUBJECT = 'Stock';

/** The subject name for stock transfers in authorization rules. */
export const STOCK_TRANSFER_SUBJECT = 'StockTransfer';
