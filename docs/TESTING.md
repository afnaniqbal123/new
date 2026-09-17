# Testing BusinessOS by hand

A walkthrough of every feature, what to click, and what you should see. Written
against the seeded demo business (**Kolachi Traders**), so the figures quoted
here are the ones actually on your screen.

Nothing in this guide needs an API key. Where a feature behaves differently
once a key is present, it says so and points at
[CREDENTIALS.md](./CREDENTIALS.md).

---

## 1. Start it up

You need **MongoDB running locally** and nothing else.

```bash
# 1. Backend  (port 8080)
cd BE
cp .env.example .env          # first time only — see below
pnpm install
pnpm seed:demo                # creates the demo business
pnpm start:dev

# 2. Frontend (port 5173) — in a second terminal
cd FE
pnpm install
pnpm dev
```

Then open **<http://localhost:5173>**.

**The only `.env` values that must be filled** for the app to run:

```
MONGODB_URI=mongodb://127.0.0.1:27017/businessos
JWT_SECRET=<any string of 32+ characters>
OTP_SECRET=<any string>
```

Generate a secret with `openssl rand -base64 48`. Everything else is optional —
you will see startup warnings about Stripe and Redis, and those are **expected
and harmless**; each says exactly what degrades.

### Re-seeding

The seed refuses to run twice (it would duplicate the business). To start over:

```bash
mongosh "mongodb://127.0.0.1:27017/businessos" --eval "db.dropDatabase()"
cd BE && pnpm seed:demo
```

### What the seed creates

| Thing | Amount |
| --- | --- |
| Products | 21, across 6 categories |
| Customers | 6, some on credit terms |
| Suppliers | 3 |
| Sales | 98, spread over the last 30 days |
| Receivables | ~PKR 127,000 outstanding |
| Stock value | ~PKR 310,000 at weighted-average cost |
| WhatsApp | 2 conversations, one with a draft order waiting |

---

## 2. Sign in — the six roles

**Password for every account: `BusinessOS!2026`**

> **Use whatever addresses the seed printed.** The table below is the default.
> If you pointed the seed at a real mailbox (plus-addressing such as
> `you+owner@yourdomain.com` is the usual way to make verification emails
> actually arrive), set `VITE_DEMO_EMAIL_PATTERN` in `FE/.env.local` to match —
> e.g. `you+{role}@yourdomain.com` — so the one-click role buttons on the
> sign-in screen fill in addresses that exist.

| Role | Email | Who they are |
| --- | --- | --- |
| Owner | `owner@kolachi.test` | Sees and does everything, including billing |
| Admin | `admin@kolachi.test` | Everything except committing to a paid plan |
| Manager | `manager@kolachi.test` | Runs buying, stock and pricing; no billing |
| Cashier | `cashier@kolachi.test` | Sells. Never sees cost, margin or profit |
| Accountant | `accountant@kolachi.test` | Money and reports; does not work the till |
| Viewer | `viewer@kolachi.test` | Read-only, no money figures |

### The fastest way to switch roles

On the sign-in screen, **Demo accounts** gives you a button per role that fills
the form. It renders only in a development build — Vite strips it from a
production bundle entirely, addresses included — and it fills rather than
submits, so the password is still something you consciously send.

### The permission test worth doing first

This is the single most convincing thing in the product, and it takes a minute.

1. Sign in as **owner**. On the dashboard you see **Gross profit** and **Stock
   value** tiles, and the sidebar has 14 entries including *Purchasing*, *Team*
   and *Billing*.
2. Sign out. Sign in as **cashier**. The same dashboard now has **no profit and
   no stock-value tile**, and the sidebar is down to 10 entries — *Purchasing*,
   *Suppliers*, *Team* and *Billing* are gone.
3. As the cashier, type `/purchasing` into the address bar. You land on **403**,
   not a broken page.
4. Still as the cashier, go to **Reports** and try **Profit**. The API refuses
   it.

