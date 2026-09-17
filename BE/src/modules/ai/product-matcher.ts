import { MATCH_CONFIDENCE } from 'src/modules/ai/constants/ai.constant';

/** The minimum a product must expose to be matchable. */
export interface MatchableProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  unit: string;
  packSize: number;
}

export interface ProductMatch {
  product: MatchableProduct | null;
  confidence: MATCH_CONFIDENCE;
  score: number;
  /** Runners-up, offered as one-tap corrections on the confirm screen. */
  alternatives: MatchableProduct[];
}

/**
 * Matches free text against the catalogue — **without the AI**.
 *
 * This is the deliberate division of labour behind CONTEXT.md D9. The model
 * reads "20 boxes of A4 paper" and returns `{ text: "A4 paper", quantity: 20,
 * unit: "boxes" }`. Deciding *which SKU* that is happens here, in code that:
 *
 * - is deterministic, so the same message always resolves the same way;
 * - is exhaustively testable, which a model's judgement is not;
 * - cannot hallucinate a product that does not exist, because it can only
 *   return products it was given.
 *
 * The last point is the one that matters. A model asked to pick a SKU will
 * occasionally invent a plausible one, and an invented SKU on a confirmed
 * order is stock moving against a product nobody sells.
 */

/**
 * Score thresholds. Tuned so that `EXACT` genuinely means "not a guess" and
 * `LOW` still surfaces rather than being dropped — a bad suggestion a human
 * can see and fix beats silence about an item the customer asked for.
 */
const CONFIDENCE_THRESHOLDS = {
  exact: 1,
  high: 0.72,
  medium: 0.48,
} as const;

const MAX_ALTERNATIVES = 3;

/**
 * Words that carry no discriminating information in a product request.
 *
 * Dropped before scoring so "2 boxes of the blue pens please" competes on
 * "blue pens" rather than being diluted by filler. Kept deliberately short:
 * an aggressive stop-list starts removing real product words.
 */
const NOISE_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'please',
  'pls',
  'some',
  'need',
  'want',
  'send',
  'give',
  'me',
  'i',
  'we',
  'for',
  'with',
  'my',
  'is',
  'are',
  'box',
  'boxes',
  'carton',
  'cartons',
  'packet',
  'packets',
  'pack',
  'packs',
  'piece',
  'pieces',
  'pcs',
  'unit',
  'units',
  'dozen',
  'kg',
  'gram',
  'grams',
  'bottle',
  'bottles',
  'bag',
  'bags',
]);

/**
 * Reduces text to comparable tokens: lowercase, punctuation stripped, noise
 * words removed.
 *
 * Digits are kept — "1.5L" and "500ml" are exactly the distinctions that
 * separate two variants of the same product, and dropping them would make
 * the matcher confidently wrong rather than unsure.
 */
function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !NOISE_WORDS.has(token));
}

/**
 * Similarity between two token lists, in [0, 1].
 *
 * A weighted blend of two signals that fail in different ways:
 *
 * - **Token overlap** handles word order and missing words ("paper A4" vs
 *   "A4 Paper 80gsm") but is blind to spelling.
 * - **Character trigrams** handle typos and morphology ("colgate" vs
 *   "colgte") but reward coincidental letter sharing between unrelated words.
 *
 * Neither alone is adequate for messages typed on a phone; together they
 * cover each other's failure mode.
 */
function similarity(queryTokens: string[], targetTokens: string[]): number {
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;

  const targetSet = new Set(targetTokens);
  let matched = 0;

  for (const token of queryTokens) {
    if (targetSet.has(token)) {
      matched += 1;
      continue;
    }

    // A query token that is a prefix of a target token counts partially —
    // "choc" should find "chocolate" without a full-text index.
    if (
      targetTokens.some(
        (target) => target.startsWith(token) && token.length >= 3,
      )
    ) {
      matched += 0.7;
    }
  }

  const overlap = matched / queryTokens.length;
  const trigram = trigramSimilarity(
    queryTokens.join(' '),
    targetTokens.join(' '),
  );

  return overlap * 0.65 + trigram * 0.35;
}

