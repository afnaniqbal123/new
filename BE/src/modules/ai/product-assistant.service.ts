import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AI_PROVIDER,
  type AiProvider,
} from 'src/modules/ai/ai-provider.interface';

/** One answerable thing about the product. */
interface KnowledgeEntry {
  /** Words that, appearing in a question, point at this entry. */
  keywords: readonly string[];
  answer: string;
}

export interface AssistantAnswer {
  answer: string;
  /** True when a language model wrote the prose; false for the fallback. */
  generated: boolean;
  /** Follow-up questions the visitor is likely to want next. */
  suggestions: readonly string[];
}

/**
 * The assistant on the marketing page.
 *
 * ## What makes this safe to expose without authentication
 *
 * It answers questions **about the product**, never about anyone's data. It
 * holds no organization id, takes no tenant context, and calls no report. The
 * only thing it can say is what is written in `KNOWLEDGE` below — the model's
 * job is to choose the relevant entry and phrase it for the question asked,
 * exactly the same division of labour the business clerk uses (CONTEXT.md D9),
 * applied to marketing copy instead of to figures.
 *
 * That is why the model is given the facts in the prompt rather than being
 * asked to recall them. A model inventing a feature this product does not have
 * is a support ticket at best and a false claim at worst.
 *
 * ## It works without a key
 *
 * With no `GEMINI_API_KEY`, `answer()` falls back to scoring the question
 * against each entry's keywords and returning the best match verbatim. The
 * visitor still gets a real answer; it is simply not rephrased. A widget that
 * shows "AI not configured" on a public landing page would be worse than no
 * widget at all.
 */
@Injectable()
export class ProductAssistantService {
  private readonly logger = new Logger(ProductAssistantService.name);

  constructor(@Inject(AI_PROVIDER) private readonly provider: AiProvider) {}

  /** Everything the assistant is permitted to claim. */
  private static readonly KNOWLEDGE: readonly KnowledgeEntry[] = [
    {
      keywords: ['what', 'is', 'businessos', 'about', 'do', 'product'],
      answer:
        'BusinessOS runs the back office of a distributor or small retail chain: inventory, invoicing, customers, credit and purchasing in one place. Its distinctive feature is that a customer can order over WhatsApp and the message arrives as a priced, stock-checked, credit-checked draft order — nobody retypes it.',
    },
    {
      keywords: ['whatsapp', 'message', 'order', 'customer', 'chat'],
      answer:
        'A customer messages what they need in plain language. BusinessOS matches the items to your catalogue, converts units (2 cartons becomes 24 bottles using the product pack size), prices them, applies tax, checks stock and checks their credit limit. You get a draft order and confirm it with one tap. You can try the whole flow today with the built-in simulator — no WhatsApp Business account needed.',
    },
    {
      keywords: [
        'price',
        'pricing',
        'cost',
        'plan',
        'free',
        'much',
        'pay',
        'subscription',
      ],
      answer:
        'The Free plan covers one location, two users, 500 products and 500 sales a month — no card required. Starter is $9/month for three users with unlimited products and sales. Business is $29/month for ten users, multiple locations, stock transfers and daily automations. Every plan includes WhatsApp, the AI clerk and all reports.',
    },
    {
      keywords: [
        'ai',
        'clerk',
        'gemini',
        'wrong',
        'hallucinate',
        'accurate',
        'numbers',
        'trust',
      ],
      answer:
        'The AI never produces a number. It reads your question and decides which of the thirteen reports answers it; the arithmetic is done by the same code that prints your invoices. You can prove it — ask the clerk something, then run that report manually and the figures match exactly, because it is the same call.',
    },
    {
      keywords: ['tax', 'gst', 'fbr', 'pakistan', 'vat', 'withholding'],
      answer:
        'Pakistani GST, further tax on unregistered buyers, withholding, and inclusive or exclusive pricing are all supported out of the box. The tax engine is pluggable per country, so the same rules apply wherever you trade. Past invoices always keep the rate they were issued under — changing your rate never restates old books.',
    },
    {
      keywords: [
        'stock',
        'inventory',
        'ledger',
        'mistake',
        'edit',
        'audit',
        'correct',
      ],
      answer:
        'Stock is an append-only ledger: every movement is recorded with its reason, the quantity and the balance after it, and nothing is ever edited away. A mistake is corrected by adding a correcting movement, so you can always answer why a number is what it is. Stock cannot go negative unless you deliberately allow it.',
    },
    {
      keywords: [
        'role',
        'cashier',
        'permission',
        'margin',
        'profit',
        'staff',
        'team',
        'user',
      ],
      answer:
        'There are six roles: owner, admin, manager, cashier, accountant and viewer. A cashier can ring up sales but never sees cost, margin or profit — those fields are stripped from the API response itself, not merely hidden in the interface, so opening developer tools reveals nothing.',
    },
    {
      keywords: [
        'credit',
        'owe',
        'receivable',
        'aging',
        'limit',
        'debtor',
        'udhaar',
      ],
      answer:
        'Every customer has a credit limit that is enforced at the counter: a sale that would push them past it is refused with the exact shortfall. Their balance is an append-only ledger, and the receivables aging view buckets what you are owed by how overdue it is, so you know who to chase today.',
    },
    {
      keywords: [
        'purchase',
        'supplier',
        'buy',
        'reorder',
        'cost',
        'delivery',
        'goods',
      ],
      answer:
        'Reorder suggestions come from real sales and current stock, not a static list. A purchase order moves no stock — only receiving goods does, and that is what recomputes each product’s weighted-average cost at the price you actually paid. Partial deliveries are the normal case and are handled properly.',
    },
    {
      keywords: [
        'offline',
        'internet',
        'cloud',
        'install',
        'setup',
        'start',
        'begin',
      ],
      answer:
        'It runs in the browser, so there is nothing to install. Setting up your catalogue takes an afternoon and you can sell the next morning. Start on the free plan and add a WhatsApp number whenever you are ready — that is a settings change, not a migration.',
    },
    {
      keywords: [
        'location',
        'branch',
        'warehouse',
        'shop',
        'multi',
        'transfer',
      ],
      answer:
        'Stock is tracked per location from day one, even if you only have one. When you grow, you add locations in Settings and can transfer stock between them with in-transit tracking, so nothing goes missing between the warehouse and the shop.',
    },
  ];

