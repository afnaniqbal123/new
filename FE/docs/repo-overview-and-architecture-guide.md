# Repo Overview & Architecture Guide — Geeks FE Boilerplate

A complete introduction to this repository — for a new developer, a stakeholder evaluating
it, or an AI coding agent about to work in it for the first time.

---

## 1. What Is This Repo?

**Geeks FE Boilerplate** is a company-wide, domain-agnostic starting point for every new
React frontend project. It's a full React + Vite + TypeScript application shell — not just
a config template — pre-wired with routing, auth, role-based access, state management, forms,
i18n, and a mock backend, so a new project boots into a working, professional app on day one
instead of starting from an empty folder.

What makes it different from a typical starter isn't the stack (solid, but unremarkable) —
it's that **code quality is enforced by tooling, not by discipline or code review alone**. A
16-step automated gate (`pnpm verify`) checks types, accessibility, security guardrails,
React anti-patterns, bundle size, and more on every commit and in CI, so a team (or an AI
agent) can move fast without quietly accumulating debt. The repo is also explicitly
**domain-agnostic** — it never invents a real business feature; the only "features" that ship
are a generic example list/search widget and a real auth flow, both meant purely to be copied
and adapted, never extended in place.

---

## 2. Tech Stack at a Glance

| Concern                | Choice                                                                |
| ---------------------- | --------------------------------------------------------------------- |
| Build tool             | Vite (SPA, not SSR)                                                   |
| Language               | TypeScript, strict mode                                               |
| UI framework           | React 18+, function components + hooks only                           |
| UI primitives          | Radix UI + `class-variance-authority` (the shadcn/ui pattern)         |
| Routing                | React Router v7, data router (`createBrowserRouter`)                  |
| Styling                | Tailwind CSS v4, CSS-first `@theme` design tokens                     |
| Client state           | Zustand (feature-scoped stores)                                       |
| Server state           | TanStack Query v5                                                     |
| Forms                  | React Hook Form + Zod v4                                              |
| HTTP client            | Axios, with auth-token + refresh-and-retry interceptors               |
| Env validation         | Zod-validated `import.meta.env` (fails loudly on misconfiguration)    |
| API mocking            | MSW — browser worker in dev, Node server in tests                     |
| Unit/integration tests | Vitest + React Testing Library (workflow-level, not primitive-level)  |
| Browser smoke tests    | Playwright, Chromium only                                             |
| Lint/format            | ESLint (flat config, `strictTypeChecked`) + Prettier                  |
| Git hooks              | Husky + lint-staged + commitlint (Conventional Commits)               |
| Package manager        | pnpm only, with supply-chain hardening (see § 4)                      |
| Charting               | recharts, driven entirely by `@theme` CSS custom properties           |
| AI tooling             | Claude Code skills + slash commands, mirrored to Cursor automatically |

---

## 3. Folder Structure

```
src/
  components/
    common/       Reusable, domain-agnostic UI: Button, Input, Dialog, ConfirmDialog,
                  DropdownMenu, Toaster, ThemeToggle, DataTable, Pagination, Can, etc.
    auth/         The 5 auth forms only (LoginForm, SignupForm, OtpForm,
                  ForgotPasswordForm, ResetPasswordForm) — pages are separate
    example/      ExampleWidget — the one reference "real feature" (generic
                  paginated/searchable list with full CRUD)
    layouts/      AppLayout, AuthLayout, ErrorLayout, RoleLayout (renders the right
                  shell for whichever role is signed in)
    <role>/       Components scoped to one role's own pages — empty until a project
                  actually needs one (same for admin/member today)

  pages/
    common/       Pages reachable by every role, or by nobody in particular
                  (ForbiddenPage, ExamplePage, Settings/Profile/Notifications)
    auth/         The 5 auth pages — thin route-level glue around components/auth/
    member/       Role.MEMBER's one placeholder dashboard page
    admin/        Role.ADMIN's one placeholder dashboard page

  hooks/<concern>/        <- see § 3a below, the most structurally important convention
    common/       Every generic/cross-role hook, plus every feature's data-fetching
                  hooks (useExampleItems + its create/update/delete siblings,
                  useDebouncedValue, useThemeSync, useSyncAuthAcrossTabs)
    auth/         useAuth.ts — every auth mutation hook in one file (useLogin,
                  useSignup, useLogout, useForgotPassword, useResetPassword,
                  useVerifyOtp, plus two supporting exports)

  services/<concern>/
    (root)        api-client.ts (Axios instance) and queryClient.ts stay here —
                  cross-cutting infrastructure, not a "concern" of their own
    auth/         authService.ts — the real, typed /auth API contract

  types/<concern>/
    common/       Cross-concern shared types (ApiResponse<T>, Paginated<T>)
    auth/         Auth-scoped types (AuthUser, AuthTokens)

  routes/         roles.ts (the Role registry) + ProtectedRoutes.tsx (every
                  protected page/role/nav entry) + PublicRoutes.tsx (guest-only
                  auth screens) + AppRouters.tsx (builds the whole router) +
                  HomeRedirectRoute.tsx / AuthRedirectRoute.tsx /
                  AuthenticatedRoute.tsx / RoleGuards.tsx (the guard components)

  stores/         Zustand stores, one per domain slice (authStore is
                  persist-backed; themeStore drives light/dark/system)
  schemas/<concern>/  Zod schemas — forms and API contracts alike, one folder per
                  concern (auth/, common/, and one per role once it has a real schema)
  constants/      One route-enum file per portal/concern (auth.ts, common.ts, and one
                  per role once it has a real endpoint), plus queryKeys.ts (the
                  global query-key enum, deliberately flat/not per-concern), config.ts, env.ts
  i18n/           i18next setup + locales/<lng>/common.json — the only source
                  of user-facing text in the whole app
  mocks/          MSW handlers.ts (shared fixtures) + browser.ts + server.ts
  test/           Vitest setup + renderWithProviders.tsx test helper
  lib/             utils.ts — the cn() class-merge helper
  utils/          Pure, 100%-unit-testable helper functions
```