/** Dice coefficient over character trigrams. Cheap, and typo-tolerant. */
function trigramSimilarity(a: string, b: string): number {
  const gramsA = trigrams(a);
  const gramsB = trigrams(b);

  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  let shared = 0;

  for (const gram of gramsA) {
    if (gramsB.has(gram)) shared += 1;
  }

  return (2 * shared) / (gramsA.size + gramsB.size);
}

function trigrams(input: string): Set<string> {
  const padded = `  ${input} `;
  const grams = new Set<string>();

  for (let i = 0; i < padded.length - 2; i += 1) {
    grams.add(padded.slice(i, i + 3));
  }

  return grams;
}

/**
 * Finds the best catalogue match for a fragment of customer text.
 *
 * An exact SKU or barcode short-circuits everything else: those are
 * identifiers, not descriptions, and a customer who quotes one means it.
 */
export function matchProduct(
  text: string,
  products: readonly MatchableProduct[],
): ProductMatch {
  const trimmed = text.trim();

  if (trimmed.length === 0 || products.length === 0) {
    return {
      product: null,
      confidence: MATCH_CONFIDENCE.LOW,
      score: 0,
      alternatives: [],
    };
  }

  const normalized = trimmed.toLowerCase();

  const identifierMatch = products.find(
    (product) =>
      product.sku.toLowerCase() === normalized ||
      (product.barcode && product.barcode.toLowerCase() === normalized),
  );

  if (identifierMatch) {
    return {
      product: identifierMatch,
      confidence: MATCH_CONFIDENCE.EXACT,
      score: CONFIDENCE_THRESHOLDS.exact,
      alternatives: [],
    };
  }

  // An exact name match is also not a guess.
  const nameMatch = products.find(
    (product) => product.name.toLowerCase() === normalized,
  );

  if (nameMatch) {
    return {
      product: nameMatch,
      confidence: MATCH_CONFIDENCE.EXACT,
      score: CONFIDENCE_THRESHOLDS.exact,
      alternatives: [],
    };
  }

  const queryTokens = tokenize(trimmed);

  const scored = products
    .map((product) => ({
      product,
      score: similarity(
        queryTokens,
        tokenize(`${product.name} ${product.sku}`),
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (!best || best.score < CONFIDENCE_THRESHOLDS.medium) {
    return {
      product: null,
      confidence: MATCH_CONFIDENCE.LOW,
      score: best?.score ?? 0,
      // Still offered: a human choosing from three near-misses is faster
      // than a human searching from scratch.
      alternatives: scored
        .slice(0, MAX_ALTERNATIVES)
        .filter((candidate) => candidate.score > 0)
        .map((candidate) => candidate.product),
    };
  }

  return {
    product: best.product,
    confidence:
      best.score >= CONFIDENCE_THRESHOLDS.high
        ? MATCH_CONFIDENCE.HIGH
        : MATCH_CONFIDENCE.MEDIUM,
    score: best.score,
    alternatives: scored
      .slice(1, MAX_ALTERNATIVES + 1)
      .filter((candidate) => candidate.score > CONFIDENCE_THRESHOLDS.medium / 2)
      .map((candidate) => candidate.product),
  };
}

/**
 * Converts a quantity expressed in the customer's unit into base units.
 *
 * "2 cartons" of a product with `packSize: 24` is 48. Done here, in code,
 * rather than by the model — it is arithmetic, and arithmetic is not the
 * model's job however simple it looks. CONTEXT.md D9.
 *
 * An unrecognised unit returns the quantity unchanged rather than guessing a
 * multiplier: being wrong by a factor of 24 is far worse than being literal.
 */
const PACK_UNITS = new Set([
  'carton',
  'cartons',
  'ctn',
  'box',
  'boxes',
  'case',
  'cases',
  'pack',
  'packs',
  'packet',
  'packets',
]);

const DOZEN_UNITS = new Set(['dozen', 'dozens', 'doz']);

export function toBaseQuantity(
  quantity: number,
  unit: string | undefined,
  packSize: number,
): number {
  if (!unit) return quantity;

  const normalized = unit.trim().toLowerCase();

  if (DOZEN_UNITS.has(normalized)) return quantity * 12;

  if (PACK_UNITS.has(normalized) && packSize > 1) {
    return quantity * packSize;
  }

  return quantity;
}
