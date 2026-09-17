# Sales

Owns sales, invoices, returns, and the POS path.

## What it owns

| Collection   | What it is                                              |
| ------------ | ------------------------------------------------------- |
| `Sale`       | One completed (or draft, or void) sale and its lines    |
| `SaleReturn` | Goods coming back, with the stock and credit that implies |

## The order of operations

Completing a sale touches four things that must agree: stock, tax, the
customer's balance, and the invoice sequence. `completeSale` does them in this
order, and reordering introduces a real bug:

1. **Price the lines** — needs the catalogue and nothing else.
2. **Compute tax** — needs the priced lines and the buyer's registration status.
3. **Check credit** — needs the final total, so it cannot happen earlier.
4. **Check stock** — cheap, and refusing here costs nothing.
5. **Allocate the invoice number** — the first irreversible step, so it goes
   last, after everything that could still refuse the sale has passed.
6. **Write the sale and its ledgers** — stock out, receivable up.

## No transactions, on purpose

There is no `session` wrapping the write. MongoDB multi-document transactions
need a replica set, and requiring one would rule out the single-node deployment
a small distributor actually runs on. The design compensates by ordering the
work so the only steps after the irreversible one are appends — and by making
the ledger, not the cached figure, the source of truth, so a crash mid-write
leaves a recoverable state rather than a wrong balance. `recalculate` on
`InventoryService` is the repair path.

## Quoting

`POST /sales/quote` prices a basket without writing anything. The POS screen
calls it on every change and renders what comes back — **the frontend never
computes a total**. That is not a convenience; it is what guarantees the
number the cashier reads and the number the invoice records are produced by
one implementation of the tax and discount rules.

## Voiding, not deleting

A completed sale is voided: status changes, and compensating movements are
appended to the stock and customer ledgers. The invoice number stays used.
Deleting it would leave a gap in a legally-significant sequence and destroy the
record that the transaction ever happened.
