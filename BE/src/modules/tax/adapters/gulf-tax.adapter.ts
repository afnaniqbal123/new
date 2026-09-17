import { StandardTaxAdapter } from 'src/modules/tax/adapters/standard-tax.adapter';

/**
 * United Arab Emirates — VAT at a single standard rate, no secondary tax.
 *
 * Behaviourally identical to the standard adapter today; it exists so the
 * invoice says "VAT" rather than "Tax", and so that the UAE-specific rules
 * that do differ (reverse charge on imports, designated-zone supplies) have a
 * home when they are implemented rather than being bolted onto the shared
 * base class.
 */
export class UaeTaxAdapter extends StandardTaxAdapter {
  override readonly country = 'AE';
  override readonly taxLabel = 'VAT';
}

/**
 * Saudi Arabia — VAT, single standard rate.
 *
 * Same reasoning as the UAE adapter. ZATCA e-invoicing (Fatoora) is
 * deliberately out of scope, for the same reason FBR fiscalization is:
 * it requires accreditation this product does not hold.
 */
export class SaudiTaxAdapter extends StandardTaxAdapter {
  override readonly country = 'SA';
  override readonly taxLabel = 'VAT';
}

/**
 * United Kingdom — VAT, single standard rate.
 */
export class UkTaxAdapter extends StandardTaxAdapter {
  override readonly country = 'GB';
  override readonly taxLabel = 'VAT';
}
