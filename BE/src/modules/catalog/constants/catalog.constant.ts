export enum PRODUCT_STATUS {
  ACTIVE = 'ACTIVE',
  /** Still sellable from remaining stock, hidden from new purchase orders. */
  DISCONTINUED = 'DISCONTINUED',
  /** Hidden everywhere. Retained because sales history references it. */
  ARCHIVED = 'ARCHIVED',
}

/**
 * How a product is treated for tax, independent of the rate.
 *
 * The distinction matters on the invoice, not just in the arithmetic: an
 * exempt supply and a zero-rated one both add nothing, but must be reported
 * and printed differently. Collapsing them into "0%" loses that.
 */
export enum TAX_TREATMENT {
  STANDARD = 'STANDARD',
  ZERO_RATED = 'ZERO_RATED',
  EXEMPT = 'EXEMPT',
}

/** The subject name for product records in authorization rules. */
export const PRODUCT_SUBJECT = 'Product';

/** The subject name for category records in authorization rules. */
export const CATEGORY_SUBJECT = 'Category';

/**
 * Cost price is deliberately a separate subject from the product itself.
 *
 * A CASHIER must read products to sell them, and must not see what they cost
 * — margin is not their business, and in a family firm it is actively
 * sensitive. Making it its own subject is what lets one role read a record
 * while another reads strictly fewer of its fields.
 */
export const PRODUCT_COST_SUBJECT = 'ProductCost';
