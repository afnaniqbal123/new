# BusinessOS — Domain Model & Decision Record

> **Positioning:** _"Run your entire business from one place — even through WhatsApp."_
>
> Operations software for wholesalers, distributors, and small retail chains.
> Not a POS. A POS is one screen inside it.

This file is the shared vocabulary and the record of decisions already made. Read it
before writing code in either `BE/` or `FE/`. If a decision here conflicts with what
you are about to write, the decision wins — or it gets changed here first, deliberately.

---

## 1. The shape of the product

```
                            BUSINESSOS
                                 │
        ┌──────────────┬─────────┴────────┬──────────────┐
        ↓              ↓                  ↓              ↓
      SALES        INVENTORY          PURCHASES      CUSTOMERS
        │              │                  │              │
        └──────────────┴────────┬─────────┴──────────────┘
                                ↓
                        AI BUSINESS CLERK
                                │
              ┌─────────────────┼─────────────────┐
              ↓                 ↓                 ↓
           WhatsApp          Reports         Automation
```

The AI is an **employee, not the product**. It translates between humans and the
deterministic core. It never computes a balance.

---

## 2. Bounded decisions (settled — do not re-litigate)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Tenant = `Organization`.** Every business-domain document carries `organization: ObjectId`, indexed, and is filtered by the tenant guard. | The boilerplate already ships `OrganizationAccessGuard`, `@TenantScoped()`, and `User.organization`. Building on it, not beside it. |
| D2 | **Stock truth is an append-only `StockLedger`.** Every movement is an immutable row. `Product.stockOnHand` is a cached projection, never the source of truth. | Directly targets "phantom inventory". You can always answer *why* a number is what it is, and rebuild it from history. |
| D3 | **Moving weighted-average cost (WAC).** Recomputed on every inbound movement. | Simpler and more forgiving than FIFO for distributors; no lot-consumption bookkeeping needed to close a sale. |
| D4 | **Money is an integer in minor units** (paisa/cents) plus an ISO-4217 `currency` code. Never a float, never a bare `Number` holding rupees. | Mongoose `Number` is an IEEE-754 double. Floats in a credit ledger are a correctness bug, not a rounding preference. |
| D5 | **Roles:** `OWNER, ADMIN, MANAGER, CASHIER, ACCOUNTANT, VIEWER` — exactly these six. `MEMBER` removed. | Each maps to a genuinely different CASL permission set. Cashier ≠ Accountant. |
| D6 | **Multi-location in the schema, single-location in the UI.** Every ledger row carries `location`. The picker stays hidden until a second location exists. | Retrofitting location onto a movement history later is a data migration, not a feature. |
| D7 | **Tax is a pluggable `TaxAdapter`.** The PK adapter ships first; rates are per-org configuration, never hardcoded. **No FBR fiscalization.** | The core engine is built once; countries become adapters. Claiming fiscal compliance you do not have is a liability. |
| D8 | **AI = Gemini behind a provider interface**, reusing `platform-assistant`'s guardrails, rate limiter, and conversation store. | Swappable. And the guardrail infrastructure already exists — no reason to rebuild it. |
| D9 | **AI never touches money, stock, tax, or permissions.** It produces *drafts* a human confirms. | The deterministic/probabilistic boundary is the single most important line in this system. |
| D10 | **WhatsApp ingestion ships with a local simulator.** No Meta credentials required to develop, demo, or test the full pipeline. | Credential availability must never block the build. |
| D11 | **Media has two interchangeable providers** — Cloudinary and S3 — chosen by `MEDIA_PROVIDER`. | Cloudinary has a free tier; S3 was already wired. Whichever the deployer has. |
| D12 | **Stripe is for SaaS subscription billing only** (Free/Starter/Business), sandbox mode. Not for processing the distributor's own customer payments. | PK distributors settle in cash and bank transfer. Card acquiring for them is a different, licensed product. |
| D13 | **Queues via BullMQ + Redis, with an in-process fallback.** `pnpm dev` works with no Redis configured. | Digests, WhatsApp processing, and AI calls must not run inline on a request — but a missing Redis must not break local dev. |
| D14 | **BE and FE are independent pnpm projects**, orchestrated from the root. Not a pnpm workspace. | Each ships its own `pnpm-workspace.yaml` with supply-chain hardening a root workspace file would silently override. |
| D15 | **The three.js landing page is its own lazy chunk.** Only the *total-JS* size-limit is raised, with a comment; the 195 kB entry budget is untouched. | `FE/AGENTS.md` § Performance Budget explicitly permits a documented raise for deliberate growth. Signed-in users never download it. |

---

## 3. Ubiquitous language

Terms mean exactly this. Do not introduce a synonym.

### Identity & tenancy

- **Organization** — the tenant. One business. Owns every other document here.
- **Location** — a warehouse, shop, or van within an Organization. Stock lives at a Location.
- **User** — a person with a Role inside exactly one Organization.

### Catalogue

