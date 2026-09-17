import { Injectable } from '@nestjs/common';
import { StandardTaxAdapter } from 'src/modules/tax/adapters/standard-tax.adapter';
import { PakistanTaxAdapter } from 'src/modules/tax/adapters/pakistan-tax.adapter';
import {
  SaudiTaxAdapter,
  UaeTaxAdapter,
  UkTaxAdapter,
} from 'src/modules/tax/adapters/gulf-tax.adapter';
import {
  TaxAdapter,
  TaxContext,
  TaxLineInput,
  TaxLineResult,
} from 'src/modules/tax/tax-adapter.interface';
import { Minor } from 'src/utils/money';

/** The tax outcome for a whole document, with the per-line detail kept. */
export interface TaxTotals {
  lines: TaxLineResult[];
  /** Sum of taxable amounts — the invoice's net total. */
  netTotal: Minor;
  taxTotal: Minor;
  additionalTaxTotal: Minor;
  /** `netTotal + taxTotal + additionalTaxTotal`. */
  grossTotal: Minor;
  taxLabel: string;
  additionalTaxLabel?: string;
}

/**
 * Resolves the right country adapter and runs it.
 *
 * The only entry point for tax arithmetic in the system. Sales, purchasing
 * and quotations all call `calculate`, so a rate is interpreted the same way
 * everywhere — which is the whole point of having an engine rather than a
 * multiplication at each call site.
 *
 * Note what this service does *not* do: it never reads the database, and it
 * never decides whether a document may be saved. It is a pure function with a
 * lookup table in front of it, which is what makes the tax rules exhaustively
 * testable. CONTEXT.md D7.
 */
@Injectable()
export class TaxService {
  private readonly fallback = new StandardTaxAdapter();

  /**
   * Registered adapters, by ISO country code.
   *
   * A plain Map rather than Nest providers: adapters are stateless value
   * objects with no dependencies, and making each one injectable would add
   * wiring without adding anything. Adding a country is one line here plus
   * the adapter file.
   */
  private readonly adapters = new Map<string, TaxAdapter>(
    [
      new PakistanTaxAdapter(),
      new UaeTaxAdapter(),
      new SaudiTaxAdapter(),
      new UkTaxAdapter(),
    ].map((adapter) => [adapter.country, adapter]),
  );

  /**
   * The adapter for a country, or the standard single-rate one.
   *
   * Falling back rather than throwing is deliberate: a business in an
   * unmodelled jurisdiction gets correct single-rate arithmetic at its own
   * configured rate, which is right far more often than it is wrong — and
   * infinitely better than being unable to issue an invoice at all.
   */
  getAdapter(country: string): TaxAdapter {
    return this.adapters.get(country.toUpperCase()) ?? this.fallback;
  }

  /** Whether a country has rules of its own, for the settings screen. */
  isCountrySupported(country: string): boolean {
    return this.adapters.has(country.toUpperCase());
  }

  /** Every country with a dedicated adapter. */
  supportedCountries(): string[] {
    return [...this.adapters.keys()];
  }

  calculateLine(line: TaxLineInput, context: TaxContext): TaxLineResult {
    return this.getAdapter(context.country).calculateLine(line, context);
  }

  /**
   * Tax for a whole document.
   *
   * Totals are summed from the per-line results rather than recomputed on the
   * document total. Those are not the same number when rounding is involved,
   * and the invoice must add up line by line — a customer checking the
   * arithmetic by hand is the person this matters to.
   */
  calculate(lines: readonly TaxLineInput[], context: TaxContext): TaxTotals {
    const adapter = this.getAdapter(context.country);
    const results = lines.map((line) => adapter.calculateLine(line, context));

    let netTotal = 0;
    let taxTotal = 0;
    let additionalTaxTotal = 0;

    for (const result of results) {
      netTotal += result.taxable;
      taxTotal += result.tax;
      additionalTaxTotal += result.additionalTax;
    }

    return {
      lines: results,
      netTotal,
      taxTotal,
      additionalTaxTotal,
      grossTotal: netTotal + taxTotal + additionalTaxTotal,
      taxLabel: adapter.taxLabel,
      additionalTaxLabel: adapter.additionalTaxLabel,
    };
  }
}
