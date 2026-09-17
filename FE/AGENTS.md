# AGENTS.md — Geeks FE Boilerplate

**This file is the single, canonical, tool-agnostic rulebook for this repository.**
Cursor reads it natively; `CLAUDE.md` imports it; `.cursor/rules/*.mdc` narrowly scope it.
Never copy these rules into tool-specific files — point at this file instead.
`docs/GUIDE.md` is the same rules as a friendlier, longer walkthrough. Two more standalone
references live in `docs/`: `repo-overview-and-architecture-guide.md` (a scannable one-page
tour of the stack, folder structure, and quality gate — for a first-time reader who wants the
shape of the repo before diving into this file) and `new-project-quickstart-guide.md` (the
practical, action-ordered checklist for starting a brand-new project on this boilerplate).
Neither redefines a rule — both point back here for the authoritative detail.

This is a **domain-agnostic boilerplate**, the starting point for every Geeks project.
Two rules override everything else:

1. **Zero business-domain lock-in.** Never invent products, orders, bookings, etc. The only
   non-common concern folders are `src/components/example` + `src/pages/common/ExamplePage.tsx`
   (a generic paginated/searchable list), `src/components/auth` + `src/pages/auth` (login/
   signup/forgot-password/verify/reset — the "day one" auth flow every real project needs),
   and the two example roles in the role system (`src/routes/roles.ts`) — `MEMBER` (lifted
   from the real backend contract's own example payload) and `ADMIN` — each with exactly one
   placeholder page (`src/pages/member`, `src/pages/admin`), not a real feature — all
   domain-agnostic on purpose.
2. **Maximum guardrails on _how_ code is written** — enforced by tooling, not discipline.

---

## Tech Stack

- **Build:** Vite (SPA, not SSR) · **Language:** TypeScript (strict)
- **UI:** React 18+ function components + hooks only (no class components)
- **UI primitives:** Radix UI + `class-variance-authority` (CVA), the shadcn/ui pattern —
  the base layer for **all** common components, not just complex ones. Add more via
  `pnpm dlx shadcn add <component>` (see `components.json`), then re-point its classes at our
  own `@theme` tokens — never adopt shadcn's default `--primary`/`--secondary` CSS variables.
  `src/lib/utils.ts` exports the `cn()` class-merge helper every common component uses.
- **Routing:** React Router v7 data router (`createBrowserRouter`)
- **URL page state:** `nuqs` (`src/lib/url-state/`) — filters, search text, page number, the
  selected tab, and small-dialog context live in the URL, not `useState`/Zustand. See
  § Data & State's own bullet and `docs/adr/url-page-state.md` for the full decision.
- **Styling:** Tailwind CSS v4 (CSS-first `@theme` tokens in `src/index.css`)
- **Client state:** Zustand (feature-scoped stores, for state that genuinely shouldn't be
  shareable/bookmarkable — see § Data & State) · **Server state:** TanStack Query v5
- **Forms:** React Hook Form + Zod (`src/schemas/`; shared primitives in `common.schema.ts`)
- **HTTP:** Axios typed client with interceptors (`src/services/api-client.ts`)
- **Env validation:** Zod-validated `import.meta.env` (`src/constants/env.ts`) — fails loudly
  at startup on a missing/malformed env var instead of shipping a silent misconfiguration.
- **Testing:** Vitest + React Testing Library, jsdom environment (`vite.config.ts`'s `test`
  block), plus Playwright (Chromium-only smoke-gate, `e2e/`) — see § Testing below. No
  coverage thresholds, no Storybook.
- **API mocking:** MSW — `msw/browser` in dev (fake API responses for the app to hit),
  `msw/node` in tests (`src/mocks/server.ts`), both built from the same `src/mocks/handlers.ts`
- **Lint/format:** ESLint (flat config) + Prettier · **Hooks:** Husky + lint-staged + commitlint
- **Package manager:** pnpm only — `pnpm-lock.yaml` is canonical, `packageManager` in
  `package.json` pins the version. See § Package Manager & Supply Chain for the install-time
  hardening this implies.
- **Charting/data-visualization:** recharts. Every color a chart uses is a `@theme` CSS custom
  property, passed directly as the string value of the relevant SVG prop —
  `fill="var(--color-brand-500)"`, `stroke="var(--color-border)"` — never a hardcoded hex/JS
  color, same rule as every other visual value in this repo. Verified directly (not assumed):
  a real chart rendered through the actual `vite build`/`vite preview` pipeline resolves these
  correctly in both light and dark mode. Two things worth knowing: recharts doesn't forward
  arbitrary props (e.g. `data-testid`) down to the SVG elements it draws — target its own
  emitted classes (e.g. `.recharts-bar-rectangle`) instead, in anything that needs to select a
  chart element; and reading a chart element's exact `getComputedStyle(...).fill` immediately
  after page load is measurably flaky in headless Chromium (confirmed: intermittent
  empty-string reads across repeated runs) — a testing-instrumentation timing gap, not a
  rendering bug (the CSS custom property itself always resolved correctly, and the actual
  paint output is correct — confirmed by direct screenshot comparison), so don't write an
  automated test asserting on a chart's exact computed color; assert on structure/content
  instead. See `.claude/skills/fe-page-scaffold/SKILL.md` for the full guidance this feeds.

Do not substitute a stack choice without flagging it first.

---

## Directory Map

```
src/
  components/common/     Reusable, domain-agnostic UI: Button, Input, PasswordInput, Dialog,
                          ConfirmDialog, DropdownMenu, Toaster, ThemeToggle, LoadingState,
                          ErrorState, EmptyState, FormField, SearchInput, Pagination,
                          DataTable, Seo, Can (inline role gate)
  components/auth/       Auth forms only: LoginForm, SignupForm, OtpForm, ForgotPasswordForm,
                          ResetPasswordForm — pages that route to them live in src/pages/auth/
  components/example/    ExampleWidget (the one example feature: generic paginated list) —
                          its data-fetching/mutation hooks live in hooks/common/, and
                          their actual HTTP calls in services/common/exampleService.ts,
                          not here
  components/<role>/     Components scoped to one role's own pages (see
                          routes/ProtectedRoutes.tsx) — none ship by default (both example
                          roles are placeholder pages with no role-specific components
                          yet); add at this level, mirrored by src/pages/<role>/. Lint-
                          enforced: `roleBoundaries/no-cross-role-component-import`
                          (eslint.config.js) blocks any import of a role's folder from
                          outside that same role's own components/pages — no new role
                          to list there when a role is added, it derives "which folders
                          are roles" from AGENTS.md rule #1's own concern-folder
                          exception list (common/auth/example/layouts), not a hardcoded
                          role name. A component that started role-private and is now
                          needed by a second role never gets a cross-role import (the
                          lint rule blocks it) or a duplicate copy in the new role's
                          folder — it gets **promoted**: moved into
                          `components/common/`, generalized (role-specific naming/copy
                          pushed into props), both roles' call sites repointed at the
                          common location. See `fe-component-scaffold`'s Step 3 for the
                          full promotion workflow.
  components/layouts/    AppLayout, AuthLayout, ErrorLayout, RoleLayout (renders the right
                          shell for whichever role is signed in — driven by
                          routes/ProtectedRoutes.tsx, not a separate layout per role)
  pages/common/          Pages reachable by every role: ForbiddenPage, ExamplePage, and the
                          common-route placeholders every role's sidebar links to —
                          SettingsPage/ProfilePage/NotificationsPage (roles: 'all', registered
                          in routes/ProtectedRoutes.tsx's COMMON_PROTECTED_ROUTES)
  pages/auth/            The 5 Auth pages (route-level glue only — see components/auth/README)
  pages/<role>/          Pages owned by one role — mirrors components/<role>/. Ships with
                          two placeholders: member/ (Role.MEMBER) and admin/ (Role.ADMIN)
  hooks/<concern>/       Every hook, no exceptions — src/hooks/<concern>/<hookName>.ts,
                          where <concern> is common/ (generic or cross-role, e.g.
                          useDebouncedValue, useThemeSync, useSyncAuthAcrossTabs, and
                          every current feature-data hook — see § "Where things go"
                          below), auth/ (useAuth.ts — every auth mutation hook in one
                          file: useLogin/useSignup/useLogout/useForgotPassword/
                          useResetPassword/useVerifyOtp, plus useResendSignupOtp/
                          useVerifyForgotPasswordOtp for the forgot-password OTP flow —
                          see that file's own doc comment for why useLogin/useLogout
                          don't call authService directly like the rest do), or a role
                          name (admin/member/a future portal) for a hook genuinely
                          specific to that role's own pages. A feature's own
                          data-fetching hook is never co-located inside its component
                          folder — company-wide convention, not per-project.
                          hooks/admin/ and hooks/member/ don't exist yet (no hook is
                          role-specific today) — expected, not a gap, same as
                          components/admin/ and components/member/ themselves; see
                          hooks/README.md.
  lib/                   utils.ts (cn() class-merge helper for CVA/Radix components);
                          url-state/ (keys.ts's UrlStateKey registry + useTableUrlState.ts/
                          useModalUrlState.ts, the nuqs-backed hooks every URL-addressable
                          list/dialog page copies — see § Data & State and
                          docs/adr/url-page-state.md)
  services/<concern>/    api-client.ts and queryClient.ts stay at services/ root —
                          cross-cutting infrastructure every concern's service depends
                          on, not a "concern" of their own (same reasoning that keeps
                          lib/utils.ts and constants/ un-concern-scoped). Every other
                          file is a real API client for one concern, one file per
                          concern (auth/authService.ts, common/exampleService.ts —
                          same <concern> folders as hooks/<concern>/), one typed
                          method per endpoint, matching authService.ts's shape (a
                          plain object of async methods). **Hard rule: a hook's
                          `queryFn`/`mutationFn` calls a service-file function — it
                          never calls `apiClient` directly.** The service function
                          owns the raw HTTP call *and* the boundary Zod validation;
                          the hook owns only the TanStack Query wiring (cache key,
                          invalidation, toast). A role concern's own folder (e.g.
                          services/member/) doesn't exist until that role has a real
                          service — same "stays empty until needed" precedent as
                          hooks/admin/; see services/README.md.
  utils/                 Pure functions only (100% unit-testable)
  schemas/<concern>/     Zod schemas (forms + API contracts), one folder per concern —
                          same <concern> convention as components/hooks/services:
                          auth/auth.schema.ts, common/common.schema.ts (shared
                          primitives: email/password/phone/url) + common/example.schema.ts,
                          or a role's own folder (e.g. member/) the moment that role
                          has a real schema. A schema used by only one concern lives
                          in that concern's own folder, never a flat
                          src/schemas/*.schema.ts list.
  types/<concern>/       Shared, hand-written TS interfaces (types MAY be barrel-exported
                          — the one deliberate exception to the no-barrel rule) — common/
                          for anything genuinely cross-concern (ApiResponse, Paginated),
                          auth/ for auth-scoped types (AuthUser, AuthTokens). A type
                          used by only one concern lives in that concern's own folder,
                          never force-moved into common/ just because it exists; see
                          types/README.md. This is a distinct category from a Zod-schema-
                          derived type (ExampleItem, LoginValues, ...): those are never
                          hand-duplicated here — they're exported straight from their
                          schema file via `z.infer` (§ Data & State's "Zod schema →
                          z.infer type" rule) and imported from `src/schemas/<concern>/`
                          at every call site. `types/<concern>/` is for the types that
                          have no schema behind them at all.
  constants/              One API-route enum file per portal/concern — auth.ts
                          (AuthRoutes), common.ts (CommonRoutes), and one such file
                          per additional role/concern the moment it actually gets a
                          real endpoint (see § Constant Registries) — never one enum
                          per feature and never a flat api-routes.ts holding every
                          group. queryKeys.ts (the global QueryKey enum, deliberately
                          NOT split per-portal — see its own file comment for why) and
                          config.ts/env.ts (cross-cutting infra, same "stays at root"
                          reasoning as services/api-client.ts) are the concern-agnostic
                          exceptions and stay flat at constants/ root.
  routes/                roles.ts (the Role registry), ProtectedRoutes.tsx (every protected
                          page + which roles may reach it + its sidebar nav entry, plus
                          getNavItemsForRole/getHomeRouteForRole/hasHomeRouteForRole/
                          getRoleLayout), PublicRoutes.tsx (the guest-only auth screens),
                          AppRouters.tsx (createBrowserRouter — generates every <Route> from
                          those two files, PLUS its own hardcoded "public shell" routes
                          reachable whether signed in or not — ForbiddenPage, ExamplePage,
                          the catch-all 404 — see § "Where things go" below),
                          HomeRedirectRoute.tsx ("/" itself — never real content; a
                          signed-in visitor goes straight to getHomeRouteForRole(user.role),
                          a signed-out one to /login; if hasHomeRouteForRole(user.role) is
                          false — a role genuinely has no nav-eligible route registered yet —
                          renders a clear dev-facing message instead of silently falling
                          back to /login), AuthRedirectRoute.tsx (keeps a signed-in user off
                          the public auth screens, same getHomeRouteForRole target),
                          AuthenticatedRoute.tsx (auth-only gate — wraps RoleLayout itself
                          around the whole protected group so an unauthenticated visitor
                          never sees a flash of its chrome, and doubles as a standalone gate
                          both HomeRedirectRoute and a route outside the registry reuse for
                          their own signed-out branch), RoleGuards.tsx (the per-route auth +
                          role gate `AppRouters.tsx` wraps every protected route in) — page
                          components live in src/pages/, not here
  stores/                Zustand stores, one file per domain slice (authStore is
                          persist-backed, holds accessToken/refreshToken/user/hasHydrated;
                          themeStore drives light/dark/system)
  mocks/                 MSW handlers.ts (shared fixtures) + browser.ts (dev-time worker) +
                          server.ts (Node server, tests only — see § Testing)
  test/                  setup.ts (Vitest setup: jest-dom matchers, MSW server lifecycle,
                          matchMedia/Pointer Capture stubs) + renderWithProviders.tsx (fresh
                          QueryClient + MemoryRouter per test) — see § Testing
  i18n/                  i18next setup (index.ts) + locales/<lng>/common.json — the
                          only source of user-facing text, see § Data & State below
```

Where things go — quick answers for "where does X go?":

- A reusable button/input/modal → `src/components/common/`, built on Radix + CVA (see
  Tech Stack). Simple presentational pieces don't need Radix — only reach for a Radix
  primitive when the component needs real interaction/accessibility behavior (focus
  trapping, portals, roving tabindex) that's error-prone to hand-roll.
- A screen/feature → **copy** `components/example/` + `pages/common/ExamplePage.tsx` (a
  data-driven list/search screen) or `components/auth/` + `pages/auth/` (a multi-page form
  flow), whichever shape is closer, rename, gut the logic — **and also copy its hooks and
  service**, which live in `hooks/common/` (`useExampleItems.ts` + its three mutation-hook
  siblings) and `services/common/exampleService.ts`, not the component folder itself, so
  neither comes along automatically. A component that isn't role-specific gets its own
  folder at `components/<concern>/` (same level as `common/`); a role-specific one gets
  `components/<role>/`, mirrored by `pages/<role>/`, `hooks/<role>/`,
  `services/<role>/`, and `schemas/<role>/`.
- A new role, or a route only some roles may reach → this is the **role system**
  (`src/routes/ProtectedRoutes.tsx`), not a one-off guard. Three steps, in order: add the
  role to `src/routes/roles.ts`'s `Role` enum; add its own routes to `ProtectedRoutes.tsx`
  (`roles: [Role.X]`, plus `nav: { labelKey, end? }` on any route that should appear in
  the sidebar) and its entry in that same file's `ROLE_LAYOUT` map (reuse
  `variant: 'sidebar'` unless it needs a visually different shell); add its pages under
  `src/pages/<role>/`. A route every role should reach (e.g. the shipped settings/profile/
  notifications pages) goes in `ProtectedRoutes.tsx`'s `COMMON_PROTECTED_ROUTES` instead
  (`roles: 'all'`) — registered once, it shows up in every role's sidebar automatically, no
  per-role nav file to touch. No router, guard, or layout code changes — `AppRouters.tsx`
  generates every protected `<Route>` from `PROTECTED_ROUTES`, wrapping each one in
  `RoleGuards` (`src/routes/RoleGuards.tsx`) with that route's own `roles`, and `RoleLayout`
  (`src/components/layouts/RoleLayout.tsx`) reads the shell + nav for the signed-in role
  from the same file. See `pages/member/` (`Role.MEMBER`) and `pages/admin/`
  (`Role.ADMIN`) for the reference shape. For a one-off protected route deliberately kept
  outside the registry, `AuthenticatedRoute`/`AuthRedirectRoute` (`src/routes/`) are still
  there standalone. `Can` (`src/components/common/Can.tsx`) is the separate inline-UI-level
  gate (hide/show a fragment of an already-rendered page).
