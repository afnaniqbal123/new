# Tax

The only entry point for tax arithmetic in the system.

## What it owns

Nothing in the database. This is a pure function with a lookup table in front
of it — which is what makes the tax rules exhaustively testable (CONTEXT.md
D7).

## Shape

`TaxService.calculate` resolves a `TaxAdapter` by ISO country code and runs it.
Sales, purchasing and quotations all call it, so a rate is interpreted the same
way everywhere. That is the point of having an engine rather than a
multiplication at each call site: inclusive-vs-exclusive pricing is the kind of
rule that gets implemented twice and disagrees.

| Adapter               | Country | What is special                           |
| --------------------- | ------- | ----------------------------------------- |
| `PakistanTaxAdapter`  | `PK`    | Further tax on unregistered buyers        |
| `StandardTaxAdapter`  | fallback | Plain percentage, inclusive or exclusive |

Adapters are held in a plain `Map`, not registered as Nest providers: they are
stateless value objects, and DI would buy nothing but indirection.

## Adding a country

Implement `TaxAdapter`, register it in the map, add cases to
`tax.service.spec.ts`. No caller changes — that is the interface doing its job.

## What this module deliberately does not do

It never reads the database and never decides whether a document may be saved.
It takes lines and a buyer's registration status, and returns amounts. Anything
stateful belongs to the module that owns the document.

Tax authority *filing* (FBR e-invoicing and equivalents) is explicitly out of
scope for this build — see CONTEXT.md D11. The adapter interface is where it
would attach.

## Inclusive pricing

`taxFromInclusive` in `src/utils/money.ts` extracts the tax already inside a
price. It is integer arithmetic on minor units, like everything else touching
money — see that file's own notes on why a float is not acceptable here.
