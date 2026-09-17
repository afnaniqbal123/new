import { HttpStatus } from '@nestjs/common';
import { GENERAL_ERRORS } from 'src/constants/api-response/general.response';
import { SerializeHttpError } from 'src/utils/serializer';

/**
 * Money, as an integer count of minor units (paisa, cents, fils).
 *
 * Every monetary value in this system is one of these. Never a float, never a
 * `Number` holding rupees. Mongoose's `Number` is an IEEE-754 double, and a
 * double cannot represent 0.1 — which is how a credit ledger that looks right
 * on Monday is off by a rupee on Friday. See CONTEXT.md D4.
 *
 * The currency itself lives on the Organization, not on every field: a single
 * Organization transacts in one currency, so carrying the code on each amount
 * would be noise that can disagree with itself. Formatting happens at the
 * edges — the API returns minor units, the UI renders them.
 */

/** A monetary amount in minor units. Always an integer. */
export type Minor = number;

/**
 * How many minor units make one major unit, per ISO 4217.
 *
 * Only currencies this product actually targets are listed. An unlisted code
 * falls back to 2, which is right for the overwhelming majority — but the
 * zero-decimal ones below would silently inflate by 100x without an entry,
 * so those are the ones that matter.
 */
const MINOR_UNITS_PER_MAJOR: Readonly<Record<string, number>> = {
  PKR: 100,
  AED: 100,
  SAR: 100,
  USD: 100,
  GBP: 100,
  EUR: 100,
  // Zero-decimal currencies. Listed because getting these wrong is a 100x
  // error, not a rounding difference.
  JPY: 1,
  KWD: 1000,
  BHD: 1000,
  OMR: 1000,
};

const DEFAULT_MINOR_UNITS = 100;

export function minorUnitsFor(currency: string): number {
  return MINOR_UNITS_PER_MAJOR[currency.toUpperCase()] ?? DEFAULT_MINOR_UNITS;
}

/**
 * Exact decimal-string path for `toMinor`.
 *
 * Shifts the decimal point by character manipulation instead of multiplying,
 * so "1.005" becomes 101 rather than 100. Multiplying would not: the double
 * nearest 1.005 is 1.00499999999999989, and no amount of rounding recovers
 * the digit the parse already lost. A string is what an API request body
 * should carry for money, precisely so this path is available.
 *
 * Returns null for anything that is not a plain decimal numeral, letting the
 * caller fall back to the numeric path (exponent notation, whitespace, etc).
 */
function exactDecimalToMinor(input: string, factor: number): Minor | null {
  const match = /^\s*(-)?(\d*)(?:\.(\d*))?\s*$/.exec(input);

  if (!match) return null;

  const [, sign, whole = '', fraction = ''] = match;

  if (whole === '' && fraction === '') return null;

  const digits = Math.round(Math.log10(factor));
  // One extra digit is kept so the discarded remainder can be inspected for
  // the half-up decision, rather than truncated away silently.
  const padded = fraction.padEnd(digits + 1, '0');
  const kept = padded.slice(0, digits);
  const next = padded.charCodeAt(digits) - 48;

  const magnitude = Number(`${whole || '0'}${kept}`) + (next >= 5 ? 1 : 0);

  return sign === '-' ? -magnitude : magnitude;
}

/**
 * Parses a human-entered major-unit amount ("1234.56") into minor units.
 *
 * Rounds half-up at the currency's precision. Throws on a value that is not
 * finite, because a NaN that reaches a ledger is unrecoverable — it poisons
 * every subsequent total silently.
 *
 * Prefer passing a string. A JSON number has already been through a double by
 * the time it reaches here, so `1.005` is genuinely no longer 1.005 and the
 * epsilon nudge below is the best that can be done with it.
 */
