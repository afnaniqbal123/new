/** The subject name for the AI clerk in authorization rules. */
export const CLERK_SUBJECT = 'Clerk';

/**
 * How confident the matcher is that a line refers to the product it picked.
 *
 * Owned by this module because `product-matcher.ts` is what produces it.
 * It previously lived in `whatsapp`, which made `ai` depend on `whatsapp`
 * while `whatsapp` already depended on `ai` — a real cycle, caught by
 * `architecture:check` rather than discovered later as a boot failure.
 *
 * Surfaced in the UI rather than hidden: the confirm screen's job is to
 * direct a human's attention at the lines that need it, and a 96% match and
 * a 41% match should not look the same.
 */
export enum MATCH_CONFIDENCE {
  /** Exact SKU or barcode. Not a guess at all. */
  EXACT = 'EXACT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}
