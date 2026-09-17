import { HttpException } from '@nestjs/common';
import {
  allocate,
  minorUnitsFor,
  movingAverageCost,
  multiply,
  percentOf,
  sum,
  taxFromInclusive,
  toMajor,
  toMinor,
} from 'src/utils/money';

describe('money', () => {
  describe('minorUnitsFor', () => {
    it('knows the zero- and three-decimal currencies', () => {
      expect(minorUnitsFor('JPY')).toBe(1);
      expect(minorUnitsFor('KWD')).toBe(1000);
      expect(minorUnitsFor('PKR')).toBe(100);
    });

    it('is case-insensitive', () => {
      expect(minorUnitsFor('pkr')).toBe(100);
    });

    it('falls back to 2 decimals for an unlisted currency', () => {
      expect(minorUnitsFor('NZD')).toBe(100);
    });
  });

  describe('toMinor', () => {
    it('converts the value floats get wrong', () => {
      // 0.1 + 0.2 !== 0.3 in IEEE-754. This is the entire reason D4 exists.
      expect(toMinor(0.1, 'PKR') + toMinor(0.2, 'PKR')).toBe(
        toMinor(0.3, 'PKR'),
      );
    });

    it('rounds half-up at the currency precision', () => {
      expect(toMinor(1.005, 'PKR')).toBe(101);
      expect(toMinor('1234.56', 'PKR')).toBe(123456);
    });

    it('respects a zero-decimal currency', () => {
      expect(toMinor(1500, 'JPY')).toBe(1500);
    });

    it('refuses a non-finite amount rather than poisoning a ledger', () => {
      // Refused through the response envelope, so a malformed amount reaches
      // the client as a 400 rather than an opaque 500.
      expect(() => toMinor(Number.NaN, 'PKR')).toThrow(HttpException);
      expect(() => toMinor('not a number', 'PKR')).toThrow(HttpException);
      expect(() => toMinor(Number.POSITIVE_INFINITY, 'PKR')).toThrow(
        HttpException,
      );
    });
  });

  describe('toMajor', () => {
    it('round-trips', () => {
      expect(toMajor(toMinor(99.99, 'PKR'), 'PKR')).toBe(99.99);
    });
  });

  describe('multiply', () => {
    it('handles fractional quantities', () => {
      expect(multiply(10000, 2.5)).toBe(25000);
    });

    it('rounds away from zero symmetrically, so a return matches its charge', () => {
      expect(multiply(101, 0.5)).toBe(51);
      expect(multiply(-101, 0.5)).toBe(-51);
    });
  });

  describe('percentOf', () => {
    it('computes standard GST', () => {
      expect(percentOf(100000, 18)).toBe(18000);
    });

    it('is zero at zero percent', () => {
      expect(percentOf(100000, 0)).toBe(0);
    });
  });

  describe('taxFromInclusive', () => {
    it('extracts tax already contained in a gross amount', () => {
      // 11800 inclusive of 18% == 10000 net + 1800 tax.
      expect(taxFromInclusive(11800, 18)).toBe(1800);
    });

    it('returns nothing for an exempt line', () => {
      expect(taxFromInclusive(11800, 0)).toBe(0);
    });

    it('agrees with percentOf on the round trip', () => {
      const net = 100000;
      const gross = net + percentOf(net, 18);
      expect(gross - taxFromInclusive(gross, 18)).toBe(net);
    });
  });

  describe('allocate', () => {
    it('distributes a remainder without losing or inventing a unit', () => {
      const parts = allocate(100, 3);
      expect(parts).toEqual([34, 33, 33]);
      expect(sum(parts)).toBe(100);
    });

    it('splits evenly when it divides', () => {
      expect(allocate(100, 4)).toEqual([25, 25, 25, 25]);
    });

    it('handles a negative amount', () => {
      const parts = allocate(-100, 3);
      expect(sum(parts)).toBe(-100);
    });

    it('is empty for a non-positive part count', () => {
      expect(allocate(100, 0)).toEqual([]);
    });
  });

  describe('movingAverageCost', () => {
    it('averages two receipts by quantity, not by price', () => {
      // 10 @ 100 then 10 @ 200 -> 150, not 150 by coincidence of equal counts:
      // 30 @ 100 then 10 @ 200 -> 125.
      expect(movingAverageCost(10, 10000, 10, 20000)).toBe(15000);
      expect(movingAverageCost(30, 10000, 10, 20000)).toBe(12500);
    });

    it('adopts the incoming cost when there was no stock', () => {
      expect(movingAverageCost(0, 0, 5, 12345)).toBe(12345);
    });

    it('keeps the existing basis when the result would be non-positive', () => {
      // Zeroing here would discard the basis needed on the next receipt.
      expect(movingAverageCost(5, 10000, -5, 0)).toBe(10000);
      expect(movingAverageCost(0, 10000, 0, 0)).toBe(10000);
    });
  });
});

describe('money — decimal-string precision', () => {
  it('parses a string exactly, where multiplying a double cannot', () => {
    expect(toMinor('1.005', 'PKR')).toBe(101);
    expect(toMinor('0.615', 'PKR')).toBe(62);
    expect(toMinor('-1.005', 'PKR')).toBe(-101);
  });

  it('handles missing or excess fraction digits', () => {
    expect(toMinor('12', 'PKR')).toBe(1200);
    expect(toMinor('12.', 'PKR')).toBe(1200);
    expect(toMinor('.5', 'PKR')).toBe(50);
    expect(toMinor('1.2349', 'PKR')).toBe(123);
    expect(toMinor('1.2350', 'PKR')).toBe(124);
  });

  it('respects currency precision on the string path', () => {
    expect(toMinor('1.2345', 'KWD')).toBe(1235);
    expect(toMinor('1500.7', 'JPY')).toBe(1501);
  });

  it('still rejects a malformed string', () => {
    expect(() => toMinor('not a number', 'PKR')).toThrow(HttpException);
  });
});