export function toMinor(major: number | string, currency: string): Minor {
  const factor = minorUnitsFor(currency);

  if (typeof major === 'string') {
    const exact = exactDecimalToMinor(major, factor);
    if (exact !== null) return exact;
  }

  const value = typeof major === 'string' ? Number(major) : major;

  if (!Number.isFinite(value)) {
    // A malformed amount is a bad request, not an internal fault — a NaN that
    // reaches a ledger is unrecoverable, so it is refused at the boundary in
    // the same envelope every other refusal uses.
    return SerializeHttpError(
      null,
      HttpStatus.BAD_REQUEST,
      GENERAL_ERRORS.VALIDATION_ERROR,
    );
  }

  // Counteracts binary representation error before rounding: 1.005 * 100 is
  // 100.49999999999999 as a double, which would otherwise round down to 100.
  const scaled = value * factor;
  const nudged = scaled * (1 + Number.EPSILON);

  return nudged < 0 ? -Math.round(-nudged) : Math.round(nudged);
}

/** Renders minor units back to a major-unit number, for display only. */
export function toMajor(minor: Minor, currency: string): number {
  return minor / minorUnitsFor(currency);
}

/**
 * Multiplies an amount by a quantity, which may be fractional (2.5 kg).
 *
 * Rounds half-away-from-zero so that a refund of the same line returns
 * exactly what was charged — banker's rounding would not, and a one-paisa
 * residue on a returned line is a support ticket.
 */
export function multiply(amount: Minor, quantity: number): Minor {
  const product = amount * quantity;
  return product < 0 ? -Math.round(-product) : Math.round(product);
}

/**
 * Applies a percentage (18 means 18%) to an amount.
 *
 * Used for both tax and percentage discounts, so it rounds the same way in
 * both — a discount and the tax on it must not disagree about the last unit.
 */
export function percentOf(amount: Minor, percent: number): Minor {
  return multiply(amount, percent / 100);
}

/**
 * Extracts the tax already contained in a tax-inclusive amount.
 *
 * `gross * rate / (100 + rate)`. Distributors quote inclusive prices as often
 * as exclusive ones, and deriving this at the call site is where sign and
 * rounding mistakes live.
 */
export function taxFromInclusive(gross: Minor, percent: number): Minor {
  if (percent === 0) return 0;
  return multiply(gross, percent / (100 + percent));
}

/**
 * Splits an amount into `parts` pieces that sum back to exactly the original.
 *
 * The remainder is distributed one minor unit at a time across the leading
 * parts, so nothing is lost or invented. Used when allocating a single
 * payment across several invoices.
 */
export function allocate(amount: Minor, parts: number): Minor[] {
  if (parts <= 0) return [];

  const base = Math.trunc(amount / parts);
  const result = new Array<Minor>(parts).fill(base);
  let remainder = amount - base * parts;
  const step = remainder < 0 ? -1 : 1;

  for (let i = 0; remainder !== 0; i = (i + 1) % parts) {
    result[i] += step;
    remainder -= step;
  }

  return result;
}

/**
 * Sums minor-unit amounts. Trivial, but named so that a `reduce` with an
 * accidental string concatenation cannot hide inside a total.
 */
export function sum(amounts: readonly Minor[]): Minor {
  return amounts.reduce<Minor>((total, amount) => total + amount, 0);
}

/**
 * Recomputes a moving weighted-average unit cost after an inbound movement.
 *
 * This is the single implementation of CONTEXT.md D3 — every goods receipt,
 * opening balance and positive adjustment routes through it, so cost basis
 * cannot drift between entry points.
 *
 * Returns the existing cost unchanged when the resulting quantity is zero or
 * negative: there is no meaningful average cost of nothing, and zeroing it
 * would discard the basis needed the next time stock arrives.
 */
export function movingAverageCost(
  currentQuantity: number,
  currentUnitCost: Minor,
  incomingQuantity: number,
  incomingUnitCost: Minor,
): Minor {
  const totalQuantity = currentQuantity + incomingQuantity;

  if (totalQuantity <= 0) {
    return currentUnitCost;
  }

  const currentValue = multiply(currentUnitCost, currentQuantity);
  const incomingValue = multiply(incomingUnitCost, incomingQuantity);

  return Math.round((currentValue + incomingValue) / totalQuantity);
}
