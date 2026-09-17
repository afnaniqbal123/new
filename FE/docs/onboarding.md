# Repo Workflow & Onboarding Reference

A-to-Z, practical companion for a brand-new developer **or** AI coding agent working in this
repo for the first time. This is not the rulebook — [`AGENTS.md`](../AGENTS.md) is the single
canonical source of truth for _what the rules are_, and [`docs/GUIDE.md`](./GUIDE.md) explains
those rules at greater length. This document is the _how things actually run, step by step,
command by command_ companion: what happens when you type `pnpm install`, what happens when
you `git commit`, what CI does, and where to look when something breaks.

If anything here ever conflicts with `AGENTS.md`, `AGENTS.md` wins — file an update to this
doc.

---

## 1. First-time setup

```bash
git clone https://github.com/Gok-boilerplates/React-Agent-First-Kit.git
cd React-Agent-First-Kit
pnpm install
pnpm dev
```

That's it — the app is at `http://localhost:5173`. There is **no real backend**: MSW (Mock
Service Worker, `src/mocks/`) intercepts every request in dev and answers with fixture data, so
the app runs fully out of the box. `VITE_ENABLE_MOCKS=true` is the default (`src/constants/
env.ts`); nothing else needs configuring for local dev.

### What `pnpm install` actually does (and doesn't do)

- Installs dependencies from `pnpm-lock.yaml` (canonical — `packageManager: "pnpm@11.23.0"` in
  `package.json` pins the exact pnpm version).
- Runs `pnpm-workspace.yaml`'s supply-chain hardening on every resolve: `minimumReleaseAge:
4320` (a package version must be published ≥ 3 days before pnpm will install it — applies on
  CI's `--frozen-lockfile` runs too, since `trustLockfile` is never set here) and `allowBuilds`
  (only `msw` is allowed to run its postinstall script — regenerates
  `public/mockServiceWorker.js` from this repo's own `package.json#msw.workerDirectory`
  config, no network access; `puppeteer`, an optional transitive dep of `impeccable`, is
  explicitly denied because `check:style`'s actual invocation never needs its Chromium
  download).
