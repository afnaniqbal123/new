/**
 * What the AI layer is allowed to return.
 *
 * Every method here produces *structure* or *prose*. None of them produces a
 * number a user will be charged, a stock level, or a permission decision —
 * that boundary is CONTEXT.md D9, and this interface is where it is made
 * unavoidable rather than merely intended.
 */

/** One item the model believes was requested, before any catalogue lookup. */
export interface ExtractedItem {
  /** Exactly what the customer wrote. Never paraphrased or corrected. */
  text: string;
  quantity: number;
  /** The unit as written — "cartons", "boxes", "kg". May be absent. */
  unit?: string;
}

/** The model's reading of a customer message. */
export interface ExtractedOrder {
  items: ExtractedItem[];
  /** Message fragments that read like a request but could not be structured. */
  unparsed: string[];
  /** One line summarising the request, for a notification. */
  summary: string;
  /** True when the message is not an order at all — a greeting, a complaint. */
  isOrder: boolean;
}

/**
 * A business question resolved to a *named report plus arguments*.
 *
 * Deliberately not "an answer". The model's entire job here is to decide
 * which of a closed set of reports the question maps to; the report then
 * computes the figures deterministically. There is no path by which the
 * model's own arithmetic reaches a user.
 */
export interface ResolvedQuestion {
  /** Must be a member of REPORT_KIND. Validated before use. */
  reportKind: string;
  /** Must be a member of REPORT_PERIOD. Validated before use. */
  period: string;
  /** Why this report was chosen, shown to the user for transparency. */
  reasoning: string;
  /** False when the question cannot be served by any available report. */
  answerable: boolean;
}

export interface AiProvider {
  readonly name: string;

  /** Whether a key is configured. False means every call degrades explicitly. */
  isConfigured(): boolean;

  /** Parses a customer message into requested items. */
  extractOrder(message: string, context: OrderContext): Promise<ExtractedOrder>;

  /** Maps a business question onto one of the named reports. */
  resolveQuestion(
    question: string,
    availableReports: readonly string[],
    availablePeriods: readonly string[],
  ): Promise<ResolvedQuestion>;

  /**
   * Writes the prose around figures it is *given*.
   *
   * The numbers are passed in already computed. The model formats and
   * explains; it never calculates. This is the method most likely to be
   * misused, which is why its input is data rather than a question.
   */
  summarize(prompt: string, facts: Record<string, unknown>): Promise<string>;
}

/** What the extractor is told about the business, to improve matching. */
export interface OrderContext {
  /** A sample of catalogue names, so the model uses the right vocabulary. */
  productHints: readonly string[];
  /** The customer's name, when known — helps with "the usual". */
  customerName?: string;
  currency: string;
}

/** Injection token. A string token, because the interface is not a class. */
export const AI_PROVIDER = 'AI_PROVIDER';