  private static readonly SUGGESTIONS = [
    'How does the WhatsApp ordering work?',
    'What does it cost?',
    'Can my cashier see my profit?',
    'Does it handle Pakistani GST?',
  ] as const;

  get suggestions(): readonly string[] {
    return ProductAssistantService.SUGGESTIONS;
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * Scores each entry by how many of its keywords the question contains.
   *
   * Deliberately crude — it is a fallback and a retrieval step, not a search
   * engine. Returning the two best entries rather than one gives the model
   * enough context to answer a question that straddles topics ("how much, and
   * does it do tax?") without handing it the entire knowledge base.
   */
  private rank(question: string): KnowledgeEntry[] {
    const words = new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    );

    return [...ProductAssistantService.KNOWLEDGE]
      .map((entry) => ({
        entry,
        score: entry.keywords.filter((keyword) => words.has(keyword)).length,
      }))
      .filter((scored) => scored.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((scored) => scored.entry);
  }

  async answer(question: string): Promise<AssistantAnswer> {
    const matches = this.rank(question);
    // Nothing matched: fall back to the overview rather than saying "I don't
    // know", which on a marketing page is a dead end for the visitor.
    const context =
      matches.length > 0 ? matches : [ProductAssistantService.KNOWLEDGE[0]];
    const fallback = context[0].answer;

    if (!this.provider.isConfigured()) {
      return {
        answer: fallback,
        generated: false,
        suggestions: ProductAssistantService.SUGGESTIONS,
      };
    }

    try {
      const prose = await this.provider.summarize(
        [
          'You answer questions about a product called BusinessOS for a visitor on its website.',
          'Answer ONLY from the facts provided. If the facts do not cover the question, say so plainly and suggest contacting the team.',
          'Never invent a feature, a price, an integration or a statistic.',
          'Two or three sentences. Plain, concrete, no marketing adjectives, no bullet points.',
          `The visitor asked: ${question}`,
        ].join('\n'),
        { facts: context.map((entry) => entry.answer) },
      );

      const trimmed = prose.trim();

      return {
        // An empty or suspiciously short generation is worse than the curated
        // sentence it replaced, so the fallback stands in.
        answer: trimmed.length > 20 ? trimmed : fallback,
        generated: trimmed.length > 20,
        suggestions: ProductAssistantService.SUGGESTIONS,
      };
    } catch (error) {
      // A marketing page must not show an error because a model timed out.
      this.logger.warn(
        `Product assistant fell back to curated copy: ${error instanceof Error ? error.message : 'unknown error'}`,
      );

      return {
        answer: fallback,
        generated: false,
        suggestions: ProductAssistantService.SUGGESTIONS,
      };
    }
  }
}
