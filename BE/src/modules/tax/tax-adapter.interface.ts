import { TAX_TREATMENT } from 'src/modules/catalog/constants/catalog.constant';
import { Minor } from 'src/utils/money';

/**
 * Everything a tax calculation is allowed to depend on.
 *
 * Deliberately a plain value object with no database access: an adapter that
 * could query would become impossible to test exhaustively, and tax rules are
 * exactly the code that must be tested exhaustively.
 */
export interface TaxContext {
  /** ISO 3166-1 alpha-2. Selects the adapter. */
  country: string;
  /** The Organization's standard rate, as a percentage. */
  defaultRatePercent: number;
  /** Whether catalogue prices already contain tax. */
  pricesIncludeTax: boolean;
  /** Additional rate on supplies to unregistered buyers. 0 disables it. */
  furtherTaxPercent: number;
  /**
   * Whether the *buyer* holds a tax registration.
   *
   * Drives PK's "further tax" and equivalents elsewhere. Unknown is treated
   * as unregistered, which is the conservative direction: charging the extra
   * and refunding is recoverable, under-collecting is a liability.
   */
  buyerRegistered: boolean;
}

/** One line as presented to the tax engine. */
export interface TaxLineInput {
  /**
   * The line amount after discount.
   *
   * Whether this is tax-inclusive is decided by `TaxContext.pricesIncludeTax`,
   * not by the caller — one setting, read in one place, so a line and its
   * invoice total cannot disagree about what the number meant.
   */
  amount: Minor;
  /** Product-level override. Null inherits the organization default. */
  ratePercent: number | null;
  treatment: TAX_TREATMENT;
}

/** What the engine returns for one line. Every field is minor units. */
export interface TaxLineResult {
  /** The amount tax is charged on, exclusive of tax. */
  taxable: Minor;
  /** Primary tax (GST/VAT/sales tax). */
  tax: Minor;
  /** Secondary tax, where the jurisdiction has one. PK's further tax. */
  additionalTax: Minor;
  /** `taxable + tax + additionalTax`. What the customer pays for this line. */
  total: Minor;
  /** The rate actually applied, for display on the invoice. */
  appliedRatePercent: number;
}

/**
 * A country's tax rules.
 *
 * This is the seam that makes the product global without making it
 * multi-jurisdictional on day one (CONTEXT.md D7). The engine is written once;
 * a new country is a new implementation of this interface plus a registration,
 * with no change to sales, purchasing, or reporting.
 *
 * What an adapter must never do: decide *whether* a sale may proceed, read the
 * database, or round differently from `money.ts`. It computes amounts from the
 * inputs it is given, and nothing else.
 */
export interface TaxAdapter {
  /** ISO 3166-1 alpha-2 this adapter serves, or `*` for the fallback. */
  readonly country: string;

  /** Human-readable name of the tax, for invoice labelling. GST, VAT, … */
  readonly taxLabel: string;

  /** Label for the secondary tax, when the jurisdiction has one. */
  readonly additionalTaxLabel?: string;

  calculateLine(line: TaxLineInput, context: TaxContext): TaxLineResult;
}
