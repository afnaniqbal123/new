# Purchasing

Owns suppliers, purchase orders, goods receipts, and the payables ledger.

## What it owns

| Collection        | What it is                                        |
| ----------------- | ------------------------------------------------- |
| `Supplier`        | Who you buy from, and their terms                 |
| `PurchaseOrder`   | What you asked for, and what has arrived so far   |

## An order is a promise; a receipt is an event

This is the load-bearing distinction in the module. Creating a purchase order
writes **no stock and no payable**. Only receiving goods does:

- appends inbound movements to the stock ledger,
- recomputes each product's moving weighted-average cost at the price actually
  paid,
- creates the payable to the supplier.

Fusing the two would make a partial delivery — the ordinary case, not the edge
case — impossible to represent. It would also mean ordering stock inflated your
stock value before any of it arrived.

## Partial receipts

A line tracks `quantityOrdered` against `quantityReceived`, and the order's
status moves `SENT → PARTIALLY_RECEIVED → RECEIVED` as they converge. Receiving
more than was ordered is allowed (suppliers over-ship), receiving against a
cancelled order is not.

## Cost flows one way

The unit cost on a receipt is what the business actually paid, and it is the
only input to weighted-average cost. Nothing in sales can change a product's
cost — see `../inventory/README.md` for why outbound movements are stamped with
the average rather than supplying their own.

## Reorder suggestions

`getReorderSuggestions` compares stock on hand against each product's reorder
level and proposes its reorder quantity, costed at the current average. It is a
read, not a workflow: it writes nothing and creates no order.
