# ADR: URL-addressable page state

**Status:** Accepted
**Issue:** #32 — Add URL-addressable page state for routing, filters, tabs, pagination, and
modal context

## The problem

Routes pointed at a page, not at a view of that page. Filters, search text, the selected
page number, and which dialog was open all lived in `useState`/Zustand. A refresh lost them.
A shared link never reproduced the same view. The back button didn't undo a filter change.

## Current router

React Router v7 (`^7.18.2`), data router (`createBrowserRouter`) — see `src/routes/
AppRouters.tsx`. Not changing this was a hard constraint (see Options below).

## Pages that held this kind of state before this change

- `src/components/example/ExampleWidget.tsx` — search query + page number, in a
  feature-scoped Zustand store (`exampleWidgetStore.ts`); which row's edit modal was open,
  in local `useState`.

This is the only list/search page in the boilerplate today (by design — AGENTS.md rule #1,
zero business-domain lock-in). It's also the reference feature every new list page copies,
so migrating it is the highest-leverage single change available.

## Options considered

| Option                                                                    | Verdict                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Our own hooks** (`useSearchParams` + a hand-written `useTableState`) | Rejected as the _only_ layer — no ready parsers for int/bool/array, so every page reimplements bad-value fallback by hand. Its shape survives as the thin wrapper hooks below (Option B _is_ Option A, with nuqs supplying the parser layer). |
| **B. `nuqs`**                                                             | **Chosen.** Small (see bundle numbers below), works with our existing router via `nuqs/adapters/react-router/v7`, and its API is a drop-in `useState` replacement — no new mental model for a page author.                                    |
| **C. TanStack Router**                                                    | Rejected. Would mean replacing `createBrowserRouter` across the whole app — a big, unrelated migration to buy type-safe search params, when nuqs gets close-enough type safety (parser generics) without touching the router.                 |

## Modal state: D1 (query param) for a small dialog

`EditExampleItemModal` — a small dialog with no meaningful sub-navigation of its own — now
carries its context as `?modal=edit&id=<itemId>` (see `src/lib/url-state/useModalUrlState.ts`).
D2 (a child route, e.g. `/example/42/edit`) is reserved for a dialog large/complex enough to
deserve its own URL segment (e.g. a multi-step wizard) — no example of that ships yet, but
`useModalUrlState`'s `id` param is deliberately plain (not part of the shared key registry)
so a future large dialog isn't forced through this same hook.

`id` is looked up against whatever the list has already loaded, not carried as its own copy
of the row's data — a stale or tampered `id` (a shared link opened after the row moved off
that page, or after it was deleted) just fails to find a match and the modal stays closed,
per the "a bad value in the URL must not break the page" rule.

## What actually changed (proof-of-concept, on this branch)

- Added `nuqs` (`^2.10.1`) as a dependency. No install/build script — nothing to add to
  `pnpm-workspace.yaml`'s `allowBuilds` (AGENTS.md § Package Manager & Supply Chain).
- `src/lib/url-state/keys.ts` — the standard key registry (`UrlStateKey`: `PAGE`, `LIMIT`,
  `Q`, `SORT`, `TAB`, `MODAL`), a real `enum` per AGENTS.md § Constant Registries.
- `src/lib/url-state/useTableUrlState.ts` — the reference hook a new paginated/searchable
  page copies: `{ query, page, setQuery, setPage }`, backed by `q`/`page` in the URL.
  Changing the query resets `page` back to `1` in one history entry (`useQueryStates`'
  batched update), same behavior the old Zustand store had.
- `src/lib/url-state/useModalUrlState.ts` — the reference hook for a D1 dialog.
- `src/routes/AppRouters.tsx` — every route now renders inside a single `NuqsAdapter`
  (`nuqs/adapters/react-router/v7`), added as one wrapping pathless `<Route>` around the
  existing route tree (has to sit _inside_ what `RouterProvider` renders, not outside it,
  since the adapter reads `useSearchParams`/`useNavigate`).