- Runs exactly one lifecycle script: `"prepare": "husky"` — this sets up the Husky git hooks
  (`.husky/pre-commit` → `node scripts/hooks/pre-commit.mjs`; `.husky/commit-msg` →
  `commitlint --edit`). **It does not write or modify any tracked file** — installing
  dependencies never mutates your working tree. (This is the same "commands don't mutate
  unless their name says so" rule that governs every other command in this repo — see § 6.)
- Does **not** run `pnpm ai:sync`, `pnpm verify`, or any check. A fresh clone is runnable
  and dev-ready, nothing more.

### Environment variables (optional for local dev)

Copy `.env.example` to `.env.local` if you need to point at a real backend or disable mocks:

```bash
cp .env.example .env.local
```

- `VITE_API_BASE_URL` — host for the Axios client (`src/services/api-client.ts`); empty =
  same-origin (dev + tests use MSW). Route paths in `src/constants/<concern>.ts` (e.g.
  `AuthRoutes` in `auth.ts`) are already absolute (`/auth/login`), so this is host-only —
  never add a version prefix like `/api/v1` here or to an individual route string.
- `VITE_ENABLE_MOCKS` — `true` (default) keeps the app runnable with no backend.
- `VITE_E2E` — internal, set only by `.env.e2e` via `pnpm build:e2e`; never set this by hand.

Every env var is Zod-validated at module load (`src/constants/env.ts`) — a missing/malformed
value fails loudly at startup instead of silently shipping a broken config.

### Node version

`package.json`'s `engines.node` requires `>=22.0.0`. There's no `.nvmrc` in this repo — use
whatever Node 22+ toolchain manager you prefer.

---

## 2. Repo mental model

### Every top-level folder in `src/`

| Folder                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/common/`  | Reusable, domain-agnostic UI primitives (Button, Input, Dialog, DataTable, Pagination, Can, etc.) — built on Radix UI + CVA, the shadcn/ui pattern. Never has its own `*.test.tsx` (see § Testing philosophy).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `components/auth/`    | The 5 auth forms (Login, Signup, Otp, ForgotPassword, ResetPassword). One of the two "copy this" reference features.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `components/example/` | `ExampleWidget` — a generic paginated/searchable list. The other "copy this" reference feature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `components/<role>/`  | Components scoped to one role's own pages (mirrors `pages/<role>/`). Empty by default — neither shipped role (`member`, `admin`) currently needs a role-specific component beyond its one placeholder page; a folder is created the moment a real one is needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `components/layouts/` | `AppLayout` (public shell), `AuthLayout` (guest-only auth screens), `ErrorLayout` (404/error boundary), `RoleLayout` (renders the right sidebar shell for whichever role is signed in, driven by `routes/ProtectedRoutes.tsx`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pages/common/`       | Pages every role can reach: `ForbiddenPage`, `ExamplePage`, and the shipped common-route placeholders (`SettingsPage`, `ProfilePage`, `NotificationsPage`). `"/"` itself is `routes/HomeRedirectRoute.tsx` — an auth-aware redirect, not a page here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `pages/auth/`         | Route-level glue for the 5 auth pages — thin wrappers around `components/auth/`'s forms.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pages/<role>/`       | Pages owned by one role. Ships with `member/DashboardPage.tsx` (`Role.MEMBER`) and `admin/AdminDashboardPage.tsx` (`Role.ADMIN`) — both placeholders, not real features.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `hooks/<concern>/`    | Every hook, company-wide convention: `src/hooks/<concern>/<hookName>.ts` — `common/` for anything generic or cross-role (`useDebouncedValue`, `useThemeSync`, `useSyncAuthAcrossTabs`, and every feature-data hook like `useExampleItems`, never co-located in the feature's own folder), `auth/` (`useAuth.ts` — every auth mutation hook: `useLogin`, `useSignup`, `useLogout`, `useForgotPassword`, `useResetPassword`, `useVerifyOtp`, plus `useResendSignupOtp`/`useVerifyForgotPasswordOtp` for the forgot-password OTP flow), or a role name (`admin`/`member`) for a hook genuinely specific to that role's own pages. No role-specific hook exists yet, so `hooks/admin/`/`hooks/member/` don't either — expected, not a gap; created the moment one is actually needed. **A hook's `queryFn`/`mutationFn` always calls into a matching `services/<concern>/` function — never `apiClient` directly.** |
| `lib/`                | `utils.ts` — the `cn()` class-merge helper every CVA/Radix component uses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `services/<concern>/` | `api-client.ts` (Axios instance: bearer-token attach + single-flight refresh-and-retry on 401) and `queryClient.ts` (the app's one TanStack `QueryClient`, with global error-toast wiring) stay at `services/` root — cross-cutting infrastructure every concern depends on, not a "concern" of its own. Every other file is one API client per concern — `auth/authService.ts`, `common/exampleService.ts`, and one such file per role/concern once it has a real endpoint — one typed async method per endpoint, each owning both the `apiClient` call and the boundary Zod validation.                                                                                                                                                                                                                                                                                                                       |
| `utils/`              | Pure, side-effect-free functions only — 100% unit-testable by construction.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `schemas/<concern>/`  | Zod schemas, one folder per concern (same convention as `hooks/`/`services/`): `common/common.schema.ts` (shared primitives — email/password/phone/url) + `common/example.schema.ts`, `auth/auth.schema.ts`, and one folder per role once it has a real schema. Form schemas and API-contract schemas both live here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `types/<concern>/`    | Shared TS `interface`s, split the same way as `hooks/`/`services/`: `common/` for anything genuinely cross-concern (`ApiResponse`, `Paginated`), `auth/` for auth-scoped types (`AuthUser`, `AuthTokens`). The one place where barrel `index.ts` re-exports are allowed (never for components).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `constants/`          | One route-enum file per portal/concern — `auth.ts` (`AuthRoutes`), `common.ts` (`CommonRoutes`), and one such file per additional role/concern the moment it has a real endpoint — never one flat `api-routes.ts` or one enum per feature; every route string is absolute/host-only, never a hardcoded version prefix. Plus `queryKeys.ts` (the global `QueryKey` enum, deliberately flat/not per-concern — every TanStack Query key in the app), `config.ts`, `env.ts` (the Zod-validated `import.meta.env` wrapper — see § 1).                                                                                                                                                                                                                                                                                                                                                                                |
| `routes/`             | The entire routing system — see the dedicated walkthrough below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `stores/`             | Zustand stores, one file per domain slice: `authStore` (persist-backed — source of truth for access/refresh tokens + user + `hasHydrated`), `themeStore` (light/dark/system), `toastStore`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `mocks/`              | `handlers.ts` (shared MSW fixtures/handlers), `browser.ts` (dev-time MSW worker), `server.ts` (Node MSW server — tests only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `test/`               | `setup.ts` (Vitest setup: jest-dom matchers, MSW server lifecycle, jsdom `matchMedia`/Pointer-Capture/`scrollIntoView` stubs Radix needs), `renderWithProviders.tsx` (fresh `QueryClient` + `MemoryRouter` per test).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `i18n/`               | `index.ts` (i18next setup + `resources` registry) + `locales/<lng>/common.json` — the _only_ source of user-facing text in this repo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### The two reference features — why copy them, not invent

- **`components/example/` + `pages/common/ExamplePage.tsx`** — a generic, data-driven,
  paginated/searchable list screen. Already wired to a TanStack Query hook
  (`src/hooks/common/useExampleItems.ts` — hooks live under `src/hooks/<concern>/`, not
  the feature folder) keyed off the global `QueryKey` enum
  (`src/constants/queryKeys.ts`), URL-addressable search/page/modal state
  (`src/lib/url-state/` — see `docs/adr/url-page-state.md`), full accessibility, and its
  `*.workflow.test.tsx`. Copy this shape for any new **list/browse/search** feature.
- **`components/auth/` + `pages/auth/`** — a full multi-page form flow (login → OTP → reset,
  etc.). Wired to React Hook Form + Zod (`auth.schema.ts`), mutations with the
  invalidate-on-success pattern, and `SignupForm.workflow.test.tsx`. Copy this shape for any
  new **multi-step form flow**.

Both are intentionally domain-agnostic (per `AGENTS.md`'s zero-lock-in rule) — they demonstrate
every architectural pattern (Query, Zustand, RHF+Zod, i18n, a11y, workflow test) without
inventing a fake business domain. New features should look structurally identical to one of
these two, with the business logic swapped out.

### How the routing system fits together

Five files in `src/routes/`, each with one job:

1. **`roles.ts`** — the `Role` registry. Ships two example roles: `MEMBER` (lifted from the
   real backend contract's own example payload) and `ADMIN`. Adding a role starts here.
2. **`ProtectedRoutes.tsx`** — the single registry of every protected page: for each route,
   which roles may reach it (`roles: readonly Role[] | 'all'`) and, optionally, its sidebar nav
   entry (`nav: { labelKey, end? }`). Also exports `COMMON_PROTECTED_ROUTES` (routes every role
   can reach — `roles: 'all'`, e.g. the shipped Settings/Profile/Notifications pages) and a
   `ROLE_LAYOUT` map (which shell variant each role gets, plus `getNavItemsForRole` /
   `getHomeRouteForRole` / `getRoleLayout` helpers `RoleLayout.tsx` reads from). Every page here
   is `lazy()`-imported — see § Performance Budget in `AGENTS.md`.
3. **`PublicRoutes.tsx`** — the guest-only auth screens (`PUBLIC_ROUTES`): login, signup,
   forgot-password, both OTP-verify steps, reset-password. Also all `lazy()`-imported.
4. **`RoleGuards.tsx`** — the per-route gate. Wraps a route's element, reading that route's own
   `roles` from the registry. Not authenticated → redirect to `/login` (preserving
   `state.from`); authenticated but wrong role → redirect to `/403`; otherwise renders the
   route. Waits for Zustand `persist`'s async rehydration (`hasHydrated`) first, so a hard
   refresh never briefly bounces a logged-in user to `/login`.
5. **`AppRouters.tsx`** — the actual `createBrowserRouter` call. Generates every `<Route>` by
   mapping over `PUBLIC_ROUTES` and `PROTECTED_ROUTES`, wrapping protected ones in
   `RoleGuards` and the whole protected group in `AuthenticatedRoute` (so an unauthenticated
   deep-link never flashes the `RoleLayout` chrome before redirecting) and every lazy page in
   `<Suspense>`. It also hardcodes its own "public shell" `<Route>`s — see the third routing
   category below — for pages that need no auth guard at all and so have no registry entry in
   either `.tsx` file above.

`AuthRedirectRoute.tsx` is the mirror-image guard for the public group — it bounces an
_already-authenticated_ user off the guest-only auth screens to their own role's home route.
`Can.tsx` (`src/components/common/Can.tsx`) is a separate, smaller-grained gate: it hides/shows
a _fragment_ of an already-rendered page based on role, not a whole route.

**A third routing category: pages reachable whether signed in or not.** `ProtectedRoutes.tsx`
(role-gated) and `PublicRoutes.tsx` (guest-only auth screens) aren't the only two ways a page
gets wired up. `AppRouters.tsx` also hardcodes its own "public shell" block — `<Route path="/"
element={<AppLayout />}>` — for pages that need no auth guard at all: the shipped
`ForbiddenPage`, `ExamplePage`, and the catch-all 404 route all live here as their own
`<Route>` entries, not as registry entries in either `.tsx` file above. This is deliberate,
not an oversight: these pages have nothing to gate — every role, and no role, can reach them.
`ExamplePage` — the reference feature § 3 below tells you to copy — is wired exactly this way.
The index route (`"/"` itself) lives in this same block but isn't an instance of this
category — `HomeRedirectRoute.tsx` is never real content; it's an auth-aware redirect
(signed in → the role's home route, or a dev-facing message if that role has none configured
yet; signed out → `/login`) that replaced a static `HomePage` so a successful signup/login
never bounces back to `/login` for lack of a configured dashboard.
Adding a new page to this category is a new `<Route path="..." element={withSuspense(<YourPage
/>)} />` inside that same block in `AppRouters.tsx`, `lazy()`-imported next to it (same

> 50 KB rule as every other route) — not a `ProtectedRoutes.tsx`/`PublicRoutes.tsx` entry.

**Adding a new role or a new role-gated route never touches the router, guard, or layout
code** — see `AGENTS.md`'s "Where things go" section for the exact 3-step checklist
(`roles.ts` → `ProtectedRoutes.tsx` → `pages/<role>/`).

---

## 3. Building a new feature — full step-by-step

1. **Pick the closer reference shape.** A searchable/paginated list → copy
   `src/components/example/`. A multi-step form flow → copy `src/components/auth/`. Rename
   the folder/files, gut the business logic, keep the structure.
2. **Decide where the component folder goes.**
   - Not role-specific → `src/components/<concern>/` (sibling of `common/`).
   - Role-specific → `src/components/<role>/`, mirrored by a page in `src/pages/<role>/`.
   - A reusable primitive (button/input/modal-shaped) → `src/components/common/`, built on
     Radix + CVA — reach for Radix only when the component has real interaction behavior
     (focus trapping, portals, roving tabindex).
3. **Wire it into routing** (if it's a new page) — see § 2's routing walkthrough; a role-gated
   page goes through `ProtectedRoutes.tsx`, a guest-only auth screen through `PublicRoutes.tsx`,
   and a page reachable whether signed in or not (like `ExamplePage` — this walkthrough's own
   reference feature) is its own hardcoded `<Route>` in `AppRouters.tsx`'s public shell block
   instead — see § 2's "third routing category" for exactly how. Every page > 50 KB gets
   `lazy()`-imported next to its own route entry.
4. **Data fetching** — a TanStack Query hook, never a raw `useEffect` fetch, placed under
   `src/hooks/<concern>/<hookName>.ts` — `common/` unless the hook only ever makes sense
   inside one role's own pages, never co-located inside the feature's own component folder
   (company-wide convention; `src/hooks/common/useExampleItems.ts` is the reference shape).
   Add the query's key to the global registry, `src/constants/queryKeys.ts`'s `QueryKey`
   enum, then reference it directly in the hook — never a per-feature key factory, never an
   inline string literal (see
   `AGENTS.md`'s § Constant Registries for why this — and every other closed set of named
   string values in this repo — is a real `enum`, not an `as const` object):
   ```ts
   export enum QueryKey {
     EXAMPLE_LIST = 'example-list',
   }
   ```
   ```ts
   queryKey: [QueryKey.EXAMPLE_LIST, params],
   ```
   Every variable read inside `queryFn` must also be in `queryKey`. Use `placeholderData:
keepPreviousData` for paginated/filtered queries. Errors toast automatically via
   `queryClient.ts`'s `onError` — opt out per-call with `meta: { skipErrorToast: true }` only
   when the call renders its own inline error.
5. **Mutations** — if a mutation should invalidate a cached list on screen, `toast.success(...)`
   then `return queryClient.invalidateQueries(...)` from `useMutation({ onSuccess })` so the
   mutation stays pending until the refetch lands (`react-doctor`'s
   `query-mutation-missing-invalidation` rule catches a missed one). Prefer `mutate` over
   `mutateAsync`. Put `navigate`/`form.reset()` in the call site's own `mutate()` `onSuccess`,
   never after an awaited `mutateAsync`.
6. **Forms** — React Hook Form + `zodResolver`; add the schema to `src/schemas/` (reuse
   `common.schema.ts` primitives for email/password/phone/url instead of redefining). Zod v4
   syntax: `z.email()`/`z.url()`/`z.uuid()`, not the deprecated `z.string().email()`.
7. **UI-only state** — a Zustand store, feature-scoped (`src/components/<feature>/
<feature>Store.ts`), not global unless it's genuinely app-wide (theme, auth).
8. **i18n** — every user-facing string is a key in `src/i18n/locales/en/common.json`, read via
   `useTranslation()`'s `t('KEY')` inside a component, or `import i18n from 'src/i18n'; i18n.t
('KEY')` outside one (a Zod schema, a non-render callback). No hardcoded strings in JSX.
9. **Write the matching test** (see § Testing philosophy below for the full rules):
   - A new feature → `<FeatureName>.workflow.test.tsx` co-located in the feature folder,
     copying `ExampleWidget.workflow.test.tsx`'s shape: load → primary interaction →
     success/empty/error/cancel, via `getByRole`/`getByLabelText` + real
     `@testing-library/user-event`, through the real MSW-backed network layer
     (`src/mocks/handlers.ts`/`server.use(...)` for one-off overrides), rendered with
     `src/test/renderWithProviders.tsx`.
   - A new `src/services/` or `src/hooks/` file (reusable logic) → a standalone `*.test.ts`
     next to it. Services still go through real MSW handlers, never a mocked `apiClient`. A
     hook with a timer uses `vi.useFakeTimers()`, never a real `setTimeout` wait.
   - **Do not** write a standalone test for a `src/components/common/` primitive — it gets its
     coverage transitively through every workflow that uses it.
10. **A Playwright spec is warranted almost never.** `e2e/smoke.spec.ts` is the one,
    centralized browser smoke-gate — it proves the app boots, a real MSW browser-worker
    network call works, and one representative interaction works, in a real Chromium instance.
    New features do **not** get their own `e2e/*.spec.ts` file. Only touch `e2e/` if the
    smoke-gate itself needs a new reference route to prove the app boots through (rare) —
    component/state behavior belongs in the Vitest/RTL workflow test, not Playwright.
11. **Verify manually** — `pnpm dev`, actually click through the feature (golden path + the
    edge cases your test covers). Automated checks prove code correctness, not feature
    correctness.
12. **Run the gate** — targeted `check:*` while iterating, then a full `pnpm verify` before
    calling it done (see § 4).

---

## 4. The complete quality-gate trace

This is the single most important section. Two enforcement points exist — **pre-commit**
(fast, staged-files-scoped) and **`pnpm verify`** (exhaustive, full-repo, what CI runs) — and
they are deliberately _the same rule set_, not two different ones.

### 4a. `git add` → `git commit` (what actually runs, in order)

`git commit` triggers Husky's `.husky/pre-commit` hook → `node scripts/hooks/pre-commit.mjs`.

**Step 0 — Auto-fix (`lint-staged`), before any gate stage runs at all.** This is the one
deliberate mutation in the whole pipeline: `lint-staged` (config in `package.json`) runs on
just the staged files —

- `src/**/*.{ts,tsx}` → `eslint --fix --max-warnings=0 --no-warn-ignored`, then `prettier
--write`.
- `src/**/*.{js,jsx}` → `eslint --fix --no-warn-ignored`, then `prettier --write`.
- `*.{json,md,yml,yaml,css}` → `prettier --write`.

Anything it changes gets re-staged automatically. This is intended, scoped only to files
you're already about to commit.

**Then six blocking stages, every one of which fails the commit on the first failure:**

| Stage                 | What it runs                                                                                                                                               | Scope                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Guard Rails        | `guardRails()` from `scripts/checks/guard-rails.mjs` — merge-conflict markers, `eslint-disable` comments, possible hardcoded secrets, files over 500 lines | Staged production `src/**/*.{ts,tsx}` (excludes `*.stories.tsx` and `src/mocks/`) |
| 2. Type Safety        | `pnpm check:types` (`tsc -b --noEmit`) + `pnpm static-analysis:contract`                                                                                   | Whole repo (type-checking is inherently non-file-scoped)                          |
| 3. Lint & Conventions | `eslint <staged files> --max-warnings=0 --no-warn-ignored`                                                                                                 | Staged `src/**/*.{ts,tsx}` only; skipped entirely if none staged                  |
| 4. Accessibility      | `eslint --config eslint.a11y.config.js <staged files> --max-warnings=0`                                                                                    | Staged `src/**/*.tsx` only; skipped if none staged                                |
| 5. Style Consistency  | `impeccable detect <staged files> < /dev/null`                                                                                                             | Staged `src/**/*.{tsx,jsx,css}`; skipped if none staged                           |
| 6. React Diagnostics  | `react-doctor --staged --no-supply-chain --yes`                                                                                                            | Staged `src/**/*.{ts,tsx}`; skipped if none staged                                |

If any stage fails, the hook writes `.git/quality-gate/last-failure.json` (consumed by the
`/fix-commit` command / `fe-fix-commit` skill) and exits non-zero — the commit does not happen.
`git commit --no-verify` skips all of this, but **it still fails CI** — it is an emergency
hatch, not a real bypass.

**What pre-commit deliberately does _not_ run**, and why: `check:test` (Vitest), `check:build`,
`check:build-budget`, `check:e2e` (Playwright), `ai:check`, and `check:lint-contract` are all
whole-repo concerns — a build, a full test suite, a real browser boot, or a config-drift check
can't be meaningfully scoped to "just the staged files," and running them on every commit would
make committing slow. They still block `pnpm verify` and CI — just not every individual commit.

Then `.husky/commit-msg` runs `commitlint --edit "$1"` against `commitlint.config.*`
(`@commitlint/config-conventional` + this repo's own rules: `type-enum` restricted to `feat
fix refactor perf test docs style build ci chore`, subject can't be empty/start-case/
end-with-a-period, ≤72 chars).

### 4b. `pnpm verify` — the canonical, exhaustive gate (16 checks, always full-repo)

This is **the** definition of "ready to merge" — the same command a human runs locally, CI
runs in the `Verify` step, and what a passing pre-commit is a _subset_ of. Runs in this exact
order (chained with `&&`, so it stops at the first failure):

| #   | Script                     | What it checks                                                                                                                                                                                                                                                                      | Blocking?             |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | `check:guardrails`         | Guard Rails, full-repo (`scripts/checks/guard-rails.mjs`)                                                                                                                                                                                                                           | Yes                   |
| 2   | `static-analysis:contract` | Required ESLint rules / TS compiler options haven't silently regressed (`scripts/check-static-analysis.mjs`)                                                                                                                                                                        | Yes                   |
| 3   | `ai:check`                 | `.cursor/commands/` matches what `pnpm ai:sync` would generate from `.claude/commands/`, non-mutating (`scripts/checks/ai-config-contract.mjs`)                                                                                                                                     | Yes                   |
| 4   | `check:lint-contract`      | Specific ESLint rule severities + `tsconfig.*.json` compiler options haven't silently regressed (`scripts/checks/lint-config-contract.mjs`)                                                                                                                                         | Yes                   |
| 5   | `check:hardening`          | Config/doc details behind the Playwright gate, Agent Execution Safety, and pnpm supply-chain hardening haven't drifted (`scripts/checks/hardening-contract.mjs`)                                                                                                                    | Yes                   |
| 6   | `check:i18n`               | Orphaned-key + cross-locale-key-parity check over every `src/i18n/locales/<lng>/common.json` that exists (`scripts/checks/i18n-key-contract.mjs`)                                                                                                                                   | Yes                   |
| 7   | `check:types`              | `tsc -b --noEmit`, strict (`exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, full strict family, on both `tsconfig.app.json` and `tsconfig.node.json`)                                                                                                            | Yes                   |
| 8   | `check:test`               | `vitest run` — placed right after types, before lint/format/style, so a broken component fails fast before the expensive build stage                                                                                                                                                | Yes                   |
| 9   | `check:lint`               | `eslint . --max-warnings=0` (`tseslint.configs.strictTypeChecked`, hooks, hardcoded-text, token rules)                                                                                                                                                                              | Yes                   |
| 10  | `check:a11y`               | Strict `jsx-a11y` pass (`eslint.a11y.config.js`)                                                                                                                                                                                                                                    | Yes                   |
| 11  | `check:format`             | `prettier --check`                                                                                                                                                                                                                                                                  | Yes                   |
| 12  | `check:style`              | `impeccable detect src/ < /dev/null`                                                                                                                                                                                                                                                | Yes                   |
| 13  | `check:doctor`             | `react-doctor src/ --no-supply-chain --yes < /dev/null` — **only `error`-severity findings fail this**; `warning`-severity findings (e.g. the documented `query-mutation-missing-invalidation` exceptions on `signup`/`forgotPassword`) show up in output but do not fail the check | Only `error` severity |
| 14  | `check:build`              | `pnpm build` (`tsc -b && vite build`, production mode)                                                                                                                                                                                                                              | Yes                   |
| 15  | `check:build-budget`       | `size-limit` against the real `dist/assets/` output from step 14 — entry bundle ≤ 195 kB gzip, total JS ≤ 268 kB gzip (`.size-limit.js`)                                                                                                                                            | Yes                   |
| 16  | `check:e2e`                | `playwright test` against a fresh `pnpm build:e2e` + `vite preview` — deliberately last, since it needs a real build and is the single most expensive check                                                                                                                         | Yes                   |

Every one of these is **non-mutating** — `pnpm verify` only reports, never writes to disk (see
§ 6).

### 4c. Push → PR → merge — what GitHub Actions runs

Two workflows, both triggered on `pull_request` and `push` to `main`:

**`.github/workflows/quality-gate.yml` ("Quality Gate" / job name `Verify`)**

1. Checkout, pnpm setup (version read from `package.json`'s `packageManager` field — not
   re-pinned in the workflow), Node 22 setup with pnpm cache.
2. `pnpm install --frozen-lockfile`.
3. `pnpm exec playwright install chromium --with-deps` (Chromium only — this is a single-
   browser smoke-gate, not a cross-browser matrix).
4. A handful of the cheaper checks run as their **own named steps** first — purely for a
   readable CI status line, not to avoid duplication: Static-analysis contract, Type check,
   Lint, Accessibility lint, Format check, Style check.
5. **`pnpm verify`** — the full 15-check chain from § 4b (re-runs everything, including the
   steps just named above — the canonical rule set lives once in `verify`'s own script list,
   not hand-duplicated into the workflow).
6. On failure, uploads `playwright-report/`/`test-results/` as a build artifact
   (`if-no-files-found: ignore` — a no-op if `verify` failed before `check:e2e` ever ran) so a
   human or agent can open the trace/screenshots without reproducing locally.

**`.github/workflows/react-doctor.yml` ("React Doctor")** — a second, independent job (via the
`millionco/react-doctor` GitHub Action, `blocking: error`), triggered on PR open/sync/reopen/
ready-for-review and push to `main`. Uses `fetch-depth: 0` so it has full git history to find
the merge base and report only issues the PR actually introduces (not pre-existing ones in
touched files). This runs the **same** `doctor.config.ts` rule set as `check:doctor` inside
`verify`, as a separate PR-annotation-capable check (it can comment inline on the diff, via its
`pull-requests: write`/`issues: write` permissions) rather than only a pass/fail log line.

Both workflows use SHA-pinned actions (not tag-pinned) — see `AGENTS.md` § Package Manager &
Supply Chain for why.

**Branch protection / required status checks:** this repo's actual GitHub branch-protection
rules for `main` are configured in the repository's Settings → Branches (not visible via a
public API call from this environment at the time this doc was written) — check there, or ask
a repo admin, for the exact list of required status checks and merge requirements currently
enforced. In practice, the `Verify` job (quality-gate.yml) and the `react-doctor` job are the
two checks a PR needs green before it's mergeable; treat both as required unless you've
confirmed otherwise in repo settings.

### 4d. The upshot

A green `pnpm verify` **is** the same contract pre-commit and CI both enforce — pre-commit is a
staged-scoped, fast subset of it; CI runs the full thing. There is no way for `pnpm verify` to
pass locally while CI fails, short of something environment-specific (a stale local `dist/`,
uncommitted staged files CI doesn't see, etc.).

---

## 5. Every manual command — reference table

| Command                                 | What it does                                                                                                                                                                                    | Mutates files?                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `pnpm dev`                              | Start the Vite dev server (`localhost:5173`, MSW browser worker)                                                                                                                                | No                                           |
| `pnpm build`                            | Production build (`tsc -b && vite build`)                                                                                                                                                       | Writes `dist/` (build output, not source)    |
| `pnpm preview`                          | Serve the last `pnpm build` output locally                                                                                                                                                      | No                                           |
| `pnpm verify`                           | **The** canonical 15-check gate, full-repo (§ 4b)                                                                                                                                               | No                                           |
| `pnpm gate`                             | `node scripts/hooks/pre-commit.mjs` directly — same 6 staged-scoped stages `git commit` runs, without actually committing                                                                       | Runs `lint-staged` on staged files (mutates) |
| `pnpm test`                             | Vitest, watch mode                                                                                                                                                                              | No                                           |
| `pnpm test:run`                         | Vitest, single run (CI-safe, what `check:test` runs)                                                                                                                                            | No                                           |
| `pnpm check:test`                       | Alias for `pnpm test:run`                                                                                                                                                                       | No                                           |
| `pnpm lint` / `pnpm check:lint`         | `eslint . --max-warnings=0`                                                                                                                                                                     | No                                           |
| `pnpm lint:fix`                         | `eslint . --fix`                                                                                                                                                                                | **Yes**                                      |
| `pnpm format` / `pnpm check:format`     | `prettier --check`                                                                                                                                                                              | No                                           |
| `pnpm format:fix`                       | `prettier --write "src/**/*.{ts,tsx,json,md,css}"`                                                                                                                                              | **Yes**                                      |
| `pnpm check:a11y`                       | Strict `jsx-a11y` pass                                                                                                                                                                          | No                                           |
| `pnpm check:style` / `pnpm style:check` | `impeccable detect src/`                                                                                                                                                                        | No (no CLI auto-fix exists)                  |
| `pnpm doctor`                           | `react-doctor src/` — **full** scan including the Socket.dev supply-chain check                                                                                                                 | No                                           |
| `pnpm check:doctor`                     | Same, but `--no-supply-chain --yes` (faster, what `verify` runs)                                                                                                                                | No                                           |
| `pnpm check:types` / `pnpm typecheck`   | `tsc -b --noEmit`                                                                                                                                                                               | No                                           |
| `pnpm check:guardrails`                 | Guard Rails scan, full-repo                                                                                                                                                                     | No                                           |
| `pnpm check:lint-contract`              | ESLint/tsconfig regression contract                                                                                                                                                             | No                                           |
| `pnpm check:hardening`                  | Playwright/Agent-Safety/supply-chain doc-contract check                                                                                                                                         | No                                           |
| `pnpm static-analysis:contract`         | Required-rule presence contract                                                                                                                                                                 | No                                           |
| `pnpm check:build`                      | Alias for `pnpm build`, as a gate step                                                                                                                                                          | Writes `dist/`                               |
| `pnpm check:build-budget`               | `size-limit` against `dist/assets/` (run `pnpm build` first)                                                                                                                                    | No                                           |
| `pnpm build:e2e`                        | `vite build --mode e2e --outDir dist-e2e`                                                                                                                                                       | Writes `dist-e2e/`                           |
| `pnpm test:e2e` / `pnpm check:e2e`      | `playwright test` (builds via `build:e2e` + `vite preview` automatically, per `playwright.config.ts`'s `webServer`)                                                                             | No                                           |
| `pnpm test:e2e:headed`                  | Same, visible browser — the default for local Playwright debugging                                                                                                                              | No                                           |
| `pnpm test:e2e:changed`                 | `playwright test --only-changed --headed` — advanced/local only; dependency graph only follows `e2e/*.ts` imports, **not** app source, so editing a component shows `0 tests`, not a false pass | No                                           |
| `pnpm ai:sync`                          | Regenerates `.cursor/commands/` from `.claude/commands/`                                                                                                                                        | **Yes**                                      |
| `pnpm ai:check`                         | Verifies `.cursor/commands/` isn't stale relative to `.claude/commands/`                                                                                                                        | No                                           |

**Rule of thumb** (from `AGENTS.md` § Package Manager & Supply Chain): if a command's name
doesn't end in `:fix` and isn't `ai:sync`, it's safe to run blind, without checking `git diff`
first — it only reports.

---

## 6. Key operating principles for an agent

- **Non-mutating by default.** Every bare investigative command (`pnpm lint`, `pnpm format`,
  `pnpm verify`, any `pnpm check:*`, `pnpm ai:check`) only reports. Mutation is always a
  separate, explicitly named command (`:fix` suffix, or `ai:sync`). `pnpm install` never
  rewrites tracked files either — `prepare` only runs Husky setup. The one deliberate exception
  is `lint-staged` inside the pre-commit hook, auto-fixing staged files on commit.
- **`AGENTS.md` is the single canonical rulebook.** `CLAUDE.md` imports it verbatim (never
  duplicates it); `docs/GUIDE.md` explains the same rules at greater length; this document is
  the operational companion. If you're unsure whether something is a rule, check `AGENTS.md`
  first — never infer a rule from this doc alone.
- **Workflow-over-unit-testing philosophy.** This repo does not unit-test individual
  primitives (`Button`, `Input`, `Dialog`). Every test exercises a real user-facing flow
  through the components that flow actually uses — a primitive gets coverage transitively. See
  § 3, step 9 above, and `AGENTS.md` § Testing for the full reasoning and the two test-file
  naming/location conventions (`*.workflow.test.tsx` vs. `*.test.ts`).
- **Agent Execution Safety** (binds every autonomous agent in this repo, verbatim from
  `AGENTS.md`):
  - Inspect before edit — read current file content and related repo state before changing
    anything.
  - Preserve unrelated uncommitted changes; touch only files inside the task's scope; flag
    unrelated findings as follow-ups instead of folding them in.
  - Smallest-change preference — ship the smallest diff that satisfies the task; "while I'm
    here" is not a reason for a broader refactor.
  - **Never**, without an explicit human instruction for that specific action: `git reset`,
    `git push --force`/`--force-with-lease`, `git commit --amend`, `git rebase`, deleting a
    branch, or `git checkout --`/`git restore` (discarding changes).
  - **Never** auto-commit or auto-push on your own initiative — finishing a task is not
    authorization.
  - Bounded retry — stop after 3 materially-equivalent failed attempts at the same operation
    and report the blocker, don't try a 4th time.
  - Verify before completion — run the relevant targeted `check:*` while working, then the
    full `pnpm verify` before claiming done.
  - Final diff inspection — review `git status`/`git diff` before reporting completion; confirm
    only intended files changed.
  - **Escalate, don't weaken.** If a task conflicts with an enforced constraint (a test, a lint
    rule, type safety, a security control), stop and ask — never disable or bypass the
    constraint to make the conflict go away.
- **Where to look when unsure:**
  - "What's the rule?" → `AGENTS.md` (and its longer explanation in `docs/GUIDE.md`).
  - "How do I actually do X?" → this document.
  - "Why does this specific check exist / what's it protecting against?" → the check's own
    script comment (`scripts/checks/*.mjs` are all heavily commented with their own
    reasoning) and § 7 below.
  - "What did a failed commit actually flag?" → `.git/quality-gate/last-failure.json`
    (written by `scripts/hooks/pre-commit.mjs` on failure), or run `/fix-commit`.

---

## 7. Troubleshooting — common failure points

| Symptom                                                               | What it means                                                                                                                                                                                                                                                      | How to diagnose / fix                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit blocked, "Guard Rails" stage                                   | A staged file has a merge-conflict marker, an `eslint-disable` comment, a possible hardcoded secret pattern, or exceeds 500 lines                                                                                                                                  | Read the printed violation (file:line + rule). `eslint-disable` and secrets are never suppressed — fix the code. An oversized file needs to be split, not exempted.                                                                                                                                                                                                                                                                            |
| Commit blocked, "Type Safety" stage                                   | `tsc -b --noEmit` failed, or `static-analysis:contract` detected a regressed compiler option/required rule                                                                                                                                                         | Run `pnpm check:types` locally to see the actual TS error. If `static-analysis:contract` failed instead, something in `tsconfig.*.json` or `eslint.config.js` was weakened — restore it, don't lower the bar.                                                                                                                                                                                                                                  |
| Commit blocked, "Lint & Conventions"                                  | ESLint failed on staged files — commonly a hook-deps violation, a floating/misused promise, hardcoded JSX text, or an arbitrary Tailwind value                                                                                                                     | Run `pnpm exec eslint <file> --max-warnings=0` on the specific file for the exact rule + line. Arbitrary Tailwind values (`w-[127px]`) need a real `@theme` token instead.                                                                                                                                                                                                                                                                     |
| Commit blocked, "Accessibility"                                       | Strict `jsx-a11y` failed on a staged `.tsx` — missing `alt`, unlabeled input, wrong ARIA usage, etc.                                                                                                                                                               | Run `pnpm check:a11y` for the full list; see `AGENTS.md` § Accessibility for the checklist this enforces.                                                                                                                                                                                                                                                                                                                                      |
| Commit blocked, "Style Consistency"                                   | `impeccable detect` found a UI anti-pattern (inconsistent class ordering, an AI-generated-UI "tell", a design-quality issue) on a staged file                                                                                                                      | There is no CLI auto-fix — reach for the `/fix-commit` command or manually align with the surrounding code's pattern.                                                                                                                                                                                                                                                                                                                          |
| Commit blocked, "React Diagnostics"                                   | `react-doctor --staged` found an `error`-severity finding: a state/effects bug, a performance issue, a security issue, or one of the promoted-to-error accessibility rules in `doctor.config.ts`                                                                   | Run `pnpm exec react-doctor --staged --no-supply-chain --yes` for the full report; a `warning`-level finding does **not** block the commit — only `error` does.                                                                                                                                                                                                                                                                                |
| `check:build-budget` fails in `verify`/CI                             | The gzipped output of `dist/assets/index-*.js` exceeds 195 kB, or all of `dist/assets/*.js` exceeds 268 kB                                                                                                                                                         | Run `pnpm build` fresh, then `pnpm check:build-budget` (or `pnpm exec size-limit`) to reproduce. Compare against the `vite build` chunk listing to see which chunk grew — the usual cause is a new/changed import that isn't `lazy()`-loaded (check `PublicRoutes.tsx`/`ProtectedRoutes.tsx`). If the growth is real and justified, raise the limit in `.size-limit.js` with a comment explaining the new baseline — don't raise it silently.  |
| `check:e2e` fails locally but passes in CI (or vice versa)            | Usually a stale `dist-e2e/` build, or a port conflict on `4173`                                                                                                                                                                                                    | `playwright.config.ts`'s `webServer` always does a fresh `build:e2e` + `vite preview` — `reuseExistingServer: false` even locally, specifically so this can't happen from a stale server. If it still reproduces, run `pnpm test:e2e:headed` to watch it live; check for a `console.error`/`pageerror` in the browser (the shared fixture fails any test that logs one, with a narrow documented allowlist for unavoidable third-party noise). |
| `ai:check` fails in `verify`/CI                                       | `.cursor/commands/` is stale relative to `.claude/commands/` — someone edited a command file without re-syncing                                                                                                                                                    | Run `pnpm ai:sync`, review the diff, commit it alongside the command change.                                                                                                                                                                                                                                                                                                                                                                   |
| `check:hardening` fails                                               | A config/doc detail that a previously-shipped hardening feature (Playwright gate, Agent Execution Safety, pnpm supply-chain) depends on has drifted                                                                                                                | Read `scripts/checks/hardening-contract.mjs`'s own failure message — it names the exact expectation that broke; restore the underlying config/doc rather than adjusting the contract.                                                                                                                                                                                                                                                          |
| `check:doctor`/`pnpm doctor` shows warnings but `verify` still passes | Expected — only `error`-severity `react-doctor` findings are blocking (`doctor.config.ts`'s `blocking: 'error'`). Warnings (e.g. the documented `query-mutation-missing-invalidation` exceptions on one-off mutations like `signup`/`forgotPassword`) are advisory | Run `pnpm exec react-doctor --blocking warning` to audit warnings as if they were blocking, if you want to see the full picture — this is not what CI enforces though.                                                                                                                                                                                                                                                                         |
| Hard refresh briefly redirects a logged-in user to `/login`           | `RoleGuards`/`AuthenticatedRoute` render `null` until Zustand `persist`'s async rehydration finishes (`hasHydrated`) — if you see a flash-to-login instead of a blank moment, something is reading `user` before hydration completes                               | Check that the component in question isn't reading `useAuthStore` state directly instead of going through the route guards; see `src/routes/RoleGuards.tsx`'s own comment for the exact mechanism.                                                                                                                                                                                                                                             |
| A 401 doesn't retry / logs the user out unexpectedly                  | `api-client.ts`'s single-flight refresh-and-retry only applies to non-auth-flow routes; a failed refresh or a second 401 after retry clears the auth store by design                                                                                               | See `docs/auth-token-refresh.md` for the full documented pattern before assuming it's a bug.                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm test:e2e:changed` shows `0 tests` after editing a component     | Its dependency graph only follows what `e2e/*.ts` files import (i.e. `e2e/fixtures.ts`), not app source under `src/`                                                                                                                                               | This is expected, not a false pass — `pnpm verify`/CI always run the full `e2e/` suite regardless; use `pnpm test:e2e:headed` for a real local run instead.                                                                                                                                                                                                                                                                                    |
