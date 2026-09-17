import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Type-only: `@google/genai` declares itself an ES module, so a value import
// would be a `require()` of an ESM package. The runtime value is loaded by
// dynamic import in `getClient()` below — which `module: node16` preserves as
// a real `import()` rather than downleveling, verified against the emitted JS.
// `resolution-mode: import` tells TypeScript to read this package's ESM
// declarations from a CommonJS file — required under `module: node16`,
// and erased entirely at emit since the import is type-only.
import type { GoogleGenAI } from '@google/genai' with {
  'resolution-mode': 'import',
};
import { CONFIG } from 'src/constants/config.constant';
import {
  AiProvider,
  ExtractedOrder,
  OrderContext,
  ResolvedQuestion,
} from 'src/modules/ai/ai-provider.interface';

// Overridable with GEMINI_MODEL. Google retires model ids on a schedule and
// the API answers a retired one with a 404 naming its replacement, so this is
// a value to keep current rather than a permanent choice — `gemini-2.0-flash`
// was the default until it was retired in favour of this one.
const DEFAULT_MODEL = 'gemini-3.6-flash';

/**
 * Gemini, behind the `AiProvider` contract.
 *
 * ## Three things this class refuses to do
 *
 * 1. **It never returns a number the business will act on.** `extractOrder`
 *    returns quantities as the customer stated them; pack conversion, pricing
 *    and tax all happen in deterministic code afterwards.
 * 2. **It never picks a product id.** It returns the customer's own words, and
 *    `matchProduct` resolves them against the real catalogue. A model asked to
 *    pick a SKU will eventually invent a plausible one.
 * 3. **It never fails the request it is part of.** Every method degrades to a
 *    safe, explicit result when the key is missing or the call errors — an
 *    unreachable AI must not stop a shop from taking orders.
 *
 * Together those are CONTEXT.md D9 at the implementation level.
 */