- A page reachable whether signed in or not, and not part of the guest-only auth flow either
  (the shipped example: `ForbiddenPage`, `ExamplePage`) → this is neither
  `ProtectedRoutes.tsx` nor `PublicRoutes.tsx` — it's its own hardcoded `<Route>` inside
  `AppRouters.tsx`'s public shell block (the `<Route path="/" element={<AppLayout />}>`
  group alongside `ForbiddenPage`/the catch-all 404). No registry entry, no auth guard, no
  `AuthRedirectRoute` wrapper — deliberate, since these pages have nothing to gate.
  `ExamplePage` (the reference feature every new list/search screen copies) is wired exactly
  this way, not through `ProtectedRoutes.tsx`. `"/"` itself lives in this same block but
  isn't an instance of this category — it has no content of its own to gate because it's
  never real content at all; see `HomeRedirectRoute.tsx` above.
- Data fetching → a TanStack Query hook (never a raw `useEffect` fetch), placed under
  `src/hooks/<concern>/` — never co-located inside the feature's own component folder.
  `<concern>` is `common/` when the hook is genuinely cross-role (e.g. a feature reachable
  by every role, or truly generic logic) or a role name when the hook only ever makes
  sense inside that role's own pages — the same decision `src/components/<concern>/`
  already makes, applied identically here. **The hook itself never calls `apiClient`** —
  its `queryFn`/`mutationFn` calls a function exported from the matching
  `src/services/<concern>/<name>Service.ts` (see the Directory Map's `services/<concern>/`
  entry and `src/services/README.md`); the service function owns the raw HTTP call and the
  boundary Zod validation, the hook owns only the TanStack Query wiring. `src/hooks/common/
useExampleItems.ts` + `src/services/common/exampleService.ts` (plus the three
  mutation-hook/service-method siblings) is the reference shape. Failures toast
  automatically via `queryClient.ts`; opt out per-call with `meta: { skipErrorToast: true }`.
