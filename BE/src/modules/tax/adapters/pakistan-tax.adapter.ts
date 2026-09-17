import { StandardTaxAdapter } from 'src/modules/tax/adapters/standard-tax.adapter';
import { TaxContext } from 'src/modules/tax/tax-adapter.interface';
import { percentOf } from 'src/utils/money';

/**
 * Pakistan — sales tax under the Sales Tax Act 1990.
 *
 * Two things differ from the standard single-rate regime:
 *
 * 1. **Further tax.** A supply to a buyer with no sales-tax registration
 *    attracts an additional rate on top of the standard one. It is charged on
 *    the taxable value, not on the tax, and it does not apply to exempt or
 *    zero-rated supplies — those are outside the charge entirely.
 *
 * 2. **The rate is configuration, not a constant.** The standard rate has
 *    moved more than once, and moves by notification rather than on a
 *    schedule. It lives in `Organization.tax.defaultRatePercent`, and the
 *    number a business is actually registered at is the one that applies —
 *    hardcoding today's figure here would make the next change a deployment.
 *
 * Deliberately **not** implemented: FBR fiscalization / POS invoice
 * integration. That requires registration and licensing this product does not
 * hold, and claiming a compliance guarantee that is not real is a liability
 * rather than a feature. CONTEXT.md D7.
 */
export class PakistanTaxAdapter extends StandardTaxAdapter {
  override readonly country = 'PK';
  override readonly taxLabel = 'GST';
  override readonly additionalTaxLabel = 'Further Tax';

  /**
   * Further tax applies only to a registered seller supplying an unregistered
   * buyer, and only to a supply that is actually within the charge.
   *
   * The `buyerRegistered` default is conservative: a customer record with no
   * registration number recorded is treated as unregistered, because
   * over-collecting is recoverable and under-collecting is not.
   */
  protected override calculateAdditionalTax(
    taxable: number,
    context: TaxContext,
  ): number {
    if (context.buyerRegistered) return 0;
    if (context.furtherTaxPercent <= 0) return 0;

    return percentOf(taxable, context.furtherTaxPercent);
  }
}
