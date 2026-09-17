/**
 * The named reports the system can produce.
 *
 * A closed enum, and that is the point: it is also the *tool surface* the AI
 * clerk selects from. The model picks which report to run and with what
 * arguments; the code does the arithmetic. A free-form query interface would
 * put the model between a question and a number, which CONTEXT.md D9 forbids.
 */
export enum REPORT_KIND {
  SALES_SUMMARY = 'SALES_SUMMARY',
  SALES_BY_DAY = 'SALES_BY_DAY',
  TOP_PRODUCTS = 'TOP_PRODUCTS',
  TOP_CUSTOMERS = 'TOP_CUSTOMERS',
  PROFIT = 'PROFIT',
  RECEIVABLES_AGING = 'RECEIVABLES_AGING',
  PAYABLES = 'PAYABLES',
  LOW_STOCK = 'LOW_STOCK',
  STOCK_VALUATION = 'STOCK_VALUATION',
  DEAD_STOCK = 'DEAD_STOCK',
  EXPIRING_STOCK = 'EXPIRING_STOCK',
  PURCHASES_SUMMARY = 'PURCHASES_SUMMARY',
  CASH_POSITION = 'CASH_POSITION',
}

/** Named ranges, resolved server-side against the organization's timezone. */
export enum REPORT_PERIOD {
  TODAY = 'TODAY',
  YESTERDAY = 'YESTERDAY',
  THIS_WEEK = 'THIS_WEEK',
  LAST_7_DAYS = 'LAST_7_DAYS',
  THIS_MONTH = 'THIS_MONTH',
  LAST_MONTH = 'LAST_MONTH',
  LAST_30_DAYS = 'LAST_30_DAYS',
  THIS_YEAR = 'THIS_YEAR',
  CUSTOM = 'CUSTOM',
}

/** The subject name for reports in authorization rules. */
export const REPORT_SUBJECT = 'Report';

/**
 * Profit and margin are their own subject.
 *
 * The same reasoning as `PRODUCT_COST_SUBJECT`: a cashier may see what was
 * sold without seeing what it earned. Splitting the subject is what lets one
 * role read the sales report and another read the profit report.
 */
export const PROFIT_REPORT_SUBJECT = 'ProfitReport';

/**
 * Reports whose entire content is margin.
 *
 * Defined once and imported by the controller (which refuses them), the AI
 * clerk (which will not route a question to them), and the pricing of the
 * report picker. Three separate copies of this list is how a new margin
 * report ends up gated in two places out of three.
 */
export const PROFIT_REPORTS: ReadonlySet<REPORT_KIND> = new Set([
  REPORT_KIND.PROFIT,
  REPORT_KIND.TOP_PRODUCTS,
  REPORT_KIND.DEAD_STOCK,
  REPORT_KIND.STOCK_VALUATION,
]);