The point: those numbers are **stripped from the API response**, not hidden
with CSS. A cashier who opens developer tools finds no margin in the payload.

### What each role sees in the sidebar

Verified by signing in as each one:

| Nav item | Owner | Admin | Manager | Cashier | Accountant | Viewer |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Point of Sale | ✓ | ✓ | ✓ | ✓ | — | — |
| Sales | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| WhatsApp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Products | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Inventory | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Purchasing | ✓ | ✓ | ✓ | — | ✓ | — |
| Customers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Suppliers | ✓ | ✓ | ✓ | — | ✓ | — |
| Reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AI Clerk | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Team | ✓ | ✓ | ✓ | — | — | — |
| Billing | ✓ | ✓ | — | — | ✓ | — |
| Settings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Profit / stock value on dashboard** | ✓ | ✓ | ✓ | — | ✓ | — |

---

## 3. The landing page

Sign out (or open a private window) and go to <http://localhost:5173>.

- [ ] The hero renders a **rotating 3D lattice** on the right with three
      orbiting pulses. Move your mouse — the scene leans toward the cursor.
- [ ] Scroll to **How it works**: a WhatsApp message on the left becomes a
      priced order on the right. The arithmetic is real — 24 bottles at
      Rs 150 plus 10 tubes at Rs 260 is Rs 6,200, plus 18% GST is **Rs 7,316**.
- [ ] Click the **theme icon** in the header. Light, dark and system all work,
      and the choice survives a refresh.
- [ ] Resize to phone width. The 3D scene disappears (deliberately — it does
      not even initialise a GPU context below 1024px), and nothing scrolls
      sideways.
- [ ] Open the **FAQ** entries — they are `<details>` elements, so they work
      with the keyboard and without JavaScript.
- [ ] **A day, screen by screen** is a carousel. It advances on its own until
      you touch it, then stops for good. Tab to the arrows and use the left and
      right arrow keys. The figures on each slide are the ones the seeded demo
      actually produces, so they match what you see after signing in.

---

## 4. Point of Sale

Sign in as **cashier** (or owner) → **Point of Sale**.

1. **Search** "coca" and click the product. It is added at quantity 1.
2. Change the quantity to **24**.
3. Add **Colgate**.
4. Watch the totals panel.

- [ ] The total updates **after a short pause**, not instantly — every figure
      comes from `POST /sales/quote` on the server. The browser never does
      money arithmetic; that is why what you see and what prints are guaranteed
      to be the same number.
- [ ] Apply a discount. Tax recalculates on the discounted amount, not the
      gross.
- [ ] Pick a **customer** and choose **Credit** as the payment method. If the
      order would push them past their credit limit, the sale is refused with
      the exact shortfall.
- [ ] Try to sell more units than exist (`A4 Paper` is at zero). Refused, with
      the available quantity named.
- [ ] Complete a cash sale. You get an invoice number (`KT-000099`, then 100,
      …). **Numbers are never reused**, even if a later sale fails.

Now check it landed everywhere: **Sales** lists it, **Inventory** shows the
stock movements, and the customer's balance moved if it was on credit.

---

## 5. WhatsApp — without any credentials

This is the feature people assume needs a Meta account. It does not.

Sign in as **owner** → **WhatsApp**.

- [ ] Two seeded conversations are in the inbox; one has an unread badge.
- [ ] Click **Raza General Store** to read the thread.
- [ ] Use **simulate an incoming message** and send something like:

      > need 2 cartons coke 1.5L and 10 colgate

- [ ] It appears in the thread, and a **draft order** is created — products
      matched, quantities converted from cartons to bottles using each
      product's pack size, priced, taxed, stock- and credit-checked.
- [ ] Each matched line shows a **confidence** badge. Anything below *High* is
      surfaced for you to check rather than silently accepted.
- [ ] **Confirm** the draft. It becomes a real sale with a real invoice number,
      through exactly the same code path as a counter sale.

