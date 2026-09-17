# Reports

Produces every number the product reports. Owns no collection.

## Why it exists

Every figure here comes from the module that owns the underlying data — sales
from `SalesService`, stock from `InventoryService`, receivables from
`CustomerService`. What this module adds is the **composition**: a profit
figure needs sales, returns and cost together, and putting that arithmetic
inside any one of those modules would make it the odd one out.

## The report list is a closed enum, and that matters

`REPORT_KIND` is also the AI clerk's tool surface. The model chooses *which*
report to run and with *which* arguments; **this code does the arithmetic**.

That is CONTEXT.md D9's deterministic boundary made concrete: there is no path
by which a language model produces a number a user sees. Adding a report means
adding an enum member and an implementation here — which is exactly what also
makes it answerable by the clerk, with no prompt change.

## Periods

`report-period.util.ts` turns `TODAY`/`THIS_MONTH`/`LAST_30_DAYS`/… into a
concrete range **in the organization's timezone**, not the server's. A
distributor in Karachi closing their day at midnight local time is the whole
point; a UTC day boundary would cut their evening's sales into the wrong day.
`CUSTOM` takes explicit dates.

## Permissions are per-report

Cost, margin and profit are not visible to every role. The policy layer gates
`PROFIT` outright, and the serializers strip `cost`, `profit` and `stockValue`
from responses for roles without margin access — a cashier gets the same
endpoint with fewer fields, not a 500. Verified end to end: a cashier receives
a stripped payload and a 403 on the profit report; an owner receives both.