- `src/components/example/ExampleWidget.tsx` migrated off `exampleWidgetStore.ts` (deleted —
  nothing left in it once query/page moved to the URL) onto the two hooks above.
- `src/test/renderWithProviders.tsx` uses `nuqs/adapters/testing`'s `NuqsTestingAdapter`
  (`hasMemory: true`), not the real router adapter. **Why:** nuqs keeps its URL-update queue
  as a module-level global (`globalSingleton('sync-emitter', ...)` in `nuqs/dist/index.js`);
  the real adapter doesn't clear it on mount, so two workflow tests in the same file leaked
  search state into each other even with a fresh `MemoryRouter` per test (confirmed by
  reproducing it — a later test's initial render showed the previous test's filtered list).
  `NuqsTestingAdapter` resets that queue on every mount specifically to make this safe in a
  test runner; it's nuqs's own documented answer to this, not a workaround we invented.
- `docs/adr/url-page-state.md` (this file).

## Verified

- `pnpm check:types`, `pnpm check:test` (66 tests, including every existing
  `ExampleWidget`/`AddExampleItemModal`/`EditExampleItemModal`/`DeleteExampleItemButton`
  workflow test, unchanged in behavior), `pnpm check:lint`, `pnpm check:a11y`,
  `pnpm check:format`, `pnpm check:style`, `pnpm check:doctor` (no new findings — the 6
  warnings present before this change, in unrelated Auth mutation hooks, are untouched),
  `pnpm check:build`, `pnpm check:build-budget`, and `pnpm check:e2e` (the real Chromium
  smoke test, which exercises `ExamplePage` through the real `NuqsAdapter` + real MSW
  browser worker, not the testing adapter) all pass.
- Bundle cost: after this change, `pnpm check:build-budget` reports 124.17 kB gzipped on the
  entry chunk and 228.88 kB gzipped total JS — comfortably inside the existing
  `.size-limit.js` budgets (195 kB / 268 kB; see AGENTS.md § Performance Budget). `nuqs`
  itself is a few kB gzipped (no heavy transitive deps), not large enough on its own to be
  worth a separate before/after bundle diff.
- Bad URL value: `?page=abc` or `?page=-1` — `parseAsInteger.withDefault(1)` returns the
  default instead of throwing; `?modal=edit&id=does-not-exist` — `editingItem` resolves to
  `null` and the dialog simply doesn't open. Neither crashes the page.
- Back button: browser back after a search/page change lands on the previous `?q=`/`?page=`
  combination, which nuqs re-parses into the previous filtered view — no code needed beyond
  the hooks above, since that's a plain URL-driven history entry now.
- No token or personal data enters the URL — `q`, `page`, `modal`, `id` are all either
  literal search text the user typed or an opaque item id already visible in the page.

## After we agree (tracked here, not repeated elsewhere)

- Shared module: done — `src/lib/url-state/` (`keys.ts`, `useTableUrlState.ts`,
  `useModalUrlState.ts`).
- One migrated page as the example to copy: done — `ExampleWidget`.
- Rule surfaced in `AGENTS.md` so an agent follows it without a reminder: done — see
  § Data & State's "URL-addressable page state" bullet and the `src/lib/url-state/` entry
  in the Directory Map.
- Migration checklist: N/A today — `ExampleWidget` is the only list/search page this
  boilerplate ships (AGENTS.md rule #1). A real project's next list page copies
  `useTableUrlState`/`useModalUrlState` the same way it already copies the rest of the
  `ExampleWidget` shape (see AGENTS.md's "Where things go" → "A screen/feature" entry).

## Open questions from the issue, answered

1. _Can we change the router, or must it stay?_ Stayed — Option C (TanStack Router) was
   rejected specifically because it would have required changing it.
2. _Short keys or full words?_ Full words (`page`, `q`, `modal`), matching the issue's own
   example URL (`?status=active&page=3`) and Claude's own `#settings/usage` precedent — a
   query string a person reads (in a browser bar, in a bug report) should stay legible.
