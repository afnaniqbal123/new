import { TAX_TREATMENT } from 'src/modules/catalog/constants/catalog.constant';
import {
  TaxAdapter,
  TaxContext,
  TaxLineInput,
  TaxLineResult,
} from 'src/modules/tax/tax-adapter.interface';
import { percentOf, taxFromInclusive } from 'src/utils/money';

/**
 * A single-rate VAT/GST regime with no secondary tax.
 *
 * The fallback adapter, and the base class the country-specific ones extend.
 * It implements the part that is genuinely universal — exempt and zero-rated
 * supplies charge nothing, inclusive prices have their tax extracted rather
 * than added — leaving subclasses only the part that actually differs.
 *
 * Used directly for any country without its own adapter, which is deliberate:
 * a business in an unmodelled jurisdiction gets correct single-rate
 * arithmetic rather than an error, and can set its own rate.
 */
export class StandardTaxAdapter implements TaxAdapter {
  readonly country: string = '*';
  readonly taxLabel: string = 'Tax';
  /** Declared here, undefined by default, so subclasses can name a secondary tax. */
  readonly additionalTaxLabel?: string;

  calculateLine(line: TaxLineInput, context: TaxContext): TaxLineResult {
    const rate = this.resolveRate(line, context);

    // Exempt and zero-rated both charge nothing, but they are distinct on the
    // invoice and in the return — which is why the catalogue keeps them apart
    // rather than collapsing both to "0%". See TAX_TREATMENT.
    if (rate === 0) {
      return {
        taxable: line.amount,
        tax: 0,
        additionalTax: 0,
        total: line.amount,
        appliedRatePercent: 0,
      };
    }

    if (context.pricesIncludeTax) {
      // The line amount already contains the tax, so it is extracted rather
      // than added — adding would charge tax on tax.
      const tax = taxFromInclusive(line.amount, rate);
      const taxable = line.amount - tax;
      const additionalTax = this.calculateAdditionalTax(taxable, context);

      return {
        taxable,
        tax,
        additionalTax,
        total: taxable + tax + additionalTax,
        appliedRatePercent: rate,
      };
    }

    const tax = percentOf(line.amount, rate);
    const additionalTax = this.calculateAdditionalTax(line.amount, context);

    return {
      taxable: line.amount,
      tax,
      additionalTax,
      total: line.amount + tax + additionalTax,
      appliedRatePercent: rate,
    };
  }

  /**
   * The rate for this line: the product's override if it has one, otherwise
   * the Organization's default.
   *
   * `null` means "inherit"; `0` means "explicitly zero-rated". Collapsing the
   * two would make a zero-rated product silently pick up the standard rate,
   * which is a tax error, not a display bug — hence the nullable field on the
   * product rather than a defaulted one.
   */
  protected resolveRate(line: TaxLineInput, context: TaxContext): number {
    if (line.treatment === TAX_TREATMENT.EXEMPT) return 0;
    if (line.treatment === TAX_TREATMENT.ZERO_RATED) return 0;

    return line.ratePercent ?? context.defaultRatePercent;
  }

  /**
   * Secondary tax. None in the standard regime — overridden where a
   * jurisdiction has one.
   */
  protected calculateAdditionalTax(
    _taxable: number,
    _context: TaxContext,
  ): number {
    return 0;
  }
}