Without `GEMINI_API_KEY` the matching is done by the deterministic matcher
alone (token overlap plus trigram similarity), which handles this phrasing
fine. With a key, free-form sentences parse better. Either way **the model
never produces a number** — see [CREDENTIALS.md](./CREDENTIALS.md) § Gemini.

---

## 6. Inventory — and the append-only ledger

Sign in as **manager** → **Inventory**.

- [ ] The ledger lists every movement with its reason, the change, and the
      **balance after** it. Nothing here can be edited — the schema refuses it.
- [ ] Record an adjustment: **+10** of something, reason *Adjustment*. A new
      row appears; the old rows are untouched.
- [ ] Now try to write off **more than exists** — say −9999 of Dalda Cooking
      Oil. **Refused**, naming what is actually available.

That last check matters: it is the same invariant the sales path enforces.
Stock cannot go negative from any direction unless you deliberately turn on
*Allow selling below zero stock* in Settings.

---

## 7. Purchasing

Sign in as **manager** → **Purchasing**.

- [ ] **What to reorder** lists products at or below their reorder level, with
      a suggested quantity and current cost. It is derived from real stock, not
      a static list.
- [ ] Create a purchase order for a supplier. Note that **stock does not
      move** — an order is a promise.
- [ ] **Receive** part of it — say 10 of 24 ordered. Now stock moves, the
      order goes to *Partially received*, and a payable to the supplier is
      created.
- [ ] Check the product's average cost. If you received at a different price
      than before, the **weighted average** has moved accordingly — and the
      inventory ledger shows the inbound movement at the price you actually
      paid.
- [ ] Receive the rest. The order becomes *Received*.

---

## 8. Customers and credit

Sign in as **accountant** → **Customers**.

- [ ] The **receivables aging** band across the top buckets everything by how
      far overdue it is (current, 1–30, 31–60, 61–90, 90+). With the seeded
      data, roughly PKR 127,000 is outstanding.
- [ ] Open a customer. Their **ledger** is append-only, same as stock — every
      invoice, payment and adjustment, with a running balance.
- [ ] Record a payment. The balance falls and the aging band updates.
- [ ] Lower their credit limit below what they owe, then try to sell to them on
      credit from the POS. Refused.

---

## 9. Reports

**Reports** — available to every role, but filtered per role.

- [ ] Thirteen reports: sales summary, sales by day, best sellers, top
      customers, profit, receivables aging, payables, low stock, stock
      valuation, slow-moving stock, expiring stock, purchases, cash position.
- [ ] Switch the **period** — today, this week, this month, last month, last 30
      days, this year. Ranges are computed in the **business's own time zone**
      (Settings → Time zone), not the server's.
- [ ] As **cashier**, open **Profit**. Refused — and the refusal comes from the
      API, not the interface.

---

## 10. The AI Clerk

**AI Clerk** in the sidebar.

**Without `GEMINI_API_KEY`** (the default): the page says plainly that the
clerk is not configured, and suggests nothing else is broken. That is the whole
behaviour — no errors, no spinner that never resolves.

**With a key** (see [CREDENTIALS.md](./CREDENTIALS.md) § Gemini), ask things
like:

- "How much money do people owe me?"
- "What were my sales this month?"
- "Which products are running low?"

The model picks **which report to run**. The numbers come from the same code
that prints your invoices. You can prove this: ask a question, then run the
same report manually from the Reports page — the figures match exactly, because
they are the same call.

---

## 10b. The assistant on the landing page

Sign out and open <http://localhost:5173>. A round button floats bottom-right.

- [ ] Open it. It suggests four questions; click one and you get an answer in a
      second or two.
- [ ] Ask something of your own — "can I use it for two shops?", "what happens
      if my cashier makes a mistake?"
- [ ] Ask it something it cannot know: *"how much does Raza General Store owe
      me?"*. It answers about the **credit feature**, not with a figure. It has
      no account, no organization and no database access at all — see
      `BE/docs/adr/0007-public-product-assistant-endpoint.md`.
