# ADR 0006 — `require-schema-timestamps` exempts embedded subdocuments

- **Status:** Accepted
- **Date:** 2026-09-11

## Context

`nestjs/require-schema-timestamps` fires on every class carrying a `@Schema()`
decorator that does not pass `{ timestamps: true }`. Its reasoning is sound for
a collection: rows with no `createdAt`/`updatedAt` cannot be ordered or
audited, and discovering that after a year of data is unrecoverable.

But `@Schema()` in `@nestjs/mongoose` marks two structurally different things:

| Written as                | Mongoose builds       | Has its own documents? |
| ------------------------- | --------------------- | ---------------------- |
| `@Schema({ timestamps })` | A collection          | Yes                    |
| `@Schema({ _id: false })` | An embedded subschema | No                     |

The second form is the idiomatic way to declare a **nested value object** —
configuration grouped onto a parent document rather than stored separately.
`Organization` uses four of them (`TaxSettings`, `InvoiceSettings`,
`OperationalSettings`, `WhatsAppSettings`), and `StockTransfer` uses one
(`TransferLine`).

An embedded subdocument has nothing the rule is protecting:

- It is not a collection, so there are no rows to order.
- It has no independent lifecycle — it is created, updated and deleted with
  its parent, whose own `createdAt`/`updatedAt` already record when.
- Mongoose does not maintain timestamps on a subschema in the way the rule
  assumes. Adding `timestamps: true` would write two dead date fields into
  every parent document and mislead the next reader into thinking they mean
  something.

So the rule was reporting a real pattern as a violation, and the only ways to
satisfy it were to add meaningless fields or to flatten value objects into
their parent — the second of which is materially worse code.

Per `AGENTS.md`, a rule that is genuinely wrong for a case is changed in
`tools/eslint-rules/`, with an ADR. Not disabled inline.

## Decision

`requireSchemaTimestamps` skips any class whose `@Schema()` options include a
literal `_id: false`.

That marker is the precise signal, not a heuristic: `_id: false` is what
distinguishes an embedded subschema from a collection in Mongoose, and it is
not something a real collection would ever set — a collection without `_id` is
not addressable.

The rule is otherwise unchanged. In particular, a class with **no** options at
all still reports, and an explicit `timestamps: false` is still accepted as a
deliberate opt-out.

## Consequences

- Value objects can be modelled as embedded subschemas without a lint
  suppression, which is what `Organization`'s settings blocks needed.
- The narrow risk: someone writes `@Schema({ _id: false })` on a class they
  then register with `MongooseModule.forFeature`, and loses the timestamp
  check on a real collection. That combination does not work in Mongoose
  regardless — the documents would have no `_id` — so it fails much louder
  than a missing `createdAt` would.
- No existing suppression is affected; this narrows what the rule reports, so
  nothing previously passing begins to fail.

## Alternatives considered

**Add `timestamps: true` to the subdocuments.** Rejected: it writes two fields
that never change independently of the parent, and a future reader would
reasonably believe they record when the settings themselves were last edited.
They would not.

**Flatten the value objects into their parents** (`taxDefaultRatePercent`,
`invoicePrefix`, …). Rejected: `Organization` would gain roughly twenty
prefixed fields, and the grouping that makes the settings legible — and makes
`update()`'s nested merge possible — would be gone. Satisfying a lint rule is
not a reason to make the model worse.

**Suppress inline.** Rejected by `AGENTS.md`, and correctly: the next project
built on this boilerplate would hit exactly the same false positive.
