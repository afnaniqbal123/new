# Customer

Owns customers and the receivables ledger.

## What it owns

| Collection             | What it is                                          |
| ---------------------- | --------------------------------------------------- |
| `Customer`             | One buyer, their terms, and their credit limit       |
| `CustomerLedgerEntry`  | Append-only: every invoice, payment and adjustment   |

These are one module because they are one aggregate. A balance has no meaning
apart from the customer it belongs to, and the invariant that ties them — never
exceed the credit limit — needs both in hand to be enforced at all.

## Credit is checked, not reported

`checkCredit` returns a `CreditCheck` (`allowed`, `creditLimit`, `outstanding`,
`projected`, `excess`) rather than a boolean, because the caller usually needs
to *explain* the refusal. `SalesService` calls it before allocating an invoice
number — refusing a sale is free at that point and expensive afterwards.

## The balance is derived

A customer's outstanding amount is the sum of their ledger, not a field someone
increments. The cached projection exists for list screens; the ledger is the
answer. Same reasoning as the stock ledger next door, for the same reason: a
balance nobody can recompute is a balance nobody can dispute.

## Aging

`getAging` buckets receivables by how far past due they are (current, 1–30,
31–60, 61–90, 90+). Due dates come from the customer's payment terms at the
time of sale, stored on the ledger entry — not recomputed from today's terms,
because changing a customer's terms must not silently re-age last quarter's
invoices.
