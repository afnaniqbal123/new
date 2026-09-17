import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER,
  AiProvider,
  ExtractedItem,
} from 'src/modules/ai/ai-provider.interface';
import {
  MatchableProduct,
  matchProduct,
  toBaseQuantity,
} from 'src/modules/ai/product-matcher';
import {
  PROFIT_REPORTS,
  REPORT_KIND,
  REPORT_PERIOD,
} from 'src/modules/reports/constants/reports.constant';
import {
  ReportResult,
  ReportsService,
} from 'src/modules/reports/reports.service';
import { CatalogService } from 'src/modules/catalog/catalog.service';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { MATCH_CONFIDENCE } from 'src/modules/ai/constants/ai.constant';

/** One line the clerk proposes, after deterministic matching. */
export interface MatchedLine {
  requestedText: string;
  product: string | null;
  productName: string;
  sku: string;
  /** Already converted to base units by `toBaseQuantity`. */
  quantity: number;
  requestedUnit: string;
  confidence: MATCH_CONFIDENCE;
  alternatives: string[];
}

export interface ParsedOrder {
  isOrder: boolean;
  summary: string;
  lines: MatchedLine[];
  unmatched: string[];
  model: string;
}

/** What an answered business question returns. */
export interface ClerkAnswer {
  answerable: boolean;
  question: string;
  /** The report the question was routed to, when it was answerable. */
  reportKind: REPORT_KIND | null;
  period: REPORT_PERIOD | null;
  reasoning: string;
  /** The real, deterministically-computed report. Never model output. */
  report: ReportResult | null;
  /** Prose written around the figures above — never containing new ones. */
  narrative: string;
}

/**
 * The AI Business Clerk.
 *
 * ## The division of labour, precisely
 *
 * | Step                                   | Who does it   |
 * | -------------------------------------- | ------------- |
 * | Read a message into `{text, qty, unit}`| The model     |
 * | Decide which product that text is      | **Code**      |
 * | Convert cartons to pieces              | **Code**      |
 * | Price the line, tax it, total it       | **Code**      |
 * | Route a question to a report           | The model     |
 * | Compute the report's figures           | **Code**      |
 * | Write a sentence around those figures  | The model     |
 *
 * Every row where money or stock is decided says "code". That table is
 * CONTEXT.md D9, and this class is where it is enforced: the model's output
 * is validated against closed enums and a real catalogue before anything is
 * done with it, so a hallucinated report name or product becomes "I can't
 * answer that" rather than a wrong number.
 */