- UI-only state → a Zustand store (feature-scoped when feature-specific).
- Form + validation → React Hook Form + a Zod schema in `src/schemas/<concern>/` (same
  `<concern>` folder as everywhere else — see the Directory Map's `schemas/<concern>/`
  entry), composed from `src/schemas/common/common.schema.ts` primitives where one already
  exists.
- User-facing text → a key in `src/i18n/locales/<lng>/common.json`, read via
  `useTranslation()`'s `t('KEY')` (or `i18n.t('KEY')` outside a component, e.g. a Zod
  schema) — never hardcode a string in JSX. i18n is split per **language** only (one
  `common.json` per `<lng>`, holding every key the whole app uses) — never subdivided
  further by concern/portal the way routes/schemas/services are; see § Internationalization.
- API path → a member on the relevant portal/concern's route enum in
  `src/constants/<concern>.ts` (`AuthRoutes` in `auth.ts`, `CommonRoutes` in `common.ts`,
  and one such file per role/concern as each actually gets a real endpoint — see
  § Constant Registries) — never a new enum per feature, and never a flat
  `api-routes.ts` holding every group. The route string itself is an absolute path only
  (e.g. `/example-items`) — never a hardcoded host or version prefix (no `/api/v1/...`);
  the host comes from `VITE_API_BASE_URL` (`src/constants/env.ts`/`config.ts`), and there
  is no shared prefix constant either, by design (see `.env.example`'s own instruction not
  to add one).
- Query key → a member on `src/constants/queryKeys.ts`'s `QueryKey` enum, referenced directly
  from the feature's query hook — never a per-feature key factory.
- A new env var → add it to `.env.example`, `src/vite-env.d.ts`, and the Zod schema in
  `src/constants/env.ts` — an unvalidated `import.meta.env.VITE_X` read is not allowed.

---

## Naming Conventions

- **Components:** PascalCase files + one **named** export (`Button.tsx` → `export function Button`).
- **Hooks:** camelCase with `use` prefix (`useDebouncedValue.ts`).
- **Utils:** camelCase (`getPageCount.ts`).
- **Stores:** `useXStore` in `camelCaseStore.ts`.

---

## Constant Registries

A closed set of named string values — a role registry, an API-route table, a query-key
registry, or any similar fixed set a new feature introduces — is a real TypeScript `enum`,
not an `as const` object:

```ts
export enum Role {
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN',
}
```

- **One flat enum per concern.** A real `enum` can't nest, so a grouped registry (the old
  single `API_ROUTES` object) becomes one enum per group instead. `Role`
  (`src/routes/roles.ts`) and `QueryKey` (`src/constants/queryKeys.ts`) are the flat
  reference shapes.
- **API-route enums are grouped by portal/concern, never by feature.** One enum per
  `src/constants/<concern>.ts` file — `AuthRoutes` in `auth.ts`, `CommonRoutes` in
  `common.ts`, and so on for whatever roles/concerns actually exist in
  `src/routes/roles.ts` at the time (this list is illustrative, not exhaustive or
  permanent — a renamed or newly added role gets its own `constants/<role>.ts` the same
  way, no special-casing needed, and that file does not exist until that role actually has
  a real endpoint — same "stays empty until needed" precedent as an unpopulated
  `hooks/<role>/`). A second feature within the same portal adds its own member to that
  portal's existing enum — it does **not** get a new enum of its own. This is a correction
  from an earlier shape of this boilerplate that grouped routes one enum per _feature_
  instead of one enum per _portal_; that shape does not scale — a portal with five
  features would otherwise need five separate enums instead of one place to look.