- **Product** — something sold or stocked. Has a **SKU** (unique per Organization),
  optional **barcode**, a **Category**, a purchase price, a selling price, a **TaxClass**,
  and a **reorderLevel**.
- **Category** — a single-level grouping of Products.
- **TaxClass** — named rate bundle (e.g. "Standard 18%", "Exempt") resolved by the TaxAdapter.

### Stock

- **StockLedgerEntry** — one immutable movement. Carries `product`, `location`, `quantity`
  (signed), `unitCost`, `reason`, `reference`, and optional `batchNo`/`expiry`.
- **StockReason** — `PURCHASE | SALE | SALE_RETURN | PURCHASE_RETURN | ADJUSTMENT |
  TRANSFER_IN | TRANSFER_OUT | OPENING`.
- **StockOnHand** — the sum of ledger quantities for a (product, location). Cached on
  Product for list speed; recomputable at any time.
- **StockTransfer** — a paired `TRANSFER_OUT` / `TRANSFER_IN` between two Locations.

### Selling

- **Sale** — a completed transaction. Immutable once `COMPLETED`. Has **SaleLines**.
- **SaleLine** — product, quantity, unit price, discount, tax, line total.
- **Invoice** — the customer-facing document for a Sale. Numbered per Organization.
- **SaleReturn** — a reversal of some or all lines of a Sale. Never edits the original.
- **Payment** — money received against a Sale or applied to a Customer's balance.
- **PaymentMethod** — `CASH | BANK | CARD | CREDIT | WALLET`.

### Buying

- **Supplier** — who you buy from. Carries an outstanding payable balance.
- **PurchaseOrder** — an intent to buy. `DRAFT → SENT → PARTIALLY_RECEIVED → RECEIVED`.
- **GoodsReceipt** — the act of receiving stock against a PurchaseOrder. This is what
  writes `PURCHASE` rows into the StockLedger and recomputes WAC.
- **SupplierBill** — what you owe for a GoodsReceipt.

### Credit & money

- **Customer** — who you sell to. Carries a **creditLimit** and an **outstanding** balance.
- **CustomerLedgerEntry** — immutable row; a Sale on credit debits, a Payment credits.
- **Aging bucket** — `CURRENT | D1_30 | D31_60 | D61_90 | D90_PLUS`.
- **CashAccount** — a cash drawer or bank account. Money moves between these.

### Intelligence

- **Conversation** — a WhatsApp thread with one Customer.
- **DraftOrder** — the AI's structured interpretation of a Conversation. **Always** requires
  human confirmation before becoming a Sale.
- **ClerkQuery** — a natural-language business question. Resolved to a deterministic
  aggregation, never to a number the model invented.
- **Automation** — a scheduled job producing a digest or a reminder.

---

## 4. The deterministic boundary

This is D9, stated precisely, because it is the decision most likely to erode.

**AI may:**
- Parse a WhatsApp message into a DraftOrder (product matches + quantities).
- Translate a natural-language question into a *query specification*.
- Extract structured data from a receipt or invoice image.
- Draft customer-facing message text.
- Summarize numbers it was *given*.

**AI may never:**
- Compute a tax amount, a line total, a balance, or a stock level.
- Decide whether a customer is over their credit limit.
- Write to the StockLedger, CustomerLedger, or any Sale.
- Grant, check, or bypass a permission.

Every number a user sees comes from a deterministic aggregation. The model formats
and explains; it does not calculate. A ClerkQuery resolves to a named, typed report
function — the model picks *which* function and *which* arguments, and the code does
the arithmetic.

---

## 5. Invariants

Enforced in code, not by convention:

1. A Sale never completes if a line's stock would go negative — unless the Organization
   has `allowNegativeStock` enabled.
2. A credit Sale never completes if it would push the Customer past `creditLimit` —
   unless overridden by a User with the explicit `override:credit-limit` permission.
3. `StockLedgerEntry` and `CustomerLedgerEntry` are **append-only**. Corrections are new
   compensating rows, never updates or deletes.
4. Invoice numbers are unique per Organization, gapless, and allocated atomically.
5. Every monetary field is an integer, and is accompanied by the Organization's currency.
6. Every query for a business-domain collection is filtered by `organization`. No exceptions.
7. A completed Sale is immutable. Changes happen through SaleReturn.

---

## 6. Repository layout

```
new/
├── BE/                 NestJS 11 + MongoDB (Mongoose 9) + CASL
│   └── src/modules/    one folder per bounded context
├── FE/                 React 19 + Vite + TanStack Query + Tailwind v4
│   └── src/            see FE/AGENTS.md § Directory Map
├── CONTEXT.md          this file
├── package.json        root orchestration (not a pnpm workspace — see D14)
└── scripts/dev.mjs     runs both halves in one terminal
```

Both halves enforce their own quality gate (`pnpm verify`). Neither gate is to be
weakened to make a red build green — see `BE/AGENTS.md` and `FE/AGENTS.md`.
