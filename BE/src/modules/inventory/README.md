# Inventory

Owns the stock ledger — the append-only record of every movement — and the
stock transfers between locations.

## What it owns

| Collection          | What it is                                               |
| ------------------- | -------------------------------------------------------- |
| `StockLedgerEntry`  | One movement. Signed quantity, the balance after it, and the unit cost it happened at |
| `StockTransfer`     | Stock in motion between two locations                     |

It does **not** own `Product`, even though it decides that product's
`stockOnHand` and `averageCost`. Those two fields are a *cache* of what the
ledger already says; this module computes them and hands them to
`CatalogService.applyStockDelta`/`setStockOnHand` to store, because a
collection has exactly one owning module (`nestjs/no-foreign-schema-read`).

## The ledger is immutable

A `pre('save')` hook on `StockLedgerEntrySchema` throws on any attempt to save
a document that is not new. This is enforced at the schema, not by convention,
because the entire value of an append-only history is that it cannot be
quietly revised — a stock figure someone can edit is a stock figure nobody can
audit.

A mistake is corrected by **appending a correcting movement**, never by
editing the wrong one. The UI says as much on the inventory screen.

## Three things that are easy to get wrong

**Availability comes from the ledger, not from `Product.stockOnHand`.**
`getAvailable` aggregates the ledger. The cached field exists so a product list
can render 200 rows without 200 aggregations — but the number that decides
whether a sale may complete must come from the truth, because a crashed
process can leave a cache stale and a cache that oversells is worse than a slow
list.

**Every outbound path must call `assertSufficientStock` first.** Three do:
sales, transfers, and `recordAdjustment`. The adjustment path was the one that
did not, and a write-off larger than the quantity on hand wrote an impossible
negative balance straight into the ledger. If you add a fourth outbound path,
it needs the same check — the invariant is about the balance, not about which
document caused the movement.

**Cost direction is not symmetric.** An inbound movement recomputes the moving
weighted average through `movingAverageCost` in `src/utils/money.ts`. An
outbound movement is *stamped with* the current average and never supplies its
own — what leaving stock cost is a property of the stock, not of the
transaction taking it out. That stamp is what makes historical margin
computable at all (CONTEXT.md D3).

## Batch behaviour

`recordMovements` tracks running balances per `(product, location)` across the
whole batch, so two lines of one sale touching the same product record correct
sequential balances rather than both reporting the pre-batch figure. The whole
batch is written before any product cache is touched, so a partial failure
leaves the ledger internally consistent.