@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  private readonly logger = new Logger(GeminiProvider.name);

  /**
   * Cached as a *promise*, not a resolved client.
   *
   * Two concurrent first calls would otherwise each start their own dynamic
   * import and construct their own client. Caching the promise means the
   * import happens exactly once however many callers arrive together.
   */
  private clientPromise: Promise<GoogleGenAI> | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>(CONFIG.GEMINI_API_KEY));
  }

  private async getClient(): Promise<GoogleGenAI | null> {
    if (!this.isConfigured()) return null;

    // Lazy: the key can be absent at boot and present later in a hosted
    // environment, without needing a restart.
    this.clientPromise ??= this.createClient();

    return this.clientPromise;
  }

  private async createClient(): Promise<GoogleGenAI> {
    const { GoogleGenAI: GenAi } = await import('@google/genai');

    return new GenAi({
      apiKey: this.config.get<string>(CONFIG.GEMINI_API_KEY) ?? '',
    });
  }

  private get model(): string {
    return this.config.get<string>(CONFIG.GEMINI_MODEL) ?? DEFAULT_MODEL;
  }

  /**
   * Turns a customer's message into requested items.
   *
   * The prompt is explicit that quantities are to be transcribed, not
   * converted, and that product text is to be echoed rather than corrected.
   * Both instructions exist because the model is otherwise helpful in exactly
   * the wrong way — "2 cartons" becomes "48" and "colgte" becomes "Colgate
   * Total 12-pack", and the deterministic layer downstream loses the ability
   * to show a human what was actually said.
   */
  async extractOrder(
    message: string,
    context: OrderContext,
  ): Promise<ExtractedOrder> {
    const empty: ExtractedOrder = {
      items: [],
      unparsed: [],
      summary: '',
      isOrder: false,
    };

    const client = await this.getClient();

    if (!client) return empty;

    const prompt = [
      'You read WhatsApp messages sent to a wholesale distributor and extract what the customer is asking to buy.',
      '',
      'Rules you must follow exactly:',
      '- Copy the product text as the customer wrote it. Do NOT correct spelling, expand abbreviations, or substitute a catalogue name.',
      '- Report the quantity as the customer stated it. Do NOT convert cartons/boxes/dozens into pieces.',
      '- Report the unit the customer used, if any, in the "unit" field.',
      '- If part of the message reads like a request but you cannot structure it, put that fragment in "unparsed".',
      '- If the message is a greeting, a complaint, a payment question, or small talk, set "isOrder" to false and return no items.',
      '- Never invent an item that is not in the message.',
      '',
      context.productHints.length > 0
        ? `For context only, some products this business sells: ${context.productHints.slice(0, 60).join(', ')}. Do not substitute these names into your output.`
        : '',
      context.customerName ? `The customer is ${context.customerName}.` : '',
      '',
      `Message: """${message}"""`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          // Structured output rather than prose-then-parse: a schema the
          // provider enforces removes a whole class of "the model wrapped
          // its JSON in backticks today" failures.
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              isOrder: { type: 'boolean' },
              summary: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    quantity: { type: 'number' },
                    unit: { type: 'string' },
                  },
                  required: ['text', 'quantity'],
                },
              },
              unparsed: { type: 'array', items: { type: 'string' } },
            },
            required: ['isOrder', 'summary', 'items', 'unparsed'],
          },
          // Low temperature: this is an extraction task, and creativity here
          // is indistinguishable from error.
          temperature: 0.1,
        },
      });

      return this.parseJson<ExtractedOrder>(response.text, empty);
    } catch (error) {
      this.logger.error(
        'Gemini order extraction failed; falling back to no extraction.',
        error instanceof Error ? error.stack : undefined,
      );

      return empty;
    }
  }

  /**
   * Maps a business question onto one of the named reports.
   *
   * The model's whole contribution is routing. It is given the closed list of
   * reports and periods and must choose from them; anything it returns is
   * validated against those lists by the caller before use, so a hallucinated
   * report name resolves to "I cannot answer that" rather than to an error or,
   * worse, to a wrong report.
   */
  async resolveQuestion(
    question: string,
    availableReports: readonly string[],
    availablePeriods: readonly string[],
  ): Promise<ResolvedQuestion> {
    const unanswerable: ResolvedQuestion = {
      reportKind: '',
      period: '',
      reasoning: '',
      answerable: false,
    };

    const client = await this.getClient();

    if (!client) return unanswerable;

    const prompt = [
      'You route a business owner’s question to exactly one report. You do not answer the question yourself and you never state a number.',
      '',
      `Available reports: ${availableReports.join(', ')}`,
      `Available periods: ${availablePeriods.join(', ')}`,
      '',
      'Choose the single report that best answers the question, and the period the question implies.',
      'If no report can answer it, set "answerable" to false.',
      'In "reasoning", say in one short sentence which report you chose and why.',
      '',
      `Question: """${question}"""`,
    ].join('\n');

    try {
      const response = await client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              reportKind: { type: 'string' },
              period: { type: 'string' },
              reasoning: { type: 'string' },
              answerable: { type: 'boolean' },
            },
            required: ['reportKind', 'period', 'reasoning', 'answerable'],
          },
          temperature: 0,
        },
      });

      return this.parseJson<ResolvedQuestion>(response.text, unanswerable);
    } catch (error) {
      this.logger.error(
        'Gemini question routing failed.',
        error instanceof Error ? error.stack : undefined,
      );

      return unanswerable;
    }
  }

  /**
   * Writes prose around figures it is handed.
   *
   * `facts` is already-computed data. The prompt forbids arithmetic
   * explicitly, because a model given two numbers will cheerfully offer their
   * difference — and a difference the deterministic layer did not compute is
   * exactly the thing that must never reach a user.
   */
  async summarize(
    prompt: string,
    facts: Record<string, unknown>,
  ): Promise<string> {
    const client = await this.getClient();

    if (!client) return '';

    try {
      const response = await client.models.generateContent({
        model: this.model,
        contents: [
          'You explain business figures to a shop owner in plain, warm language.',
          '',
          'Rules:',
          '- Use ONLY the figures provided. Never calculate, estimate, or infer a number that is not given to you.',
          '- Do not add percentages, differences, or totals of your own.',
          '- Two or three short sentences. No preamble, no bullet points.',
          '',
          `Task: ${prompt}`,
          `Figures: ${JSON.stringify(facts)}`,
        ].join('\n'),
        config: { temperature: 0.4 },
      });

      return response.text?.trim() ?? '';
    } catch (error) {
      this.logger.error(
        'Gemini summarisation failed.',
        error instanceof Error ? error.stack : undefined,
      );

      return '';
    }
  }

  /**
   * Parses the model's JSON, falling back rather than throwing.
   *
   * Even with a response schema, a malformed body is possible — and an AI
   * feature that can throw is an AI feature that can take down the request it
   * was attached to.
   */
  private parseJson<T>(text: string | undefined, fallback: T): T {
    if (!text) return fallback;

    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.warn('Gemini returned unparseable JSON; using fallback.');

      return fallback;
    }
  }
}