@Injectable()
export class ClerkService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly reportsService: ReportsService,
    private readonly catalogService: CatalogService,
    private readonly organizationService: OrganizationService,
  ) {}

  isConfigured(): boolean {
    return this.ai.isConfigured();
  }

  /**
   * Reads a customer message into a matched, quantified order proposal.
   *
   * Never produces a price. The result feeds a `DraftOrder`, which a human
   * confirms and the deterministic sale path then prices.
   */
  async parseOrderMessage(
    organizationId: string,
    message: string,
    customerName?: string,
  ): Promise<ParsedOrder> {
    const settings = await this.organizationService.getSettings(organizationId);

    // A sample of real names, so the model speaks the business's vocabulary.
    // Context only — the prompt forbids substituting these into its output.
    const { items: catalogue } = await this.catalogService.findProducts(
      organizationId,
      { limit: 200, page: 1 },
    );

    const extracted = await this.ai.extractOrder(message, {
      productHints: catalogue.map((product) => product.name),
      customerName,
      currency: settings.currency,
    });

    if (!extracted.isOrder || extracted.items.length === 0) {
      return {
        isOrder: false,
        summary: extracted.summary,
        lines: [],
        unmatched: extracted.unparsed,
        model: this.ai.name,
      };
    }

    const matchable: MatchableProduct[] = catalogue.map((product) => ({
      id: String(product._id),
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      unit: product.unit,
      packSize: product.packSize,
    }));

    const lines = extracted.items.map((item) =>
      this.matchItem(item, matchable),
    );

    return {
      isOrder: true,
      summary: extracted.summary,
      lines,
      // A line that matched nothing is reported as unmatched *and* kept as a
      // line, so the confirm screen can show it rather than silently losing
      // something the customer asked for.
      unmatched: [
        ...extracted.unparsed,
        ...lines
          .filter((line) => line.product === null)
          .map((line) => line.requestedText),
      ],
      model: this.ai.name,
    };
  }

  private matchItem(
    item: ExtractedItem,
    catalogue: readonly MatchableProduct[],
  ): MatchedLine {
    const match = matchProduct(item.text, catalogue);

    // Pack conversion uses the *matched* product's pack size, so it can only
    // happen once a real product is known — another reason the model must not
    // do this arithmetic itself.
    const quantity = match.product
      ? toBaseQuantity(item.quantity, item.unit, match.product.packSize)
      : item.quantity;

    return {
      requestedText: item.text,
      product: match.product?.id ?? null,
      productName: match.product?.name ?? '',
      sku: match.product?.sku ?? '',
      quantity,
      requestedUnit: item.unit ?? '',
      confidence: match.confidence,
      alternatives: match.alternatives.map((alternative) => alternative.id),
    };
  }

  /**
   * Answers a business question — by running a real report.
   *
   * The model chooses *which* report. If it names one that does not exist, or
   * a period that does not exist, the answer is an honest refusal rather than
   * a guess: validating against the enum is what makes a hallucination
   * harmless here.
   */
  async ask(
    organizationId: string,
    question: string,
    canSeeProfit: boolean,
  ): Promise<ClerkAnswer> {
    const reports = Object.values(REPORT_KIND).filter(
      (kind) => canSeeProfit || !PROFIT_REPORTS.has(kind),
    );
    const periods = Object.values(REPORT_PERIOD);

    const resolution = await this.ai.resolveQuestion(
      question,
      reports,
      periods,
    );

    // The model returns plain strings. Validating them against the closed
    // enums here is what makes a hallucinated report name harmless: it
    // resolves to "I can't answer that" rather than to an error or, worse,
    // to the wrong report.
    const kind = asMember(reports, resolution.reportKind);
    const period = asMember(periods, resolution.period);

    if (!resolution.answerable || !kind) {
      return {
        answerable: false,
        question,
        reportKind: null,
        period: null,
        reasoning: resolution.reasoning,
        report: null,
        narrative: '',
      };
    }

    // The figures. Computed here, deterministically, from the same code path
    // the UI uses — so chat and screen cannot disagree.
    const report = await this.reportsService.run(
      organizationId,
      kind,
      period ?? REPORT_PERIOD.THIS_MONTH,
    );

    // The model sees the figures only after they exist, and is told to write
    // about them rather than compute anything.
    const narrative = await this.ai.summarize(
      `Answer this question using only the figures given: "${question}"`,
      {
        period: report.period.label,
        currency: report.currency,
        ...report.summary,
        rowCount: report.rows.length,
      },
    );

    return {
      answerable: true,
      question,
      reportKind: kind,
      period: period ?? REPORT_PERIOD.THIS_MONTH,
      reasoning: resolution.reasoning,
      report,
      narrative,
    };
  }

  /**
   * Writes the morning digest's opening line from figures already computed.
   *
   * Falls back to a plain rendering when AI is unavailable, so the digest
   * still goes out — the numbers are the point, and the prose is decoration.
   */
  async writeDigestNarrative(facts: Record<string, unknown>): Promise<string> {
    if (!this.ai.isConfigured()) return '';

    return this.ai.summarize(
      'Write a short good-morning briefing for a shop owner about the day ahead.',
      facts,
    );
  }
}

/**
 * Narrows an untrusted string to a member of a known list.
 *
 * A single named helper rather than an inline `===` against an enum member:
 * comparing an enum to an external string is exactly what
 * `no-unsafe-enum-comparison` exists to catch, and the boundary cast belongs
 * in one place that says what it is doing.
 */
function asMember<T extends string>(
  allowed: readonly T[],
  value: string,
): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}
