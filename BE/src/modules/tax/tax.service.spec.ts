import { TaxService } from 'src/modules/tax/tax.service';
import {
  TaxContext,
  TaxLineInput,
} from 'src/modules/tax/tax-adapter.interface';
import { TAX_TREATMENT } from 'src/modules/catalog/constants/catalog.constant';

/**
 * Tax is the arithmetic a business gets audited on, so it is tested
 * exhaustively rather than sampled. Every case here is a rule from
 * CONTEXT.md D7 or the adapter doc comments.
 */
describe('TaxService', () => {
  const service = new TaxService();

  const context = (overrides: Partial<TaxContext> = {}): TaxContext => ({
    country: 'PK',
    defaultRatePercent: 18,
    pricesIncludeTax: false,
    furtherTaxPercent: 3,
    buyerRegistered: true,
    ...overrides,
  });

  const line = (overrides: Partial<TaxLineInput> = {}): TaxLineInput => ({
    amount: 100000,
    ratePercent: null,
    treatment: TAX_TREATMENT.STANDARD,
    ...overrides,
  });

  describe('adapter resolution', () => {
    it('selects the country adapter', () => {
      expect(service.getAdapter('PK').taxLabel).toBe('GST');
      expect(service.getAdapter('AE').taxLabel).toBe('VAT');
      expect(service.getAdapter('GB').taxLabel).toBe('VAT');
    });

    it('is case-insensitive', () => {
      expect(service.getAdapter('pk').country).toBe('PK');
    });

    it('falls back rather than failing for an unmodelled country', () => {
      // A business in an unmodelled jurisdiction must still be able to issue
      // an invoice, at its own configured rate.
      const adapter = service.getAdapter('NZ');

      expect(adapter.country).toBe('*');
      expect(
        adapter.calculateLine(line(), context({ country: 'NZ' })).tax,
      ).toBe(18000);
    });

    it('reports which countries have dedicated rules', () => {
      expect(service.isCountrySupported('PK')).toBe(true);
      expect(service.isCountrySupported('NZ')).toBe(false);
      expect(service.supportedCountries()).toEqual(
        expect.arrayContaining(['PK', 'AE', 'SA', 'GB']),
      );
    });
  });

  describe('tax-exclusive pricing', () => {
    it('adds tax on top of the line amount', () => {
      const result = service.calculateLine(line(), context());

      expect(result.taxable).toBe(100000);
      expect(result.tax).toBe(18000);
      expect(result.total).toBe(118000);
      expect(result.appliedRatePercent).toBe(18);
    });

    it('prefers a product-level rate over the organization default', () => {
      const result = service.calculateLine(line({ ratePercent: 5 }), context());

      expect(result.tax).toBe(5000);
      expect(result.appliedRatePercent).toBe(5);
    });
  });

  describe('tax-inclusive pricing', () => {
    it('extracts tax instead of adding it', () => {
      // 118000 inclusive of 18% is 100000 net + 18000 tax — the customer pays
      // the same 118000 either way, which is the property that matters.
      const result = service.calculateLine(
        line({ amount: 118000 }),
        context({ pricesIncludeTax: true }),
      );

      expect(result.taxable).toBe(100000);
      expect(result.tax).toBe(18000);
      expect(result.total).toBe(118000);
    });

    it('never charges tax on tax', () => {
      const inclusive = service.calculateLine(
        line({ amount: 118000 }),
        context({ pricesIncludeTax: true }),
      );

      expect(inclusive.taxable + inclusive.tax).toBe(118000);
    });
  });

  describe('treatment', () => {
    it('charges nothing on an exempt supply', () => {
      const result = service.calculateLine(
        line({ treatment: TAX_TREATMENT.EXEMPT }),
        context(),
      );

      expect(result.tax).toBe(0);
      expect(result.additionalTax).toBe(0);
      expect(result.total).toBe(100000);
    });

    it('charges nothing on a zero-rated supply', () => {
      const result = service.calculateLine(
        line({ treatment: TAX_TREATMENT.ZERO_RATED }),
        context(),
      );

      expect(result.tax).toBe(0);
      expect(result.total).toBe(100000);
    });

    it('honours an explicit 0% override without inheriting the default', () => {
      // `0` means zero-rated; `null` means inherit. Collapsing the two would
      // silently apply 18% to a zero-rated product.
      const result = service.calculateLine(line({ ratePercent: 0 }), context());

      expect(result.tax).toBe(0);
    });
  });

  describe('Pakistan further tax', () => {
    it('is not charged to a registered buyer', () => {
      const result = service.calculateLine(
        line(),
        context({ buyerRegistered: true }),
      );

      expect(result.additionalTax).toBe(0);
      expect(result.total).toBe(118000);
    });

    it('is charged to an unregistered buyer, on the taxable value', () => {
      const result = service.calculateLine(
        line(),
        context({ buyerRegistered: false }),
      );

      // 3% of 100000 (the net), not of 118000 (net plus GST).
      expect(result.additionalTax).toBe(3000);
      expect(result.total).toBe(121000);
    });

    it('is not charged on an exempt supply, registered or not', () => {
      const result = service.calculateLine(
        line({ treatment: TAX_TREATMENT.EXEMPT }),
        context({ buyerRegistered: false }),
      );

      expect(result.additionalTax).toBe(0);
      expect(result.total).toBe(100000);
    });

    it('is disabled by setting the rate to zero', () => {
      const result = service.calculateLine(
        line(),
        context({ buyerRegistered: false, furtherTaxPercent: 0 }),
      );

      expect(result.additionalTax).toBe(0);
    });

    it('applies on tax-inclusive pricing too, on the extracted net', () => {
      const result = service.calculateLine(
        line({ amount: 118000 }),
        context({ pricesIncludeTax: true, buyerRegistered: false }),
      );

      expect(result.taxable).toBe(100000);
      expect(result.additionalTax).toBe(3000);
    });
  });

  describe('other jurisdictions', () => {
    it('charges no further tax outside Pakistan, even when configured', () => {
      // The UAE adapter has no secondary tax. A stray furtherTaxPercent left
      // in configuration must not leak into a UAE invoice.
      const result = service.calculateLine(
        line(),
        context({
          country: 'AE',
          defaultRatePercent: 5,
          buyerRegistered: false,
        }),
      );

      expect(result.tax).toBe(5000);
      expect(result.additionalTax).toBe(0);
      expect(result.total).toBe(105000);
    });
  });

  describe('document totals', () => {
    it('sums the per-line results rather than recomputing on the total', () => {
      // The invoice must add up line by line — a customer checking it by hand
      // is the person this protects.
      const totals = service.calculate(
        [
          line({ amount: 33333 }),
          line({ amount: 33333 }),
          line({ amount: 33334 }),
        ],
        context(),
      );

      const lineTaxSum = totals.lines.reduce((sum, l) => sum + l.tax, 0);

      expect(totals.taxTotal).toBe(lineTaxSum);
      expect(totals.netTotal).toBe(100000);
      expect(totals.grossTotal).toBe(
        totals.netTotal + totals.taxTotal + totals.additionalTaxTotal,
      );
    });

    it('mixes treatments within one document', () => {
      const totals = service.calculate(
        [
          line({ amount: 100000 }),
          line({ amount: 50000, treatment: TAX_TREATMENT.EXEMPT }),
        ],
        context(),
      );

      expect(totals.netTotal).toBe(150000);
      expect(totals.taxTotal).toBe(18000);
      expect(totals.grossTotal).toBe(168000);
    });

    it('labels the tax for the invoice', () => {
      expect(service.calculate([line()], context()).taxLabel).toBe('GST');
      expect(
        service.calculate([line()], context({ country: 'GB' })).taxLabel,
      ).toBe('VAT');
    });

    it('handles an empty document', () => {
      const totals = service.calculate([], context());

      expect(totals.grossTotal).toBe(0);
      expect(totals.lines).toEqual([]);
    });
  });
});
