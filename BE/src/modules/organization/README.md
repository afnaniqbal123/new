# Organization

The tenant root. Owns `Organization` and `Location`, and is the only module
that writes either collection.

## What it owns

| Collection     | What it is                                                    |
| -------------- | ------------------------------------------------------------- |
| `Organization` | One business. The tenant every other domain document hangs off |
| `Location`     | A warehouse, shop, or van where stock physically sits          |

## Why other modules depend on it

Four pieces of tenant state are needed almost everywhere, and none of them may
be read by querying the `Organization` collection directly
(`nestjs/no-foreign-schema-read`):

| Need it for                      | Call                                     |
| -------------------------------- | ---------------------------------------- |
| Currency, tax rates, negative-stock policy | `getSettings(organizationId)`   |
| The next invoice number          | `allocateInvoiceNumber(organizationId)`  |
| The location a request defaults to | `getDefaultLocationId(organizationId)` |
| Checking a caller owns a location | `assertLocationBelongs(org, location)`  |
| Enforcing a SaaS plan limit      | `assertWithinPlanLimit(org, resource)`   |

## Two things here that are easy to get wrong

**Invoice numbers are allocated with `$inc`, never read-then-written.** Two
cashiers completing a sale in the same millisecond is the ordinary case at a
busy counter, and a read-then-write hands both the same legally-significant
number. `allocateInvoiceNumber` is the only correct way to get one.

**Locations are deactivated, never deleted.** Stock ledger rows reference them
permanently, and the ledger is append-only — a dangling reference in an
immutable history loses the answer to "where did this movement happen?".
`removeLocation` also refuses to retire the last active one, because an
Organization with no location cannot receive stock.

## Team membership

`Organization` exposes invite/update/remove, but the writes happen in
`UserService` — the `User` collection's owner. Two rules are enforced there
and worth knowing:

- A role change or deactivation revokes the member's sessions
  (`CredentialRevocationService.onAuthorizationChanged`). Access tokens carry
  role claims and are verified without a database read, so a demotion would
  otherwise take up to 15 minutes to bite.
- The last remaining `OWNER` cannot be demoted or removed. An ownerless
  organization cannot be billed, transferred, or closed by anyone.

## Plan limits

`PLAN_LIMITS` in `constants/organization.constant.ts` is the single source of
truth for what each plan permits — the guard and the pricing page read the
same table. Countable limits (`users`, `products`, `locations`) go through
`assertWithinPlanLimit`; boolean features (`whatsapp`, `aiClerk`,
`automations`) through `hasFeature`, called by the module that owns the
feature so that adding a plan needs no edit here.

See [`CONTEXT.md`](../../../../CONTEXT.md) § D1, D6, D7, D12 for the decisions
behind all of this.