### 3a. The `<concern>/` subfolder pattern (important, and recent)

`hooks/`, `services/`, `types/`, and `schemas/` are **not** flat folders — every file lives
one level deeper, under a **concern** folder:

- **`common/`** — anything generic or usable by every role/feature.
- **`auth/`** — anything scoped specifically to the auth flow.
- **a role name** (`admin/`, `member/`, or a future portal) — anything genuinely specific to
  one role's own pages. Neither exists yet for any of the four — that's expected, not a gap.
  A role's own folder is created the moment something genuinely role-specific is actually
  needed.

This mirrors the identical convention `components/<concern>/` and `pages/<concern>/` already
use. `services/` has one deliberate exception: `api-client.ts` and `queryClient.ts` stay at
the `services/` root rather than under `services/common/`, because they're cross-cutting
infrastructure every concern's service depends on — not a "concern" in their own right (the
same reasoning that keeps `lib/utils.ts` un-concern-scoped).

`constants/` follows a close variant of the same pattern, one file per concern rather than
one folder per concern (`auth.ts`, `common.ts`, and one such file per role the moment it
has a real endpoint, each holding that portal's own API-route enum) — `queryKeys.ts`,
`config.ts`, and `env.ts` are the deliberate exceptions
that stay flat/concern-agnostic (a query key is deliberately a single global registry, not
grouped by portal — see that file's own comment; `config.ts`/`env.ts` are cross-cutting
infra, same reasoning as `services/api-client.ts`).

**The rule for a new hook/service/type/schema/route:** figure out which concern it belongs
to using the exact same logic as `components/<concern>/` — is it generic/cross-role, or
specific to one flow/role? — then create (or reuse) that concern's folder/file. Never leave
a new file flat at the old top level, and never group by feature instead of by concern (one
`MemberRoutes` enum for every member-portal feature, not a new enum per feature).

---

## 4. The Quality Gate

`pnpm verify` is **the** definition of "ready to merge." It chains **16 checks**, each its
own non-mutating script, always run full-repo:

| #   | Check                      | What it protects against                                                                             |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `check:guardrails`         | Secrets, merge-conflict markers, oversized files                                                     |
| 2   | `static-analysis:contract` | The required ESLint rules / TS compiler options haven't silently regressed                           |
| 3   | `ai:check`                 | Cursor's command mirror drifting from the Claude Code source                                         |
| 4   | `check:lint-contract`      | Specific lint rule severities / tsconfig options being quietly downgraded                            |
| 5   | `check:hardening`          | Config/doc drift behind the Playwright gate, Agent Execution Safety, and pnpm supply-chain hardening |
| 6   | `check:i18n`               | An orphaned translation key, or a locale silently missing one `en` has                               |
| 7   | `check:types`              | Real TypeScript errors (`tsc -b --noEmit`, strict)                                                   |
| 8   | `check:test`               | A broken user-facing workflow (Vitest + React Testing Library)                                       |
| 9   | `check:lint`               | Hook-dependency bugs, bad `key`s, hardcoded text, arbitrary style values                             |
| 10  | `check:a11y`               | WCAG 2.1 AA violations (strict `jsx-a11y`)                                                           |
| 11  | `check:format`             | Inconsistent formatting (Prettier)                                                                   |
| 12  | `check:style`              | Markup/CSS style-consistency drift (Impeccable)                                                      |
| 13  | `check:doctor`             | React anti-patterns (stale closures, missing memoization, etc. — React Doctor)                       |
| 14  | `check:build`              | The production build actually succeeds                                                               |
| 15  | `check:build-budget`       | The shipped JS bundle silently growing past budget                                                   |
| 16  | `check:e2e`                | The app failing to actually boot/render in a real browser (Playwright)                               |

**Two layers, same rule set, different scope:**

- **On every commit** (fast): a Husky pre-commit hook first runs `lint-staged` (an auto-fix
  pass — ESLint `--fix` + Prettier `--write` on your staged files), then runs a 6-stage
  subset of the checks above, scoped to just those **staged files**, so it stays quick.
- **On demand / in CI** (exhaustive): `pnpm verify` runs the **full 16**, full-repo — this is
  what GitHub Actions runs on every push/PR, and what a human or agent should run before
  calling any task done.

A passing `pnpm verify` locally is the same bar CI enforces — there's no way to pass one and
fail the other. `--no-verify` is an emergency escape hatch only; it still fails CI.

---

## 5. Skills (`.claude/skills/`)

Nine Claude Code skills encode this repo's deeper playbooks — Cursor reads the same folder,
so both tools give the same answer. Each has a matching slash command as its entry point.

| Skill                   | What it does                                                                                                                                                      | When to reach for it                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `fe-project-identity`   | Renames the boilerplate's display identity (title, package name, app name, portal names) throughout the repo                                                      | Once, at the very start of a new real project                                            |
| `fe-theme-setup`        | Edits the single `@theme` token block in `src/index.css` to match a real brand (colors, radius, spacing, type)                                                    | Once, early — before building real UI                                                    |
| `fe-component-scaffold` | Pins down a new component/feature's identity first, then scaffolds it (typed props, README for features) matching the `ExampleWidget` shape                       | Building one component or one self-contained feature                                     |
| `fe-page-scaffold`      | Decomposes a full-page design into reusable pieces, existing-component extensions, and page-specific pieces, then delegates each piece to `fe-component-scaffold` | A design reference shows a whole page with multiple regions, not one piece               |
| `fe-api-guide`          | Generates API docs, `api-routes` constants, and Zod schemas from a real OpenAPI/spec file — never invents an endpoint                                             | Integrating a real backend                                                               |
| `fe-a11y-audit`         | Runs the strict a11y lint pass, then reports WCAG violations in plain language with concrete fixes                                                                | Auditing a component or route for accessibility                                          |
| `fe-debug`              | A phased diagnosis loop for a runtime bug (bad render, stale state, a refetch loop)                                                                               | Something is broken and the cause isn't obvious yet                                      |
| `fe-fix-commit`         | Diagnoses and fixes a blocked quality-gate commit — always fixes the code, never disables a check                                                                 | A commit or `pnpm verify` run is failing                                                 |
| `fe-prototype`          | Builds a throwaway, unmerged prototype under a scratch route to answer one UI/state question, then gets deleted                                                   | The shape of something isn't decided yet and needs to be seen before it's built for real |

---

## 6. Key Architectural Decisions Worth Knowing Up Front

**Workflow tests, not primitive unit tests — three distinct test layers.** This repo
deliberately does not unit-test `Button`/`Input`/`Dialog` in isolation — they're
battle-tested Radix/shadcn-pattern components. Instead:

- **Workflow tests** (`*.workflow.test.tsx`, co-located with the feature) exercise a real
  user-facing flow (load → interact → success/error) through the real components and real
  MSW-backed network layer — `ExampleWidget.workflow.test.tsx` is the reference shape. A
  primitive gets its coverage transitively, through every workflow that touches it.
- **Service/hook tests** (`*.test.ts`, co-located next to the file) standalone-test reusable
  logic multiple features depend on — `authService.test.ts`, `useDebouncedValue.test.ts`.
- **Utility tests** (`*.test.ts`, co-located next to the file) standalone-test every pure
  function in `src/utils/` — `getPageCount.test.ts` is the reference shape.

See `AGENTS.md` § Testing for the full reasoning behind each layer and what to avoid.

**Auth-aware root routing.** `"/"` is never real content — it's
`src/routes/HomeRedirectRoute.tsx`, which always redirects. `/login` (and every other guest-only
auth screen) is auth-aware too, via `AuthRedirectRoute`:

| State                           | Visits `"/"`                                                                       | Visits `"/login"`                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Signed in                       | → straight to their role's home route (`HomeRedirectRoute`)                        | → bounced to their role's home route via `AuthRedirectRoute` — never sees the login form again |
| Signed out                      | → `/login`                                                                         | → shows the login form normally                                                                |
| Signed out, any protected route | → `/login` (via `AuthenticatedRoute`, which wraps the whole protected route group) | —                                                                                              |

**Edge case:** if a signed-in role genuinely has no home route configured yet
(`hasHomeRouteForRole` is `false`), `HomeRedirectRoute` shows a clear developer-facing message
instead of silently bouncing back to `/login` — a deliberate fix for a real trap: building the
auth flow before any role/dashboard exists used to strand a freshly-signed-up user in a
redirect loop.

**Four gating mechanisms, four distinct jobs.** Don't reach for the wrong one:

| Mechanism                               | Gates                                                     | Use it for                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `AuthenticatedRoute`                    | A whole route — auth only                                 | Wraps the entire protected route group; redirects a signed-out visitor to `/login`                                                  |
| `AuthRedirectRoute`                     | A whole route — guest only                                | Wraps each public auth screen; bounces an already-signed-in visitor to their role's home route                                      |
| `RoleGuards`                            | A whole route — auth **and** a specific role/set of roles | Wraps every entry in `ProtectedRoutes.tsx` — the actual route-level authorization check                                             |
| `Can` (`src/components/common/Can.tsx`) | A fragment of an already-rendered page                    | Hide/show a piece of UI by role without gating the whole route — e.g. an admin-only button on a page every role can otherwise reach |

`Can` takes `allowedRoles` + `children` (+ an optional `fallback`) and renders `children` only
if the signed-in user's role is in the list. It's the inline complement to route-level
guarding: reach for `RoleGuards` when an entire page should be off-limits, `Can` when only a
fragment of an already-reachable page should be.

**Two reference features, meant purely to be copied.** `components/example/` +
`pages/common/ExamplePage.tsx` is the reference for a data-driven list/search screen with full
create/update/delete — copy the folder, rename it, gut the logic, and copy its hooks/service
from `hooks/common/`/`services/common/exampleService.ts` too (they don't come along
automatically). `components/auth/` + `pages/auth/` is the reference for a multi-page form
flow. Neither is meant to be extended in place.

**Closed value sets are real TypeScript `enum`s, not `as const` objects.** Roles
(`Role.MEMBER`/`Role.ADMIN`) and query keys (`QueryKey`) are flat, single global enums; API
routes are grouped one enum per **portal/concern** — `AuthRoutes` (`constants/auth.ts`),
`CommonRoutes` (`constants/common.ts`), and one such enum per additional role/concern the
moment it has a real endpoint — never one enum per feature, since a real enum can't nest.
Comparing an enum against an untyped
external string (a JWT claim, an API response) needs an explicit boundary cast; assigning a
`Role` member _into_ a plain `string` field never does.

**A role's components can never import another role's.** `components/admin/` can never
import from `components/member/` (or vice versa) — component-to-component or
page-to-component, in either direction. Only `common/` (and `auth/`/`example/`/`layouts/`) is
universal. Lint-enforced (`roleBoundaries/no-cross-role-component-import`, `error`), not just
convention:

```ts
// ❌ fails check:lint — components/member/ importing from components/admin/
import { AdminStatCard } from 'src/components/admin/AdminStatCard';

// ✅ fine — components/common/ is universal
import { Button } from 'src/components/common/Button';
```

**Every visual value is a design token, every user-facing string is an i18n key.** No
hardcoded hex color, arbitrary Tailwind value (`w-[127px]`), or literal string in JSX — both
are lint-enforced, not just conventions. Re-skinning a project means editing the `@theme`
block in `src/index.css` once, never hunting through components.

**Server state only ever goes through TanStack Query**, wrapped in a named hook under
`hooks/<concern>/` — never a raw `useEffect` fetch, never a query called directly in a
component. Failures toast automatically via the shared `queryClient`; a call that renders its
own inline error opts out with `meta: { skipErrorToast: true }`. A mutation that should
invalidate a cached query (a create/update/delete against a list already on screen) follows
one specific reference pattern — `useCreateExampleItem.ts`/`useUpdateExampleItem.ts`/
`useDeleteExampleItem.ts` in `hooks/common/`: `toast.success(...)` then `return
queryClient.invalidateQueries(...)`, both inside the hook's own `onSuccess`. This matters more
than it sounds — this exact class of bug (a mutation that succeeds but never invalidates,
leaving the UI stale) shipped 4 times in this repo's own auth forms before it was caught, which
is what prompted adding this reference pattern in the first place.

---

This guide is a tour, not the rulebook. When anything here ever conflicts with `AGENTS.md`,
`AGENTS.md` wins.
