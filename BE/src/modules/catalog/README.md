# Catalog

Owns the product catalogue: `Product` and `Category`.

## What it owns

| Collection | What it is                                       |
| ---------- | ------------------------------------------------ |
| `Product`  | One sellable thing, its price, and its stock cache |
| `Category` | A grouping, for filtering and reporting           |

## The two fields that are not really its own

`Product.stockOnHand` and `Product.averageCost` live on the product document
but are **computed by `InventoryService` from the stock ledger**. This module
stores them through `applyStockDelta`/`setStockOnHand` and never derives them.

The split exists because a collection has exactly one owning module
(`nestjs/no-foreign-schema-read`), and the product document is this module's.
Inventory owns the *meaning* of those numbers; catalog owns the *row*.

Treat them as a cache: correct almost always, authoritative never. Anything
deciding whether a sale may proceed reads `InventoryService.getAvailable`.

## Uniqueness

SKU and barcode are unique per organization, checked before insert
(`assertSkuFree`/`assertBarcodeFree`) **and** backed by a partial unique index.
The application check gives a readable error; the index is what actually holds
under a race. Partial, not sparse: a sparse compound index only skips a
document when every indexed field is missing, so two products with no barcode
would collide on `null`.

## Pack sizes

`packSize` is how many base units are in a selling pack — a carton of 12. The
AI product matcher uses it to turn "2 cartons" into a base quantity
(`toBaseQuantity` in `../ai/product-matcher.ts`). Stock is always stored in
base units; the pack is a way of *talking* about quantity, never a second unit
the ledger has to reason about.

## Archiving

Products are archived, not deleted — ledger rows and past sale lines reference
them permanently, and a dangling reference in an append-only history destroys
the answer to "what did we sell?".
