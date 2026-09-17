import {
  formatAmount,
  formatMoney,
  formatPercent,
  formatQuantity,
  minorUnitsFor,
  parseMoney,
  toInputValue,
} from 'src/utils/money';

/**
 * The client half of CONTEXT.md D4. `parseMoney` in particular is the single
 * point where a human's typing becomes an integer the API will trust, so it is
 * tested against the cases that actually break naive implementations.
 */
describe('money', () => {
  describe('minorUnitsFor', () => {
    it('knows the non-two-decimal currencies', () => {
      expect(minorUnitsFor('PKR')).toBe(100);
      expect(minorUnitsFor('JPY')).toBe(1);
      expect(minorUnitsFor('KWD')).toBe(1000);
    });

    it('is case-insensitive and defaults sensibly', () => {
      expect(minorUnitsFor('pkr')).toBe(100);
      expect(minorUnitsFor('NZD')).toBe(100);
    });
  });

  describe('parseMoney', () => {
    it('parses the string exactly, where multiplying a float cannot', () => {
      // parseFloat('1.005') * 100 is 100.49999999999999 — rounding that gives
      // 100 paisa, not 101. Working on the digits the user typed is exact.
      expect(parseMoney('1.005', 'PKR')).toBe(101);
      expect(parseMoney('0.615', 'PKR')).toBe(62);
    });

    it('handles ordinary amounts', () => {
      expect(parseMoney('1234.56', 'PKR')).toBe(123456);
      expect(parseMoney('100', 'PKR')).toBe(10000);
      expect(parseMoney('0.5', 'PKR')).toBe(50);
    });

    it('tolerates what people actually type', () => {
      expect(parseMoney(' 1,234.50 ', 'PKR')).toBe(123450);
      expect(parseMoney('12.', 'PKR')).toBe(1200);
      expect(parseMoney('.75', 'PKR')).toBe(75);
    });

    it('respects currency precision', () => {
      expect(parseMoney('1500', 'JPY')).toBe(1500);
      expect(parseMoney('1.2345', 'KWD')).toBe(1235);
    });

    it('handles a negative amount', () => {
      expect(parseMoney('-50.25', 'PKR')).toBe(-5025);
    });

    it('returns null rather than zero for unparseable input', () => {
      // Zero would silently submit; null lets the form say what is wrong.
      expect(parseMoney('', 'PKR')).toBeNull();
      expect(parseMoney('abc', 'PKR')).toBeNull();
      expect(parseMoney('1.2.3', 'PKR')).toBeNull();
      expect(parseMoney('   ', 'PKR')).toBeNull();
    });
  });

  describe('formatMoney', () => {
    it('renders an amount with its currency', () => {
      const formatted = formatMoney(123456, 'PKR');

      expect(formatted).toContain('1,234.56');
    });

    it('drops the symbol when asked', () => {
      expect(formatAmount(123456, 'PKR')).toBe('1,234.56');
    });

    it('compacts large figures for dashboard tiles', () => {
      const compact = formatMoney(1_234_567_89, 'PKR', { compact: true });

      expect(compact.length).toBeLessThan(12);
    });

    it('respects a zero-decimal currency', () => {
      expect(formatAmount(1500, 'JPY')).toBe('1,500');
    });

    it('falls back rather than throwing on an unknown currency', () => {
      // A screen full of totals must not blank out because one currency code
      // is unrecognised by the runtime.
      expect(formatMoney(10000, 'XYZ')).toContain('100');
    });
  });

  describe('toInputValue', () => {
    it('produces a plain editable decimal with no grouping', () => {
      expect(toInputValue(123456, 'PKR')).toBe('1234.56');
      expect(toInputValue(1500, 'JPY')).toBe('1500');
    });

    it('round-trips through parseMoney', () => {
      for (const amount of [0, 1, 99, 12345, 9999999]) {
        expect(parseMoney(toInputValue(amount, 'PKR'), 'PKR')).toBe(amount);
      }
    });
  });

  describe('formatPercent', () => {
    it('keeps whole numbers whole', () => {
      expect(formatPercent(18)).toBe('18%');
      expect(formatPercent(17.5)).toBe('17.5%');
    });
  });

  describe('formatQuantity', () => {
    it('does not pad a whole quantity with decimals', () => {
      expect(formatQuantity(24)).toBe('24');
      expect(formatQuantity(2.5)).toBe('2.5');
      expect(formatQuantity(0.125)).toBe('0.125');
    });
  });
});
