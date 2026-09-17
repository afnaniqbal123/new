/**
 * Money, on the client side.
 *
 * The API speaks exclusively in **integer minor units** (paisa, cents) — see
 * CONTEXT.md D4. Nothing in this file changes that: these functions convert
 * for *display* and parse *human input*, and the integer is what crosses the
 * wire in both directions.
 *
 * The one rule that matters: never do arithmetic on a major-unit number.
 * Convert at the edges — here — and let every total, subtotal and balance in
 * between stay an integer.
 */

/** How many minor units make one major unit. Mirrors the backend's table. */
const MINOR_UNITS_PER_MAJOR: Readonly<Record<string, number>> = {
  PKR: 100,
  AED: 100,
  SAR: 100,
  USD: 100,
  GBP: 100,
  EUR: 100,
  JPY: 1,
  KWD: 1000,
  BHD: 1000,
  OMR: 1000,
};

const DEFAULT_MINOR_UNITS = 100;

export function minorUnitsFor(currency: string): number {
  return MINOR_UNITS_PER_MAJOR[currency.toUpperCase()] ?? DEFAULT_MINOR_UNITS;
}

function decimalsFor(currency: string): number {
  return Math.round(Math.log10(minorUnitsFor(currency)));
}

/**
 * Formats minor units as a currency string.
 *
 * Uses `Intl.NumberFormat`, so a PKR amount renders with the grouping a
 * Pakistani reader expects rather than a hand-rolled thousands separator.
 * Falls back to the code-plus-number form for a currency the runtime does not
 * know, which is better than throwing on a screen full of totals.
 */
export function formatMoney(
  minor: number,
  currency: string,
  options: { compact?: boolean; showCurrency?: boolean } = {}
): string {
  const decimals = decimalsFor(currency);
  const major = minor / minorUnitsFor(currency);

  try {
    return new Intl.NumberFormat(undefined, {
      style: options.showCurrency === false ? 'decimal' : 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      // Compact for dashboard tiles, where "PKR 1.2M" beats a number so long
      // it wraps; full precision everywhere a figure might be reconciled.
      notation: options.compact ? 'compact' : 'standard',
      minimumFractionDigits: options.compact ? 0 : decimals,
      maximumFractionDigits: options.compact ? 1 : decimals,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(decimals)}`;
  }
}

/** The number alone, grouped but unlabelled — for table columns with a header. */
export function formatAmount(minor: number, currency: string): string {
  return formatMoney(minor, currency, { showCurrency: false });
}

/**
 * Parses what a person typed into minor units.
 *
 * Works on the **string**, never on a parsed float: `parseFloat('1.005') *
 * 100` is 100.49999999999999, and rounding that gives the wrong paisa. The
 * digits the user typed are still intact here, so shifting the decimal point
 * by string manipulation is exact — the same approach the backend takes.
 *
 * Returns null for anything unparseable, so a form can show a validation
 * message rather than silently submitting a zero.
 */
export function parseMoney(input: string, currency: string): number | null {
  const trimmed = input.trim().replace(/[\s,]/g, '');

  if (trimmed === '') return null;

  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(trimmed);

  if (!match) return null;

  const [, sign, whole = '', fraction = ''] = match;

  if (whole === '' && fraction === '') return null;

  const digits = decimalsFor(currency);
  // One digit beyond the currency's precision is kept so the discarded
  // remainder can decide the rounding rather than being truncated away.
  const padded = fraction.padEnd(digits + 1, '0');
  const kept = padded.slice(0, digits);
  const next = padded.charCodeAt(digits) - 48;

  const magnitude = Number(`${whole || '0'}${kept}`) + (next >= 5 ? 1 : 0);

  return sign === '-' ? -magnitude : magnitude;
}

/**
 * Renders minor units as the plain decimal string a form input should hold.
 *
 * Deliberately unformatted — no grouping, no symbol. A separator inside an
 * `<input>` is something the user then has to delete before they can type.
 */
export function toInputValue(minor: number, currency: string): string {
  return (minor / minorUnitsFor(currency)).toFixed(decimalsFor(currency));
}

/**
 * Formats a percentage for display.
 *
 * Whole numbers stay whole: "18%" rather than "18.0%", because a tax rate
 * quoted to one decimal implies a precision the rate does not have.
 */
export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? String(value) : value.toFixed(1)}%`;
}

/**
 * Formats a quantity.
 *
 * Fractional quantities are real — goods sold by weight — but a whole number
 * of cartons should not render as "24.000". Trailing zeros are trimmed.
 */
export function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
