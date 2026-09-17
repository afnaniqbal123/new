# AI

The AI Business Clerk, and the deterministic product matcher that keeps it
honest.

## The boundary

The model does two things, and only two:

1. **Extracts structure** from a sentence — "2 cartons Coke 1.5L and 10
   Colgate" becomes a list of requested items.
2. **Routes a question** to one of the reports in `REPORT_KIND`.

Everything else is code:

| Job                      | Who does it                                    |
| ------------------------ | ---------------------------------------------- |
| Matching text to a product | `product-matcher.ts` — token overlap + trigram Dice |
| Converting "2 cartons" to base units | `toBaseQuantity`, using the product's pack size |
| Every price, tax and total | `SalesService` / `TaxService`                 |
| Every reported figure    | `ReportsService`                               |

There is no path by which a language model produces a number a user sees
(CONTEXT.md D9). This is not caution about hallucination alone — it is that an
invoice total must be reproducible, and a sampled token is not.

## The matcher

`product-matcher.ts` scores a requested string against the catalogue: 65% token
overlap, 35% trigram Dice coefficient, with the result bucketed into
`EXACT`/`HIGH`/`MEDIUM`/`LOW`. Anything below `HIGH` is surfaced to a human
with alternatives rather than confirmed automatically.

Its spec includes the cases that actually bite — most importantly that "1.5L"
and "500ml" of the same brand must not score as the same product. If you touch
the weights, that test is the one to watch.

## Without a key

`GEMINI_API_KEY` is optional. Absent it, the clerk returns an explicit "AI is
not configured" response and the UI says so; the matcher, the reports and the
whole WhatsApp pipeline still work — only free-text interpretation is missing.
Nothing else in the product degrades. See `docs/CREDENTIALS.md`.

## Provider interface

`ai-provider.interface.ts` is what the rest of the module talks to. Gemini is
the implementation behind it, chosen by `AI_PROVIDER`. The interface exists so
the model is a deployment decision rather than a rewrite.