- **No hardcoded host or version prefix on a route string.** Every route is an absolute
  path only (`/example-items`, `/auth/login`) — the host comes from `VITE_API_BASE_URL`
  (`src/constants/env.ts` → `config.ts` → `api-client.ts`'s axios `baseURL`), and there is
  deliberately no shared `"/api/v1"`-style prefix constant either (see `.env.example`'s own
  instruction against adding one to the base URL). A route string that embeds a version or
  host prefix directly is a bug, not a style choice — it silently breaks the moment the
  same app talks to a differently-versioned or differently-hosted backend.
- **`enum`, never `const enum`.** This repo's `isolatedModules`/`verbatimModuleSyntax`
  (`tsconfig.app.json`/`tsconfig.node.json`) transpile file-by-file via esbuild, which does not
  support `const enum` inlining — using one either errors or silently falls back to a real
  runtime object anyway, so it buys nothing here.
- **Comparing an enum against an untyped external string needs a boundary cast.** Unlike an
  `as const` object's string-literal type, an `enum` member is nominal — a plain string from
  a decoded JWT, an API response, or an MSW fixture is not automatically assignable to it, and
  `@typescript-eslint/no-unsafe-enum-comparison` (part of this repo's `strictTypeChecked` lint
  config) flags comparing the two without one. Cast at the exact comparison, the same way
  `roles.ts`'s own `isRole` type guard does (`value as Role`) and `ProtectedRoutes.tsx`/
  `RoleGuards.tsx` do when checking a role read off `AuthUser.role: string` — never widen the
  enum-typed side to `string` just to silence it.
- **A value assigned _into_ a plain `string`-typed field needs no cast** — a string enum
  member is itself a `string`, so `role: Role.ADMIN` satisfies `AuthUser['role']` (or any
  other `string` field/param) with no cast; the boundary-cast rule above only applies to the
  reverse direction (external string → enum).

---

## Component Conventions

- Props are an explicit TypeScript `interface`; destructure in the signature.
- Optional props use `?` and have defaults. Never `props: any`.
- Do not spread `...props` without extending a typed HTML-attributes interface.
- Reference design tokens only — no arbitrary Tailwind values (`w-[127px]`, `text-[#abc]`),
  **including inside a `cva()` variant map** — the arbitrary-value lint rule only scans JSX
  `className` attributes, not `cva()` call arguments, so this one is on you to hold the line.
- Variant/size props on a common component go through `cva()` (see `Button.tsx`), not manual
  ternary string-building — merge the caller's `className` override with `cn()` last, always.
- No inline `style={{}}`. Class order: layout → display → text → effects → state.
- Buttons always have an explicit `type`. Images always have `alt` (or `alt="" aria-hidden`).
- Reach for a Radix primitive (`@radix-ui/react-*`) for anything with real interaction
  behavior — dialogs, popovers, dropdowns, toasts, tabs. Don't hand-roll focus trapping or
  portal logic that Radix already solved.
- **A new look on an existing `src/components/common/` primitive is a new `cva()` variant
  on that component, never a parallel one-off component.** Before scaffolding a new common
  component, ask "is this genuinely a new kind of thing, or is it `Button`/`Input`/`Dialog`/
  etc. with a different variant/size/shape?" — a circular icon-only floating action button,
  for example, is `Button` with `size="icon" shape="circle"` (see `Button.tsx`'s `shape`
  variant), not a standalone `FloatingActionButton.tsx`. Position (fixed/absolute
  placement) is page layout, not part of a component's reusable look, so it's fine to pass
  positioning classes via the caller's `className` — that is not the same as hoisting the
  component's actual visual identity out into a one-off duplicate. This is the same
  reasoning `fe-component-scaffold`'s duplicate-check step applies before scaffolding
  anything new (`.claude/skills/fe-component-scaffold/SKILL.md`).

---

## Data & State

- **Server state:** TanStack Query only. Validate payloads with Zod at the boundary. Errors
  toast automatically (`queryClient.ts`'s `QueryCache`/`MutationCache` `onError`) — opt a
  specific call out with `meta: { skipErrorToast: true }` when it renders its own inline error.
- **Hooks call services, never `apiClient` directly.** A `src/hooks/<concern>/` hook's
  `queryFn`/`mutationFn` is a call to a function exported from the matching
  `src/services/<concern>/<name>Service.ts` — the service function is what actually calls
  `apiClient` and Zod-validates the response at the boundary. The hook itself owns only the
  TanStack Query wiring: cache key, `placeholderData`, invalidation, toast. See
  `src/services/README.md` and `src/services/auth/authService.ts` (the original reference
  shape) / `src/services/common/exampleService.ts` (the feature-service reference shape) —
  a service file is a plain object of typed async methods, one method per endpoint, same
  shape regardless of concern.
- **Query keys:** every query key is a named member of the single global registry
  `src/constants/queryKeys.ts` (`QueryKey`), referenced directly in a feature's `queryKey`
  array — never a per-feature key factory, never an inline string literal in the hook itself:
  ```ts
  export enum QueryKey {
    EXAMPLE_LIST = 'example-list',
  }
  ```
  A feature's hook imports the member it needs (`queryKey: [QueryKey.EXAMPLE_LIST, params]`) —
  adding a new query starts with adding its member to that one file, not inventing a local key.
  Wrap every `useQuery` in a custom hook — never call it directly in a component. Every
  variable read inside `queryFn` must also be in `queryKey` (treat it like a `useEffect`
  dependency array). Use `placeholderData: keepPreviousData` for paginated/filtered queries.
- **Mutations:** when a mutation should invalidate a cached query (e.g. a create/update/delete
  against a list something on screen already reads via `useQuery`) — confirm success with
  `toast.success(...)` inside the hook's `useMutation({ onSuccess })`, then `return` the result
  of `queryClient.invalidateQueries(...)` from that same `onSuccess` so the mutation stays
  pending until the refetch lands. **`src/hooks/common/useCreateExampleItem.ts`/
  `useUpdateExampleItem.ts`/`useDeleteExampleItem.ts` (calling into
  `src/services/common/exampleService.ts`) are the reference implementation of this exact
  pattern** — copy their shape (one small mutation hook per operation, each `mutationFn`
  delegating to the matching service method, `useQueryClient()` from React context, never
  the app's shared `queryClient` singleton import) for any new create/update/delete hook.
  This is exactly the class of bug `react-doctor`'s
  `query-mutation-missing-invalidation` rule catches — found four real instances of it in this
  boilerplate's own Auth forms during a QA pass, which is what prompted adding the
  `ExampleWidget` CRUD reference in the first place; a one-off action with nothing cached to
  invalidate (this repo's `signup`/`forgotPassword`/etc.) is a legitimate exception, not
  something to fake an invalidation call for. Prefer `mutate` over `mutateAsync`; if you must
  use `mutateAsync`, append `.catch(() => {})` (the global `onError` already toasts) instead of
  a try/catch. Put success toast + cache/store updates in the hook's `onSuccess`; put call-site
  UI effects (`navigate`, `form.reset()`) in the `mutate()` call's own `onSuccess` callback —
  never after an `await mutateAsync(...)`, which runs even mid-navigation/unmount.
- **URL-addressable page state:** filters, sort, search text, page number, the selected tab,
  and a dialog's open/context state are URL query params via `nuqs` (`src/lib/url-state/`),
  not `useState`/Zustand — a refresh or a link a colleague opens must reproduce the exact
  same view (docs/adr/url-page-state.md, issue #32). `useTableUrlState()`
  (`src/lib/url-state/useTableUrlState.ts`) is the reference hook for a paginated/searchable
  list — copy it the same way a new feature copies `ExampleWidget` itself. A small dialog's
  context goes in a query param too (D1 — `useModalUrlState.ts`, `?modal=edit&id=42`); a
  dialog large/complex enough to deserve its own URL segment is a child route instead (D2) —
  no example ships yet, but nothing about `useModalUrlState`'s shape blocks adding one. Every
  URL param uses a `nuqs` parser with `.withDefault(...)` so a malformed value (`?page=abc`)
  falls back to the default instead of crashing the page — never hand-parse
  `useSearchParams()` output directly. A page's own new key (a status filter, e.g.) is a
  plain string key alongside `UrlStateKey`'s registry, not forced into it — that registry
  only owns the six keys (`page`, `limit`, `q`, `sort`, `tab`, `modal`) that repeat across
  pages. Never put a token, session id, or other personal data in a URL param.
- **Client/UI state:** Zustand, one slice per domain; feature UI state that is genuinely
  transient (hover, focus, unsaved form input — never worth a shareable link) lives in the
  feature folder, as `useState` or a Zustand slice. Auth state (`authStore.ts`) is
  `persist`-backed — it is the single source of truth for the access/refresh token pair;
  nothing else touches `localStorage` for it directly.
- **Forms:** React Hook Form + `zodResolver`; share Zod types between form + API. Reuse a
  primitive from `src/schemas/common/common.schema.ts` (email/password/phone/url) instead
  of redefining validation inline when one already covers the field.
- **Zod v4, not v3.** Use the top-level string formats — `z.email()`, `z.url()`, `z.uuid()` —
  never the deprecated `z.string().email()`. For a required-then-format field, chain
  `z.string().trim().min(1, '<Field> is required').pipe(z.email('Enter a valid email'))` so an
  empty value and a malformed one get distinct messages. `.refine()`'s object form takes
  `{ error, path }`, not `{ message, path }` (v3). Build create/update/filter schema variants
  off one base with `.extend()`/`.pick()`/`.omit()`/`.partial()` — never re-declare fields.
  The same composition is the intended approach for nested/related data too (e.g. an item
  with its own one-to-many sub-list) — a nested field is just `z.array(subItemSchema)` (or
  `subItemSchema` directly) inside `.extend()`, same as any other field; no example of this
  ships yet, but nothing about the pattern changes shape for it.
- The Axios client (`api-client.ts`) owns auth-token attach and error normalization
  (`ApiError`); on a 401 from any non-auth-flow route it runs a single-flight
  refresh-and-retry (see `docs/auth-token-refresh.md` — the pattern documented there is the
  default here, not opt-in, because this boilerplate's access token is genuinely short-lived).
  A failed refresh, or a second 401 after retrying, clears the auth store and lets the router
  redirect. Do not create ad-hoc `fetch`/`axios` instances.

---

## Internationalization

Every user-facing string is a key in `src/i18n/locales/<lng>/common.json` — there is no
hardcoded-string escape hatch and no separate `ui-strings.ts`-style constants file.

**i18n is split per language only — never further subdivided by concern/portal.** Unlike
routes (`src/constants/<concern>.ts`), schemas (`src/schemas/<concern>/`), services
(`src/services/<concern>/`), and hooks (`src/hooks/<concern>/`), there is no
`locales/en/auth.json`/`locales/en/member.json`-style split. One `common.json` per `<lng>`
holds every key the whole app uses, regardless of which portal/feature reads it — a new
feature (auth, common, or role-specific) still adds its keys to that same single file per
language. Do not introduce a per-concern i18n split.

- **Inside a component:** `const { t } = useTranslation(); ...{t('BUTTON_SAVE')}`.
- **Outside a component** (a Zod schema, `queryClient.ts`'s error handler, anything built
  at module load or in a non-render callback): `import i18n from 'src/i18n'; i18n.t('KEY')`.
- **A prop that overrides default text** (e.g. `ConfirmDialog`'s `confirmLabel`): give the
  prop no default value; resolve the fallback inside the component body with
  `label ?? t('KEY')`. A `useTranslation()` call cannot sit in a default-parameter
  position — that runs before the component (and its hooks) exist.
- **Adding a new language:** copy `locales/en/common.json` to `locales/<lng>/common.json`,
  translate the values (keep every key identical), then add it to the `resources` object in
  `src/i18n/index.ts`. No component changes needed anywhere.

---

## Accessibility (WCAG 2.1 AA — non-negotiable)

Enforced by `eslint-plugin-jsx-a11y`'s dedicated strict lint stage (static, runs on every
commit). There is no runtime a11y test in this boilerplate — treat the checklist below as
something you verify by reading the markup and trying the keyboard/a screen reader yourself.

- Images have `alt` (or `alt="" aria-hidden="true"` when decorative).
- Every input is labeled (`htmlFor`/wrapping); errors linked via `aria-describedby` + `role="alert"`.
- Buttons have an explicit `type`; non-button click handlers add keyboard support (Enter/Space).
- Heading order is not skipped (`h1 → h2 → h3`).
- Contrast ≥ 4.5:1 (normal) / 3:1 (large). Focus is always visible.
- Use semantic HTML first; ARIA only when semantics fall short.

---

## Testing

Vitest + React Testing Library (`@testing-library/react`, `@testing-library/user-event`,
`@testing-library/jest-dom`), jsdom environment — configured in `vite.config.ts`'s `test`
block (one config file for dev/build and tests, so plugins/aliases never drift apart) and
`src/test/setup.ts` (jest-dom matchers, the MSW node server lifecycle, a `matchMedia` +
Pointer Capture/`scrollIntoView` stub for jsdom — Radix needs the latter). `describe`/`it`/
`expect`/`vi` are globals (`test.globals: true` + `"types": ["vitest/globals"]` in
`tsconfig.app.json`) — no per-file import needed.

- `pnpm test` — watch mode, for local dev.
- `pnpm test:run` — single run, CI-safe (exits instead of watching).
- `pnpm check:test` — the gate's non-mutating wrapper around `test:run`; part of `pnpm verify`
  (runs right after `check:types`, before the lint/format/style stages — a broken workflow is
  a more valuable signal to fail fast on than a lint nit, and it should block before the
  expensive `check:build` step even starts).

**Philosophy: workflow/integration-level testing, not isolated component unit-testing.**
This repo does not unit-test individual primitives (`Button`, `Input`, `Dialog`, `ThemeToggle`,
etc.) — they're shadcn/Radix-pattern components, already battle-tested upstream; a click/focus
test on `Button` alone proves nothing about whether the app actually works. Instead, every test
exercises a real user-facing flow — button click → form/modal → submit → success/error/cancel
— through the components that flow actually uses, so a primitive gets its coverage
transitively, through every workflow that touches it, not from a standalone unit test of its
own. `src/components/common/` never has its own `*.test.tsx` files.

Two kinds of test, two different naming/location rules:

1. **Feature workflow tests** — `<Name>.workflow.test.tsx`, co-located inside the feature's
   own folder (`src/components/example/ExampleWidget.workflow.test.tsx` is the reference —
   copy its shape for a new feature, same as copying the feature's code). The `.workflow.`
   in the name is deliberate: it marks "this is an end-to-end flow test," not a unit test, at
   a glance. A feature that splits into multiple pieces (e.g. `AddManagerModal.tsx`,
   `EditManagerModal.tsx`) gets one `<Piece>.workflow.test.tsx` per piece, in that same
   feature folder — never a separate parallel test-only folder — see
   `src/components/example/`'s own `AddExampleItemModal.workflow.test.tsx`/
   `EditExampleItemModal.workflow.test.tsx`/`DeleteExampleItemButton.workflow.test.tsx` for
   the real (not hypothetical) reference shape, including asserting the list itself changes
   after a create/update/delete — not just that the mutation resolved — which is the actual
   point of testing the invalidation wiring from the Mutations bullet above. Cover the real flow: initial
   load, the primary interaction (search/submit/toggle/...), and its success/empty/error/
   cancel edge cases — through Testing Library queries (`getByRole`/`getByLabelText`, not
   `getByTestId` or DOM internals) driven by real `@testing-library/user-event` interactions,
   and through the real MSW-backed network layer (`src/mocks/handlers.ts` via `msw/node`'s
   `setupServer`, `src/mocks/server.ts`) — never an inline mock of `apiClient`/`fetch`. Add a
   new scenario to `handlers.ts` when a workflow genuinely needs the backend to respond a new
   way (e.g. a duplicate-email 409); reach for `server.use(...)` inside the test only for a
   one-off override that isn't worth a permanent fixture. Reuse
   `src/test/renderWithProviders.tsx` for anything touching TanStack Query or react-router
   context — a fresh `QueryClient` per test (never the app's shared singleton, which would
   leak cached queries between tests) inside a `MemoryRouter`.
2. **Service/hook tests** — `*.test.ts`, co-located next to the file, for `src/services/`
   and `src/hooks/`. This is reusable logic multiple features depend on (the axios
   interceptors, `authService`, generic hooks), so it's tested standalone rather than only
   incidentally through whichever workflow happens to exercise it. Services still go through
   real MSW handlers (never a direct `apiClient`/axios mock) — `src/services/api-client.test.ts`
   and `src/services/auth/authService.test.ts` are the reference shape. Hooks use React
   Testing Library's
   `renderHook` (`@testing-library/react`); a hook with a timer uses `vi.useFakeTimers()` +
   `vi.advanceTimersByTime(...)`, never a real `setTimeout` wait — `useDebouncedValue.test.ts`
   is the reference shape.
3. **Utility tests** — `*.test.ts`, co-located next to the file, for every pure function in
   `src/utils/` — the same standalone-test standard as `src/services/`/`src/hooks/` above,
   for the same reason (`src/utils/`'s own directory-map entry already calls these functions
   "100% unit-testable"; the standard was previously true but unstated). No React rendering
   needed — call the function directly and assert on its return value, covering the normal
   case plus every edge case/guard clause the function actually branches on. Plain `describe`/
   `it`/`expect`, no `renderHook`/`renderWithProviders` — `getPageCount.test.ts` is the
   reference shape.

**What to avoid:** a standalone test for a `src/components/common/` primitive; testing
implementation details (state variable names, internal hook call counts, snapshot tests of
markup); reaching for `getByTestId` when a role/label query works; a separate a11y-assertion
library — RTL's role-based queries already fail loudly when an element isn't accessibly
named, which is most of the signal a dedicated a11y-in-tests tool would add on top.

**No coverage reporting or thresholds** — not configured, not a target to chase. Add one
later as its own decision, not a side effect of adding tests.

**Browser-layer smoke tests (Playwright, Chromium only).** A third, much narrower layer:
`e2e/*.spec.ts` (shared fixture `e2e/fixtures.ts`), run via `pnpm test:e2e`/`pnpm check:e2e`,
against the real production build (`pnpm build:e2e` → `vite preview` — see
`playwright.config.ts`). This is a **small, deterministic smoke-gate**, not a second E2E
suite duplicating Vitest/RTL: it proves the app boots in a real browser, one reference route
renders, the MSW **browser** worker actually serves a real fetch call, and one representative
user interaction works end-to-end. **Do not write a Playwright test just because a file is a
component** — component/state behavior belongs in a Vitest/RTL workflow test; reach for
Playwright only for something only a real browser can prove (a real network request through
the actual MSW service worker, a genuine page load/boot, real layout/paint). New features do
**not** each get their own Playwright spec — `e2e/smoke.spec.ts` stays the one, centralized
smoke-gate; only extend it if the smoke-gate itself needs to cover a new reference route. The
shared fixture fails any test where the page logs a `console.error`/uncaught `pageerror` (a
narrow, explicitly documented allowlist exists for genuinely unavoidable third-party noise —
never a blanket suppression), and exposes `checkA11y()` (axe-core) for a page-level scan.
For local visual debugging, `pnpm test:e2e:headed` (`playwright test --headed`) is the default
recommendation — the whole suite in a visible browser, no changed-detection. At today's size
(one spec, ~5s) running everything is cheap and safe: you always see a real pass/fail, never a
`0 tests` result you might misread as "nothing broke."

`pnpm test:e2e:changed` (`playwright test --only-changed --headed`) is an advanced option for
once the suite is large enough that a full headed run is slow — **not** the default. Its
dependency graph only follows what `e2e/*.ts` files themselves `import` (i.e.
`e2e/fixtures.ts`), not the app source (`src/`) a spec merely drives over the network/browser.
Editing `e2e/smoke.spec.ts`/`fixtures.ts` triggers it; editing an app component (e.g.
`ExampleWidget.tsx`) does not — that shows `0 tests`, not a false pass, but don't mistake it for
"the smoke gate is clean." `pnpm verify`/CI always run the full `e2e/` suite headless regardless
of either local script; changed-only is a narrow local convenience, never how the gate itself
decides what to run.

**Requirement → test-layer mapping:**

| What you're testing                                                    | Layer                                                                                    |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A feature's user-facing flow (load → interact → success/error)         | Vitest + RTL workflow test (`*.workflow.test.tsx`)                                       |
| `src/services/`/`src/hooks/`/`src/utils/` logic shared across features | Vitest, standalone `*.test.ts`                                                           |
| The app actually boots, in a real browser                              | Playwright (`e2e/smoke.spec.ts`)                                                         |
| A real network round trip through the MSW **browser** worker           | Playwright                                                                               |
| Accessibility — component level                                        | RTL's `getByRole`/`getByLabelText` queries (a mislabeled element simply fails the query) |
| Accessibility — route level                                            | Playwright + axe-core (`checkA11y()` in `e2e/fixtures.ts`)                               |

A component-level unit test (isolated `Button`/`Input`/etc.) is not on this table on purpose
— see the philosophy note above.

Building a new feature (`fe-component-scaffold` skill, `/new-feature`)? Copy
`src/components/example/`'s `ExampleWidget.workflow.test.tsx` alongside its component and
adapt it — the workflow test is part of the reference shape to copy, not a follow-up step.
(Not a new Playwright spec — see above.)

Beyond automated tests, verify a change by running it too: `pnpm dev`, exercise the actual
feature/component you touched, and lean on the rest of the gate (`pnpm verify`) for
everything mechanical — types, lint, accessibility lint, format, style consistency, React
Doctor, the build, the browser smoke-gate (see § Quality Gate).

---

## Styling Tokens

All visual values come from the `@theme` block in `src/index.css` (colors, radius, spacing,
type). Re-skin a project by editing tokens there — never by hardcoding values in components.
See `docs/design-guidelines.md` for the flat-by-default rule, the typography hierarchy, and
component-specific styling conventions (buttons, dialogs, navigation).

- **Never hoist a class string to share it.** The failure mode this guards against: a call
  site needs a look a common component doesn't offer, so someone pulls the classes into a
  shared `const` and imports it everywhere. That constant is a variant with no home — it
  drifts from the component it was copied out of and leaks across features. If a look repeats,
  add it as a real `cva()` variant on the component (see `Button.tsx`'s `variant`/`size`), not
  a floating string.
- **No `dark:` overrides at the call site.** Token-driven styling makes dark mode automatic
  (see `.dark { ... }` in `src/index.css`) — a `dark:bg-...` on a component is a sign the
  _token_ needs a dark-mode value, not that the call site needs a conditional class.

---

## Commit Format (Conventional Commits)

`<type>(<scope>): <subject>` — types: `feat fix refactor perf test docs style build ci chore`.
Subject: lower-case start, no trailing period, ≤ 72 chars. Example:
`feat(components): add UserCard component`.

---

## The Quality Gate — one canonical contract: `pnpm verify`

`pnpm verify` is **the** definition of "ready to merge." It chains sixteen checks, each its
own non-mutating `check:*`/`ai:check`/`static-analysis:contract` script in `package.json`,
always run full-repo:

1. `check:guardrails` — secrets, merge markers, `eslint-disable`, oversized files (rule set
   lives in `scripts/checks/guard-rails.mjs`). Deliberately narrow: `console.*`, `as any`, and
   `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` used to be regex-checked here too, but ESLint
   now catches all three more reliably (AST-based, not regex) — see that file's own comment
   for exactly which rule replaced which check.
2. `static-analysis:contract` — asserts the required ESLint rules/TS compiler options haven't
   silently regressed (`scripts/check-static-analysis.mjs`); overlaps in spirit with
   `check:lint-contract` below (both guard against the same failure mode, from two separate
   scripts) — a known duplication, not a deliberate two-layer design.
3. `ai:check` — asserts `.cursor/commands/` matches what `pnpm ai:sync` would generate from
   `.claude/commands/`, without writing anything (`scripts/checks/ai-config-contract.mjs`,
   sharing its comparison logic with `scripts/sync-ai-config.mjs` so the two can't define "in
   sync" differently) — see § Checks vs Fixes.
4. `check:lint-contract` — asserts the specific ESLint rule severities and `tsconfig.*.json`
   compiler options this section documents haven't silently regressed (`scripts/checks/
lint-config-contract.mjs`) — the guard against someone downgrading a rule to turn a red
   `verify` green instead of fixing the code that tripped it.
5. `check:hardening` — asserts the specific config/doc details three previously-shipped
   hardening features (Playwright browser-quality gate, Agent Execution Safety, pnpm
   supply-chain) depend on haven't silently drifted (`scripts/checks/hardening-contract.mjs`)
   — grouped here with the other `*-contract` checks, before anything more expensive runs.
6. `check:i18n` — two checks over every `src/i18n/locales/<lng>/common.json` that exists
   (`scripts/checks/i18n-key-contract.mjs`), not just `en` — a static regex scan, grouped
   with the other cheap `*-contract` checks before anything type-checked/expensive runs:
   - **Orphaned keys** — every key must be referenced somewhere in `src/`. Deliberately
     the _unused-key_ direction, not "does every `t()` call resolve" — that direction is
     already a hard `tsc -b` compile error on its own, via i18next's own TypeScript
     integration (the `CustomTypeOptions`/`resources` module augmentation in
     `src/i18n/index.ts` types `t()`'s argument as the literal union of every real key),
     so a second check duplicating it would have no real job. An orphaned key — still
     defined, nothing references it anymore — is the genuine gap nothing else in this
     gate catches.
   - **Cross-locale key parity** — every non-`en` locale's key set must exactly match
     `en`'s (`en` is the source of truth: `src/i18n/index.ts`'s own `fallbackLng: 'en'`
     and its "keys must match exactly" instruction for adding a language). Catches a
     locale silently missing a translation (i18next falls back to `en`'s string,
     masking it) or carrying a stale extra key, the moment a second locale is added —
     only `en` ships today, but the check already covers every locale that exists, not
     just the first one, so this doesn't silently stop working the day a second
     language is added.
7. `check:types` — `tsc -b --noEmit` (strict; see this section's TypeScript/ESLint strictness
   bullets below for exactly how strict).
8. `check:test` — `vitest run` (see § Testing). Placed right after `check:types` and before
   the lint/format/style stages: a broken component is a more valuable signal to catch early
   than a lint nit, and it should block before `check:build` (the most expensive stage) even
   starts, not after.
9. `check:lint` — ESLint (hooks, `jsx-key`, prop types, hardcoded text, tokens).
10. `check:a11y` — strict `jsx-a11y` pass.
11. `check:format` — Prettier, check-only.
12. `check:style` — `impeccable detect` (`< /dev/null` — see § Non-interactive by design below).
13. `check:doctor` — `react-doctor` (`--no-supply-chain` skips the Socket.dev scan for speed,
    run `pnpm doctor` for the full scan including that check; `--yes` — see below). **Only
    `error`-severity findings fail this check.** `doctor.config.ts` sets `blocking: 'error'`
    (react-doctor's own default), so a warning-only finding — e.g. this boilerplate's own
    `query-mutation-missing-invalidation` warnings on `signup`/`forgotPassword`/etc., a
    documented, deliberate exception (see § Data & State's Mutations bullet) — shows up in the
    output and lowers the score, but does **not** fail `check:doctor`, `verify`, or CI. This is
    intentional, not a gap: warnings are advisory. Run `pnpm exec react-doctor --blocking warning`
    to audit warnings as if they were blocking, but that is not what `verify`/CI enforce.
14. `check:build` — the production build succeeds (`vite build`, mode `production`).
15. `check:build-budget` — `size-limit` (see § Performance Budget) against the real
    `dist/assets/` output from the `check:build` step just before it — a separate, blocking
    gate from Vite's own advisory `chunkSizeWarningLimit` (`vite.config.ts`), which stays as-is.
16. `check:e2e` — `playwright test` (see § Testing). Deliberately **last**: it needs a real
    production build to serve (`pnpm build:e2e` — its own `dist-e2e/`, kept separate from
    `check:build`'s `dist/` so neither disturbs the other), and it's the single most expensive
    check in the chain (a real Chromium browser boot + build), so every cheaper check gets to
    fail fast first.

**TypeScript/ESLint strictness.** Both `tsconfig.app.json`/`tsconfig.node.json` and
`eslint.config.js` run the strongest maintained preset each tool ships, not a relaxed subset:

- `eslint.config.js` extends `tseslint.configs.strictTypeChecked` (not
  `recommendedTypeChecked`) and `reactHooks.configs.flat.recommended` (not the two
  hand-maintained hook rules this repo used to pin manually) — both auto-pick-up new rules
  the maintainers add, instead of drifting from upstream.
- These rules are escalated to `error` over their preset default: `react-hooks/exhaustive-deps`,
  `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises`,
  `@typescript-eslint/await-thenable`, `react/display-name`, `react/no-unescaped-entities`,
  `react-refresh/only-export-components`. `check:lint-contract` (above) is what keeps these
  honest — see that script for the exact list and how to document a genuine exception instead
  of silently downgrading one.
- `@typescript-eslint/ban-ts-comment` bans `@ts-expect-error` unconditionally (not the rule's
  own default of "allowed with a description") to match this file's § Never Do.
- `@typescript-eslint/restrict-template-expressions` allows numbers (`allowNumber: true`) —
  the one narrow, documented relaxation off `strictTypeChecked`'s defaults, because
  `` `${count}` `` is always a safe, unambiguous string (unlike objects/`any`/nullish, which
  strictTypeChecked still bans there).
- `tsconfig.app.json` and `tsconfig.node.json` both set `exactOptionalPropertyTypes` and
  `noPropertyAccessFromIndexSignature`, and both carry the identical strict-family compiler
  options — the node-tooling project (`vite.config.ts`, `doctor.config.ts`, `scripts/`) is
  held to the same bar as the app project, not a looser one.

**CI** (`.github/workflows/quality-gate.yml`) installs dependencies, installs Playwright's
Chromium browser (`pnpm exec playwright install chromium --with-deps` — needed once per
runner, `check:e2e` itself doesn't install browsers), runs a handful of the cheaper checks as
their own named steps for readable CI status (static-analysis, types, lint, a11y, format,
style), then runs the full `pnpm verify` — which re-runs those same checks plus the rest of
the 9. The early steps exist for a readable CI status line, not to avoid duplication; the
canonical rule set still lives in one place (`pnpm verify`'s own script list), not
hand-duplicated into the workflow file. On failure, it
uploads `playwright-report/`/`test-results/` as a build artifact (`if-no-files-found: ignore`
— a no-op when `verify` failed before `check:e2e` ever ran) so a human or agent can open the
trace/screenshots afterward without reproducing the failure locally first.

**`scripts/hooks/pre-commit.mjs`**, run by Husky on every commit, runs the **same** checks —
never a different rule set — scoped to just the staged files, for commit speed. Most tools
take a file list or a native staged-scan flag (ESLint, Impeccable, React Doctor's `--staged`);
Guard Rails has no such CLI, so its logic lives once in `scripts/checks/guard-rails.mjs` and
both `check:guardrails` (full-repo) and the pre-commit stage (staged-only) import the same
`guardRails()` function. `static-analysis:contract`, `ai:check`, `check:lint-contract`,
`check:test`, `check:build`, `check:build-budget`, and `check:e2e` don't have staged-scoped
pre-commit stages —
config drift, a broken build, a real-browser boot, and (with today's small suite) the cost of
running Vitest/Playwright full-repo rather than trying to scope either to staged files are
whole-repo concerns, not something a per-file staged scan would catch meaningfully faster.
Both suites still block every `pnpm verify` run and CI — just not every commit.

A green `pnpm verify` locally **is** the same contract pre-commit and CI enforce — there is
no longer a way for it to pass while the hook or CI fails. `--no-verify` is an emergency escape
hatch only — **it still fails CI.**

**Non-interactive by design.** Both `check:style` and `check:doctor` are pinned to flags that
guarantee zero prompts, in a real terminal or in CI:

- `check:style` (`impeccable detect`) has no `--yes`/`--ci` flag — its only prompt (a
  "Continue?" confirmation past 50 files) is gated purely on `process.stdin.isTTY`, so the
  script redirects stdin from `/dev/null` to force that false everywhere. (`--quiet`/`--json`
  would also suppress it, but both throw away the per-file detail needed to fix a failure.)
- `check:doctor` (`react-doctor`) passes **two** things, for two different prompts:
  - `--yes`, its documented "skip prompts" flag — covers prompts inside its plain-text report
    path (e.g. an ambiguous workspace-project selection).
  - `< /dev/null` — required separately, because `--yes` does **not** cover react-doctor's
    post-scan interactive menu ("Choose how to continue", which can offer to launch Claude
    Code in Bypass Permissions mode). That menu is a full ink TUI app, gated by its own
    `shouldUseTui()` check (`src/cli/utils/should-use-tui.ts` in the react-doctor package),
    which never looks at `flags.yes` — it only looks at whether stdin/stdout are a real TTY,
    the Node version, the terminal type, and whether `--score`/`--json`/`--json-compact`/
    `--json-out`/`--staged`/`--changed-files-from` was passed. Redirecting stdin from
    `/dev/null` trips the `!stdinIsTty` branch of that check, so the TUI (and its menu) never
    launches — the plain-text report path runs instead, same as every other check.
  - `scripts/hooks/pre-commit.mjs`'s React Diagnostics stage does **not** need either of these
    stdin tricks — it already passes `--staged`, which is itself one of the flags in
    `shouldUseTui()`'s exclusion list, so the TUI is already unreachable there. Don't add
    `< /dev/null` to that stage "for consistency" — it's already immune, and the extra
    redirect would just be dead weight.

Never remove these flags to "see the interactive menu" in a script that runs unattended
(`verify`, `gate`, CI) — run `pnpm doctor` or `pnpm exec impeccable detect src/` directly instead.

---

## Performance Budget

`check:build-budget` (`size-limit`, config in `.size-limit.js`) is a **blocking** gate on
`dist/assets/` output size — separate from Vite's own `chunkSizeWarningLimit`
(`vite.config.ts`), which stays an **advisory-only** warning in the `check:build` log and is
not touched by this feature. `size-limit` reads gzip size directly off the already-built
files (`@size-limit/file` — no re-bundling), so it costs nothing beyond `check:build` having
already run.

Two checks, both glob-based (`dist/assets/index-*.js`, `dist/assets/*.js`) rather than a
manually maintained per-file list — every existing route/vendor chunk is covered without being
named, and any new one (a new entry in `PublicRoutes.tsx`/`ProtectedRoutes.tsx`, each already
lazy-loaded per this section's own convention — see the `> 50KB` comments there) is picked up
automatically on its next build:

- **Entry bundle** (`dist/assets/index-*.js`) — **195 kB** gzipped. This chunk (React/
  React-DOM/React Router/TanStack Query/Zustand/Zod/Axios + app shell) downloads on every
  single page load, lazy-loading aside, so it gets its own budget instead of being averaged
  into the total below. Baseline at the time this budget was set: **160.95 kB** gzipped
  (**510.73 kB** raw) — 195 kB is that baseline **+ ~20%** headroom, enough that an ordinary
  dependency bump doesn't trip it, tight enough that a real regression (a heavy library
  imported eagerly instead of lazily, e.g.) still fails loudly.
- **Total JS** (`dist/assets/*.js`) — **268 kB** gzipped, all chunks (entry + every lazy route/
  vendor chunk) summed. Baseline: **~223 kB** gzipped (**~679 kB** raw); 268 kB is the same
  **+ ~20%** buffer. Catches what the entry-only check can't — e.g. a new route eagerly
  importing something heavy instead of lazy-loading it, or an existing lazy chunk quietly
  growing — without needing a budget per individual page.

Both numbers are gzip, not raw: that's the size that actually crosses the wire, and it's the
same figure Vite's own `check:build` log already reports, so a diagnosis doesn't require
converting between two different units.

**Diagnosing a failure.** `check:build-budget`'s own output names the exact check that failed
and by how much (`Package size limit has exceeded by X kB`) — no separate report to open.
Locally:

1. `pnpm build` (fresh `dist/`), then `pnpm check:build-budget` (or `pnpm exec size-limit`
   directly) to reproduce.
2. Compare against the `vite build` chunk listing just above it (`check:build`'s own output,
   or re-run `pnpm build` alone) to see which chunk(s) grew.
3. Most common cause: a new/changed import that isn't lazy — check whether it belongs inside
   a `lazy(() => import(...))` in `PublicRoutes.tsx`/`ProtectedRoutes.tsx` (this section's own
   `> 50KB` convention) instead of at module top level. (`size-limit --why` needs the
   `@size-limit/webpack`/`esbuild` plugins for its bundle-analyzer view — not installed here,
   deliberately, to keep this check a read of the real Vite output rather than a re-bundle; the
   chunk listing from step 2 is the equivalent signal for this setup.)
4. If the growth is real, deliberate, and justified (not an accidental eager import) — update
   the relevant `limit` in `.size-limit.js` in the same PR, with a comment explaining the new
   baseline, the same way the numbers above are documented; don't raise the limit silently.

**Deliberately out of scope** (per the issue this shipped under): no `React.memo()`/
`useMemo()` mandates, render-count limits, or other speculative runtime micro-optimization
enforcement. This budget only measures what's **measurable and objective** — shipped
bundle size and code-splitting — the same bar the rest of this gate holds every other check to.

External React/Next.js performance guidance evaluated — see
`docs/vercel-react-best-practices-classification.md`. Enforced items are already reflected in
`eslint.config.js`/`doctor.config.ts`/`.size-limit.js` above; that file exists for
reasoning-traceability, not as a second rulebook.

---

## Package Manager & Supply Chain

pnpm only — `pnpm-lock.yaml` is canonical, `package.json`'s `packageManager` field pins the
exact version, CI installs with `pnpm install --frozen-lockfile`. This section is the current
policy only; see `pnpm-workspace.yaml`'s own comments for the per-setting reasoning.

- **`minimumReleaseAge: 4320`** (`pnpm-workspace.yaml`) — a package version must be published
  ≥ 3 days before pnpm will install it, on every install (including CI's frozen-lockfile
  runs — pnpm re-verifies each locked entry's registry publish time unless `trustLockfile` is
  set, which this repo never sets). Delays adoption of a version that turns out to be
  compromised long enough for the ecosystem to catch and pull it first. 3 days, not pnpm 11's
  own 1-day default: more margin, still short enough that Dependabot's grouped weekly PRs
  aren't routinely blocked by it.
- **`allowBuilds`** (`pnpm-workspace.yaml`) — only dependencies verified to genuinely need
  their install/postinstall script may run it (`msw`: regenerates
  `public/mockServiceWorker.js` from this repo's own config, local file copy only;
  `puppeteer`: explicitly **denied** — an optional transitive dep of `impeccable` that this
  repo's actual `check:style` invocation never exercises, see the file's own comment for how
  that was confirmed). Everything else's build scripts stay blocked by pnpm's own default
  (`strictDepBuilds`) — a new dependency that starts shipping a script fails the install until
  reviewed and added here, never runs silently.
- **`.github/dependabot.yml`** — weekly, both the `npm` ecosystem (pnpm's lockfile format) and
  `github-actions`. Minor/patch bumps are grouped into one PR each (less noise); major bumps
  are deliberately left ungrouped, one PR per breaking change, for individual review.
- **GitHub Actions are SHA-pinned**, not tag-pinned (`# vX.Y.Z` comment alongside each for
  readability) — a tag like `@v4` can be force-moved to point at different, potentially
  malicious code; a commit SHA can't. Applies to every third-party action in
  `.github/workflows/*.yml`.

Every bare command a person or an agent runs to _investigate_ something (`pnpm lint`,
`pnpm format`, `pnpm verify`, any `pnpm check:*`, `pnpm ai:check`) only reports — it never
writes to disk. Mutation is always a separate, explicitly-named command: `pnpm lint:fix`,
`pnpm format:fix`, `pnpm ai:sync`. A fresh `pnpm install` follows the same rule — `prepare`
only runs `husky` (git-hook setup), so installing dependencies never rewrites a tracked file
either. The one deliberate exception is `lint-staged`, wired into the pre-commit hook: it
auto-fixes **staged** files on commit, same as always — that mutation is intended, scoped to
files you're about to commit anyway, and is not what this section is about.

Rule of thumb: if a command's name doesn't end in `:fix` and isn't `ai:sync`, it's safe to run
blind — on someone else's branch, in CI, from a script — without checking `git diff` first.

## Agent Execution Safety

Binds every autonomous coding agent working in this repo — Claude Code, Cursor, or any future
tool — including this ongoing execution plan from this point forward. A scannable reference,
not a discussion; see § Checks vs Fixes above for the command-mutation half of this contract.

- **Inspect before edit.** Read a file's current content, and relevant repo state (related
  config, tests), before changing it — never edit from assumption.
- **Preserve unrelated changes.** Uncommitted working-tree changes unrelated to the current
  task are not yours to touch, discard, or overwrite.
- **No unrelated file edits.** Touch only files inside the task's scope. Notice something else
  worth fixing while you're in there? Flag it as a follow-up — don't fold it into this diff.
- **Smallest-change preference.** Ship the smallest diff that actually satisfies the task. A
  broader refactor needs a genuine, stated reason — "while I'm here" is not one.
- **Git mutation boundaries.** Never run, without an explicit human instruction for that
  specific action: `git reset`, `git push --force`/`--force-with-lease`, `git commit --amend`,
  `git rebase`, deleting a branch, or `git checkout -- <file>`/`git restore` (discarding
  changes) — or any other destructive git operation. "Explicitly requested" means a direct
  instruction for that exact action, not something implied by "the task is done."
- **No auto-commit/push.** Never `git commit` or `git push` on your own initiative — finishing
  the task is not authorization. Commit/push only on a direct instruction ("commit this",
  "push it").
- **Bounded retry.** Stop after **3** materially-equivalent failed attempts at the same
  operation (same test fix, same build error) and report the blocker — don't try a 4th time.
  "Materially equivalent failure" means the same root cause, even if the surface symptom
  changes each attempt (a timeout, then a type error, then an assertion failure, all traced to
  the same broken assumption, count as one repeated failure, not three distinct ones).
- **Verify before completion.** Run the relevant targeted `check:*` while working, then run the
  full `pnpm run verify` before claiming the task is done — a passing targeted check alone is
  not completion.
- **Final diff inspection.** Before reporting completion, review `git status`/`git diff` and
  confirm only the intended files changed — no accidental or unexpected modification.
- **Escalate, don't weaken.** If the requested behavior conflicts with an enforced constraint
  (a test, a lint rule, type safety, a security control), stop and ask how to proceed — never
  weaken, disable, or bypass the constraint to make the conflict go away.

## Never Do (in the boilerplate or any project built on it)

- `as any`, `!` non-null assertions, `@ts-ignore` / `@ts-expect-error`.
- `// eslint-disable` of any kind — fix the code, not the check.
- `console.log` in production code (wrap dev-only logging behind `import.meta.env.DEV`).
- Barrel `index.ts` re-exports for **components** (types may be barrel-exported).
- Array index as React `key`.
- Hardcoded user-facing strings, arbitrary Tailwind values, or inline styles.
- shadcn's default `--primary`/`--secondary`/etc. CSS variable palette — every Radix/CVA
  component still maps onto our own `@theme` tokens in `src/index.css`.
- Reading `import.meta.env.VITE_X` directly outside `src/constants/env.ts` — add the var to
  the Zod schema there instead of reaching around validation.
- Raw `useEffect` data fetching (use TanStack Query).
- `git commit --no-verify` on a developer's behalf.
- Editing `pre-commit.mjs`, ESLint config, or anything under `.claude/`/`.cursor/`
  for a single project's convenience. If a rule is wrong for **every** project, that is a
  boilerplate-repo PR — not a project-repo workaround.

---

## AI Tooling in This Repo

- Rules are defined **only here** — `docs/GUIDE.md` explains them at greater length, never
  redefines them.
- Commands: author once in `.claude/commands/*.md`; `pnpm ai:sync` mirrors them to
  `.cursor/commands/` (frontmatter stripped) — `pnpm ai:check` (part of `verify`) fails CI if
  a source file changed without a re-sync. Set: `/fix-commit`, `/fe-api-guide`,
  `/new-component`, `/new-feature`, `/new-page`, `/a11y-audit`, `/perf-audit`, `/code-review`,
  `/theme-setup`, `/debug`, `/prototype`, `/project-identity`.
- Skills live once in `.claude/skills/` (Cursor loads this folder too). Set: `fe-fix-commit`,
  `fe-api-guide`, `fe-component-scaffold`, `fe-page-scaffold`, `fe-a11y-audit`, `fe-prototype`,
  `fe-debug`, `fe-theme-setup`, `fe-project-identity`. Every skill has a matching
  `.claude/commands/*.md` entry point so Cursor (which has no skill auto-discovery of its own)
  can still reach it explicitly — `code-review` and `perf-audit` are the two commands with no
  backing skill file, self-contained instead. `fe-page-scaffold` is the one skill that invokes
  another skill itself (`fe-component-scaffold`, once per decomposed piece) rather than being
  invoked standalone for a whole build — see its own file for why (`AGENTS.md` doesn't
  duplicate the reasoning here, per this file's own "point at the source, don't copy" rule).
- When blocked by the gate, run `/fix-commit` — it fixes the code, never disables checks.
