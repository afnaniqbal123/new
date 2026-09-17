import {
  MatchableProduct,
  matchProduct,
  toBaseQuantity,
} from 'src/modules/ai/product-matcher';
import { MATCH_CONFIDENCE } from 'src/modules/ai/constants/ai.constant';

/**
 * The matcher is the piece that keeps the language model away from the
 * catalogue (CONTEXT.md D9), so it is tested as real logic rather than
 * trusted as a heuristic. Every case below is a message shape a distributor's
 * customer actually sends.
 */
describe('matchProduct', () => {
  const catalogue: MatchableProduct[] = [
    {
      id: '1',
      name: 'Coca-Cola 1.5L',
      sku: 'COKE-1500',
      barcode: '5449000000996',
      unit: 'pcs',
      packSize: 12,
    },
    {
      id: '2',
      name: 'Coca-Cola 500ml',
      sku: 'COKE-500',
      unit: 'pcs',
      packSize: 24,
    },
    {
      id: '3',
      name: 'A4 Paper 80gsm',
      sku: 'PAPER-A4-80',
      unit: 'ream',
      packSize: 5,
    },
    {
      id: '4',
      name: 'Blue Ballpoint Pen',
      sku: 'PEN-BLUE',
      unit: 'pcs',
      packSize: 50,
    },
    {
      id: '5',
      name: 'Colgate Toothpaste 100g',
      sku: 'COLG-100',
      unit: 'pcs',
      packSize: 12,
    },
  ];

  describe('identifiers are not guesses', () => {
    it('matches an exact SKU', () => {
      const match = matchProduct('COKE-1500', catalogue);

      expect(match.product?.id).toBe('1');
      expect(match.confidence).toBe(MATCH_CONFIDENCE.EXACT);
    });

    it('matches a SKU regardless of case', () => {
      expect(matchProduct('coke-500', catalogue).product?.id).toBe('2');
    });

    it('matches a barcode', () => {
      const match = matchProduct('5449000000996', catalogue);

      expect(match.product?.id).toBe('1');
      expect(match.confidence).toBe(MATCH_CONFIDENCE.EXACT);
    });

    it('matches an exact product name', () => {
      const match = matchProduct('A4 Paper 80gsm', catalogue);

      expect(match.product?.id).toBe('3');
      expect(match.confidence).toBe(MATCH_CONFIDENCE.EXACT);
    });
  });

  describe('natural phrasing', () => {
    it('matches despite word order', () => {
      expect(matchProduct('paper A4', catalogue).product?.id).toBe('3');
    });

    it('ignores filler words', () => {
      expect(
        matchProduct('some of the blue pens please', catalogue).product?.id,
      ).toBe('4');
    });

    it('tolerates a typo', () => {
      expect(matchProduct('colgte toothpaste', catalogue).product?.id).toBe(
        '5',
      );
    });

    it('matches on a prefix', () => {
      expect(matchProduct('colgate', catalogue).product?.id).toBe('5');
    });
  });

  describe('variant discrimination', () => {
    it('keeps size variants apart, which is what digits are for', () => {
      // The single most dangerous failure mode: shipping 1.5L when 500ml was
      // ordered. The sizes must decide the match.
      expect(matchProduct('coca-cola 500ml', catalogue).product?.id).toBe('2');
      expect(matchProduct('coca cola 1.5l', catalogue).product?.id).toBe('1');
    });

    it('offers the other variant as an alternative when ambiguous', () => {
      const match = matchProduct('coca cola', catalogue);

      expect(match.product).not.toBeNull();
      expect(match.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe('refusing to guess', () => {
    it('returns no product for something not in the catalogue', () => {
      const match = matchProduct('industrial paint thinner', catalogue);

      expect(match.product).toBeNull();
      expect(match.confidence).toBe(MATCH_CONFIDENCE.LOW);
    });

    it('still offers alternatives so a human is not left searching', () => {
      const match = matchProduct('cola zero', catalogue);

      expect(match.alternatives.length).toBeGreaterThan(0);
    });

    it('never returns a product that was not supplied', () => {
      // The whole reason matching is code and not the model: it is
      // structurally incapable of inventing a SKU.
      const match = matchProduct('anything at all', catalogue);
      const ids = catalogue.map((product) => product.id);

      if (match.product) {
        expect(ids).toContain(match.product.id);
      }

      for (const alternative of match.alternatives) {
        expect(ids).toContain(alternative.id);
      }
    });

    it('handles an empty query', () => {
      expect(matchProduct('   ', catalogue).product).toBeNull();
    });

    it('handles an empty catalogue', () => {
      expect(matchProduct('coca cola', []).product).toBeNull();
    });
  });

  describe('determinism', () => {
    it('returns the same answer every time', () => {
      const first = matchProduct('blue pen', catalogue);
      const second = matchProduct('blue pen', catalogue);

      expect(first.product?.id).toBe(second.product?.id);
      expect(first.score).toBe(second.score);
    });
  });
});

describe('toBaseQuantity', () => {
  it('converts packs into base units', () => {
    // "2 cartons" of a 24-pack is 48 — arithmetic the model never does.
    expect(toBaseQuantity(2, 'cartons', 24)).toBe(48);
    expect(toBaseQuantity(3, 'box', 12)).toBe(36);
  });

  it('converts dozens', () => {
    expect(toBaseQuantity(2, 'dozen', 1)).toBe(24);
  });

  it('leaves a base unit alone', () => {
    expect(toBaseQuantity(10, 'pcs', 24)).toBe(10);
    expect(toBaseQuantity(10, undefined, 24)).toBe(10);
  });

  it('stays literal for an unrecognised unit rather than guessing', () => {
    // Being wrong by a factor of 24 is far worse than being literal.
    expect(toBaseQuantity(5, 'sacks', 24)).toBe(5);
  });

  it('ignores pack units when the product has no pack size', () => {
    expect(toBaseQuantity(4, 'cartons', 1)).toBe(4);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(toBaseQuantity(2, '  CARTONS ', 24)).toBe(48);
  });
});