- [ ] Stop the backend and ask again. The widget says so in the conversation
      rather than throwing a toast over the page.

Without `GEMINI_API_KEY` this still works: the server returns the best-matching
curated answer instead of a rephrased one. With a key, answers are written to
fit the question asked.

**If answers come back oddly generic**, the model id may have been retired.
Google returns a 404 naming the replacement — check the backend log for
`Gemini summarisation failed`, and update `GEMINI_MODEL` in `BE/.env`.

---

## 11. Settings

**Settings** — sign in as **owner**.

- [ ] **Business**: change the trading name and save. Note that **currency is
      locked** — every stored amount is an integer in that currency's smallest
      unit, so changing the code would reinterpret history rather than convert
      it.
- [ ] **Tax**: change the rate to 17% and save. New sales use 17%; **past
      invoices keep the rate they were issued under**. Check an old sale to
      confirm.
- [ ] **Invoice numbering**: change the prefix or digit count. The "next
      invoice will be" preview updates live before you save.
- [ ] **Operations**: toggle *Allow selling below zero stock*, then retry the
      over-sell from §4. Now it is permitted. **Turn it back off.**
- [ ] **Locations**: add one. Stock is tracked per location from day one.
- [ ] Sign in as **cashier** and revisit Settings. Every field is readable and
      **disabled**, with a line explaining why. No Save buttons at all.

---

## 12. Team and Billing

**Team** (owner, admin, manager):

- [ ] All six members listed with roles and status.
- [ ] Invite a member, change a role, deactivate someone.
- [ ] The **last owner cannot be removed or demoted** — a business with no
      owner has nobody who can restore access.

**Billing** (owner, admin, accountant):

- [ ] Plans render with limits. Without Stripe configured, it says so and no
      feature is gated.
- [ ] With Stripe test keys (see [CREDENTIALS.md](./CREDENTIALS.md) § Stripe),
      checkout works with card `4242 4242 4242 4242`. Note that the plan only
      changes when the **webhook** arrives — not on the redirect back.

---

## 13. Auth

- [ ] **Sign up** a new account at `/signup`. An OTP is generated; without
      Brevo configured, read it from the backend terminal.
- [ ] **Forgot password** at `/forgot-password`, same idea.
- [ ] **Session**: sign in, then leave the tab for 15 minutes. The access token
      expires and is refreshed silently — you should not be logged out.
- [ ] **Two tabs**: sign out in one, and the other follows.
- [ ] Open a protected URL like `/reports` while signed out. You are sent to
      login, with no flash of the app's sidebar first.

---

## 14. Running the automated checks

```bash
cd FE && pnpm verify     # 16 checks: types, tests, lint, a11y, bundle size, browser smoke
cd BE && pnpm verify     # lint, types, architecture boundaries, documentation
cd BE && pnpm test       # 323 unit tests
```

`FE/pnpm verify` includes a real Chromium run with axe-core accessibility scans
and blocking bundle-size budgets.

---

## Troubleshooting

**"Login does nothing" / stuck on the login screen**
Check the backend is actually up: `curl http://127.0.0.1:8080/`. If you have
two backends running, the stale one may hold port 8080 —
`lsof -ti:8080 | xargs kill -9`, then restart.

**The seed says the demo data already exists**
Drop the database first — see §1.

**Dashboard shows zeros**
`FE/.env.local` should have `VITE_API_BASE_URL=http://127.0.0.1:8080` and
`VITE_ENABLE_MOCKS=false`. With mocks on, you get fixed fake figures and no
backend at all.

**Startup warnings about Stripe and Redis**
Expected. Each names precisely what degrades, and nothing stops.

**"Today's sales" is zero**
The seed backdates its 98 sales across the previous 30 days, so the current day
starts empty. Ring up a sale in the POS and the tile updates.
