# The Complete Guide — Geeks FE Boilerplate

> One document, A–Z. Read it once and you'll understand **what this boilerplate is, how to
> use it, why it exists, and how to extend it**. Written so an intern and a senior both get it.

---

## 1. What is this? (in one line)

A ready-made **React + Vite + TypeScript** starting point for every Geeks project, where
code quality (types, accessibility, style, React best practices) is enforced **automatically
by tools** — not by remembering rules.

You clone it, run one command, and you already have a professional, guarded project.

---

## 2. Why it exists (the benefits)

| Problem on a normal project         | How this boilerplate solves it                               |
| ----------------------------------- | ------------------------------------------------------------ |
| Every project is set up differently | One consistent structure for **all** projects                |
| Bad code slips into the repo        | A **quality gate** blocks it at commit time                  |
| "Where does this file go?"          | A fixed folder map answers every "where?"                    |
| Accessibility (a11y) is forgotten   | A strict `jsx-a11y` lint pass blocks the commit              |
| React code rots into anti-patterns  | React Doctor scans every commit for state/effect/perf issues |
| AI tools give different answers     | Cursor **and** Claude Code read the same rulebook            |
| New devs take days to onboard       | Copy one example feature and go                              |

**Bottom line:** you focus on building features; the tooling keeps quality high.

---

## 3. Before you start (prerequisites)

- **Node.js 22 or newer** (check with `node --version`).
- **pnpm** — the pinned version lives in `package.json`'s `packageManager` field; `corepack
enable` picks it up automatically (Node 22 ships Corepack).
- An editor: **VS Code**, **Cursor**, or **Claude Code** all work. AI features are a bonus, not a requirement.

---

## 4. Get started (2 minutes)

```bash
pnpm install     # installs everything + sets up the commit hooks (never rewrites tracked files)
pnpm dev         # opens the app at http://localhost:5173 (fake data via MSW, no backend needed)
```

Before committing, you can run the full check yourself:

```bash
pnpm verify   # the canonical gate — guardrails + types + tests + lint + a11y + format + style + doctor + build
```

There is **no real backend**. MSW (Mock Service Worker) answers all API calls in dev and tests,
so everything runs out of the box.

---

## 5. How it works (the everyday flow)

```
   write code  ──►  git commit  ──►  Quality Gate runs (mostly staged-scoped)
                                        │
                          ┌─────────────┴─────────────┐
                          ▼                           ▼
                    ✅ all pass                  ❌ something fails
                     commit saved            commit blocked + reason shown
                          │                           │
                     git push                  fix code, commit again
                          │
                          ▼
                 GitHub CI runs `pnpm verify` — all 16 checks, full-repo
```

`pnpm verify` is the single canonical definition of the gate — 16 checks, each its own
`check:*`/`ai:check`/`static-analysis:contract` script in `package.json` (see § 7). Every
entry point runs the exact same rule set:

- **Locally, on demand:** `pnpm verify` runs all 11, full-repo.
- **Locally, on commit:** the Husky hook (`scripts/hooks/pre-commit.mjs`) runs most of them,
  scoped to just your staged files, for speed — a couple (like the build) are whole-repo
  concerns a staged scan can't meaningfully speed up, so they're `verify`/CI-only.
- **On GitHub (CI):** `.github/workflows/quality-gate.yml` does nothing but `pnpm verify`.

If a commit is blocked, read the message, fix the **code** (never disable the check), and
commit again.

---

## 6. Folder structure (where everything goes)

```
src/
  components/
    common/       Reusable UI (Button, Input, Dialog, Toaster, ThemeToggle, DataTable,
                  SearchInput, Can, …) — Radix + CVA, no business logic
    auth/         Auth forms only (LoginForm, SignupForm, OtpForm, ForgotPasswordForm,
                  ResetPasswordForm) — pages live in pages/auth/, see that folder's README
    example/      ExampleWidget — the one example feature (list/search)
    <role>/       Components scoped to one role's own pages (none ship by default)
    layouts/      Page shells (AppLayout, AuthLayout, ErrorLayout, RoleLayout — renders the
                  right shell for whichever role is signed in, driven by
                  routes/ProtectedRoutes.tsx)
  pages/
    common/       Pages reachable by every role (ForbiddenPage, ExamplePage, and
                  the common routes every role's sidebar links to: Settings/Profile/
                  Notifications — `roles: 'all'` in routes/ProtectedRoutes.tsx). "/" itself
                  is routes/HomeRedirectRoute.tsx, an auth-aware redirect, not a page here.
    auth/         The 5 Auth pages (route-level glue only)
    <role>/       Pages owned by one role — mirrors components/<role>/. Ships with two
                  placeholders: member/ (Role.MEMBER) and admin/ (Role.ADMIN)
  hooks/<concern>/ Every hook — src/hooks/<concern>/<hookName>.ts. common/ for generic or
                  cross-role hooks (useDebouncedValue, useThemeSync, useSyncAuthAcrossTabs,
                  and every feature-data hook, e.g. useExampleItems — never co-located in
                  the feature folder), auth/ (useAuth.ts — every auth mutation hook: useLogin,
                  useSignup, useLogout, useForgotPassword, useResetPassword, useVerifyOtp,
                  plus two supporting exports for the forgot-password OTP flow), or a role
                  name for one specific to that role's own pages
  lib/            utils.ts — the cn() class-merge helper used by every common component
  services/<concern>/ api-client.ts and queryClient.ts stay at services/ root (cross-cutting
                  infrastructure, not a "concern"); every other file is one API client per
                  concern (auth/authService.ts, common/exampleService.ts, and one such file
                  per role/concern once it has a real endpoint) — a hook's
                  queryFn/mutationFn always calls into one of these, never apiClient directly
  utils/          Pure helper functions (easy to unit-test)
  schemas/<concern>/ Zod schemas (form + API validation), one folder per concern — same
                  <concern> convention as everywhere else (auth/, common/ — including
                  common.schema.ts's shared primitives — and a role's own folder once it
                  has a real schema)
  types/<concern>/ Shared TypeScript interfaces — common/ for cross-concern types
                  (ApiResponse, Paginated), auth/ for auth-scoped types (AuthUser,
                  AuthTokens)
  constants/      One route-enum file per portal/concern (auth.ts, common.ts, and one
                  per additional role/concern once it has a real endpoint) — never one
                  flat api-routes.ts or one enum per feature; plus queryKeys.ts
                  (global, not per-concern), config.ts, env.ts
  i18n/           i18next setup + locales/<lng>/common.json — the only source of text
  routes/         roles.ts (the Role registry) + ProtectedRoutes.tsx (every protected page,
                  its roles, its sidebar nav entry, plus getNavItemsForRole/
                  getHomeRouteForRole/getRoleLayout) + PublicRoutes.tsx (the guest-only auth
                  screens) + AppRouters.tsx (createBrowserRouter — generates every route
                  from those two files) + AuthRedirectRoute.tsx + AuthenticatedRoute.tsx +
                  RoleGuards.tsx (the per-route auth + role gate)
  stores/         Zustand stores (UI/client state); authStore is persist-backed (holds
                  accessToken/refreshToken/user/hasHydrated)
  mocks/          MSW handlers.ts (shared fixtures) + browser.ts (dev worker) + server.ts
                  (Node server, Vitest only — see § 7)
  test/           setup.ts (Vitest setup) + renderWithProviders.tsx (test render helper)

e2e/                            Playwright smoke-gate: smoke.spec.ts + fixtures.ts — see § 7
playwright.config.ts            Chromium-only, runs against pnpm build:e2e → vite preview
components.json                shadcn CLI config — `pnpm dlx shadcn add <component>` to pull more
scripts/hooks/pre-commit.mjs   The 6-stage quality gate
scripts/sync-ai-config.mjs     Mirrors Claude commands → Cursor commands
AGENTS.md                      THE rulebook (single source of truth)
CLAUDE.md                      Imports AGENTS.md for Claude Code
.cursor/{rules,commands}       Cursor's AI config
.claude/{commands,skills}      Claude's AI config
docs/                          This guide, onboarding, deep-dive docs
.github/workflows/             CI (runs the gate on GitHub)
```

**Quick answers to "where does X go?"**

| I want to add…                                                                 | Put it in…                                                                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A reusable button/input                                                        | `src/components/common/`                                                                                                                   |
| A whole screen/feature                                                         | Copy `src/components/example/` + `pages/common/ExamplePage.tsx`, rename, gut it                                                            |
| Data fetching                                                                  | A TanStack Query hook under `src/hooks/<concern>/` (never a raw `useEffect` fetch, never co-located in the feature folder)                 |
| Filters, page, tab, search text, a small dialog's open state                   | A URL query param via `nuqs` (`src/lib/url-state/`) — see AGENTS.md's "URL-addressable page state" bullet and `docs/adr/url-page-state.md` |
| UI-only state that shouldn't be a shareable link (hover, focus, unsaved input) | A Zustand store or `useState`                                                                                                              |
| A form                                                                         | React Hook Form + a Zod schema in `src/schemas/<concern>/`                                                                                 |
| User-facing text                                                               | A key in `src/i18n/locales/<lng>/common.json`, via `t()` — one file per language only                                                      |
| An API path                                                                    | A member on that portal's route enum in `src/constants/<concern>.ts` (no version/host prefix)                                              |
| A pure helper                                                                  | `src/utils/`                                                                                                                               |

---

## 7. The Quality Gate — `pnpm verify` (16 checks)

`pnpm verify` chains these 16 checks, each its own non-mutating `check:*`/`ai:check`/
`static-analysis:contract` script. Any failure blocks a merge — and, run staged-file-scoped
via the commit hook, blocks a commit (except `check:test`/`check:e2e` — see the note below):

1. `check:guardrails` — secrets, merge markers, `eslint-disable`, oversized files (console.log/
   `as any`/TS-suppression comments moved to ESLint — see that script's own comment for why).
2. `static-analysis:contract` — asserts required ESLint rules/TS options haven't regressed
   (overlaps with `check:lint-contract` below — a known duplication, not by design).
3. `ai:check` — asserts `.cursor/commands/` hasn't drifted from `.claude/commands/` (the source
   of truth — see § 11). Non-mutating; `ai:sync` is the command that actually fixes drift.
4. `check:lint-contract` — asserts the strict ESLint rules and `tsconfig` options below haven't
   silently regressed.
5. `check:hardening` — asserts the config/doc details behind three previously-shipped hardening
   features (Playwright, Agent Execution Safety, pnpm supply-chain) haven't silently drifted.
6. `check:i18n` — orphaned-key + cross-locale-parity check over every `src/i18n/locales/<lng>/
common.json` that exists (see `AGENTS.md` § The Quality Gate for exactly what each half
   catches).
7. `check:types` — TypeScript strict check (`tsc -b --noEmit`).
8. `check:test` — `vitest run` (Vitest + React Testing Library). Runs right after types, before
   the lint/format/style stages — a broken component matters more than a lint nit, and it
   should block the expensive `check:build` step from even starting.
9. `check:lint` — ESLint, on `tseslint.configs.strictTypeChecked` (React hooks rules, keys, no
   hardcoded text, design tokens only).
10. `check:a11y` — strict `jsx-a11y` rules (WCAG 2.1 AA).
11. `check:format` — Prettier, check-only.
12. `check:style` — `impeccable detect`.
13. `check:doctor` — `react-doctor` (the Socket.dev supply-chain scan is skipped here for speed;
    run `pnpm doctor` for the full scan).
14. `check:build` — the production build succeeds.
15. `check:build-budget` — `size-limit` against the real `dist/assets/` output (see `AGENTS.md`
    § Performance Budget for the numbers and how to diagnose a failure). Right after
    `check:build` since it needs that build's output; a separate, blocking gate from Vite's own
    advisory `chunkSizeWarningLimit`.
16. `check:e2e` — `playwright test`, Chromium-only smoke-gate against the real production build
    (`pnpm build:e2e` → `vite preview`). Last on purpose — needs a build to serve, and it's the
    single most expensive check, so every cheaper one fails fast first.

`check:test`/`check:e2e` aren't in the staged-files commit hook (`pnpm gate`) — like
`ai:check`, `check:lint-contract`, and `check:build`, they run full-repo as part of
`pnpm verify`/CI instead (see AGENTS.md § The Quality Gate). See `AGENTS.md` § Testing for
what to test at which layer, what to avoid, and the `pnpm test`/`pnpm test:run`/
`pnpm test:e2e` commands.

Run the full thing anytime: `pnpm verify`. Run the staged-files-only version the commit
hook uses: `pnpm gate`.

---

## 8. Everyday commands

| Command                      | What it does                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                   | Start the dev server                                                                                                                                           |
| `pnpm build` / `preview`     | Production build / preview it                                                                                                                                  |
| `pnpm verify`                | **The** canonical gate — all 16 checks, full-repo (see § 7)                                                                                                    |
| `pnpm gate`                  | Most of the same checks, scoped to staged files (what commit runs) — not `check:test`/`check:e2e`, see § 7                                                     |
| `pnpm check:<name>`          | Run one check standalone (`guardrails`/`lint-contract`/`hardening`/`i18n`/`types`/`test`/`lint`/`a11y`/`format`/`style`/`doctor`/`build`/`build-budget`/`e2e`) |
| `pnpm test`                  | Vitest in watch mode, for local dev (not part of `verify` — `check:test` is)                                                                                   |
| `pnpm test:run`              | Vitest, single run (same as `check:test`; part of `verify`)                                                                                                    |
| `pnpm test:e2e`              | Playwright, Chromium-only smoke-gate (same as `check:e2e`; part of `verify`)                                                                                   |
| `pnpm build:e2e`             | Builds the app with `VITE_E2E=true` to `dist-e2e/` — what `test:e2e` serves via `vite preview`                                                                 |
| `pnpm lint` / `format`       | Check-only, non-mutating (same as `check:lint`/`check:format`; part of `verify`)                                                                               |
| `pnpm lint:fix`/`format:fix` | The mutating versions — actually write the fixes to disk                                                                                                       |
| `pnpm doctor`                | React Doctor full scan, incl. the Socket.dev supply-chain check (manual, not part of `verify`)                                                                 |
| `pnpm ai:sync`               | Rebuild `.cursor/commands` from `.claude/commands` (mutating)                                                                                                  |
| `pnpm ai:check`              | Verify `.cursor/commands` isn't stale (non-mutating; part of `verify`)                                                                                         |

---

## 9. How to build a new feature (the golden workflow)

**Don't start from scratch — copy the example.**

1. Copy `src/components/example/` to a new folder, e.g. `src/components/UserProfile/`, and
   copy `src/pages/common/ExamplePage.tsx` for the matching thin route wrapper. Also copy
   its hooks and service — `src/hooks/common/useExampleItems.ts` (+ its three mutation-hook
   siblings) and `src/services/common/exampleService.ts` — into `src/hooks/<concern>/` and
   `src/services/<concern>/` for your new feature (hooks and services live under
   `src/hooks/`/`src/services/`, not the component folder, so neither comes along
   automatically with step 1's copy), and its schema into `src/schemas/<concern>/`.
2. Rename files and the component, then replace the logic with yours.
3. It already wires up: typed props, a TanStack Query hook backed by a service file, a
   Zustand store, a form with Zod validation, and full accessibility. No per-feature
   `README.md` is part of this shape — AGENTS.md/this guide is the reference, not a
   per-folder writeup.

For a single reusable component instead, ask your AI tool for `/new-component`, or copy
`src/components/common/Button.tsx` as a template.

---

## 10. The tools (what each one is for)

| Tool                         | Job in this project                                         |
| ---------------------------- | ----------------------------------------------------------- |
| **Vite**                     | Fast dev server + production builder                        |
| **TypeScript (strict)**      | Type safety — catches bugs before runtime                   |
| **React 18+**                | UI, function components + hooks only                        |
| **Radix UI + CVA**           | Accessible UI primitives + variant styling (shadcn pattern) |
| **React Router v7**          | Routing (data router)                                       |
| **Tailwind CSS v4**          | Styling via design tokens in `src/index.css`                |
| **Zustand**                  | Client / UI state                                           |
| **TanStack Query v5**        | Server state / data fetching + caching                      |
| **React Hook Form + Zod**    | Forms + validation (shared types)                           |
| **Axios**                    | HTTP client with auth + error handling                      |
| **i18next**                  | All user-facing text — JSON-driven, mandatory (not opt-in)  |
| **MSW**                      | Fake API — browser worker in dev, Node server in tests      |
| **Vitest + Testing Library** | Component/behavior tests — see AGENTS.md § Testing          |
| **ESLint + Prettier**        | Code rules + auto-formatting                                |
| **Husky + lint-staged**      | Runs the gate automatically on commit                       |
| **commitlint**               | Enforces Conventional Commit messages                       |
| **React Doctor**             | Scans React code for state/effect/perf/security/a11y issues |
| **Impeccable**               | Scans for UI anti-patterns & design-quality issues          |

---

## 11. AI tooling — same answers in Cursor & Claude Code

- **`AGENTS.md`** is the single rulebook. Cursor reads it natively; `CLAUDE.md` just imports it.
- **Slash commands** are written once in `.claude/commands/` and mirrored to `.cursor/commands/`
  by `pnpm ai:sync` — `pnpm ai:check` (part of `verify`) fails CI if you forget to run it.
  Available: `/fix-commit`, `/new-component`, `/new-feature`,
  `/fe-api-guide`, `/a11y-audit`, `/perf-audit`, `/code-review`, `/theme-setup`, `/debug`,
  `/prototype`.
- **Skills** (deeper playbooks) live in `.claude/skills/`. Cursor has no native skill
  auto-discovery, so every skill also gets a `.claude/commands/*.md` entry point that names
  it explicitly — that's how a Cursor user reaches `fe-debug`/`fe-prototype`/`fe-theme-setup`,
  which have no other trigger in Cursor.

Ask either tool "what are this project's component conventions?" → you get the **same answer**,
because both read `AGENTS.md`.

> Using plain VS Code (no AI)? Everything still works — the quality gate is just pnpm scripts.
> The AI commands are a convenience, not a requirement.

---

## 12. How to extend / update it (for the future)

Everything below is a small, safe edit. Commit it like any other change.

### Add a new AI slash command

1. Create `.claude/commands/my-command.md` (add a short YAML frontmatter + instructions).
2. Run `pnpm ai:sync` — it appears in `.cursor/commands/` automatically. Commit both files
   together; `pnpm ai:check` (part of `verify`) fails CI if the mirror is missing.

### Add a new AI skill (playbook)

1. Create a folder `.claude/skills/my-skill/` with a `SKILL.md` inside.
2. Describe when to use it and the steps. Cursor and Claude both pick it up.

### Add a new Cursor rule (glob-scoped hint)

1. Create `.cursor/rules/my-rule.mdc`.
2. Keep it a **pointer** to `AGENTS.md` — don't duplicate rules there.

### Add or change a lint rule

1. Edit `eslint.config.js`.
2. Run `pnpm check:lint` to confirm nothing unexpected breaks.

### Change the look (colors, spacing, radius, fonts)

1. Edit the `@theme` block in `src/index.css` — that's the single place for design tokens.
2. Never hardcode values in components; always reference tokens.

### Change the commit gate itself

1. Edit `scripts/hooks/pre-commit.mjs`.
2. **Rule of thumb:** only change the gate if it's wrong for **every** project — that's a
   boilerplate change, not a per-project tweak.

### Bump the Node version

1. Update `engines.node` in `package.json` **and** `node-version` in `.github/workflows/quality-gate.yml`
   (keep them in sync so local and CI match).

---

## 13. Troubleshooting (common issues)

| Symptom                                        | Cause & fix                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Commit is blocked with a stage error           | Read the message; fix the code, then commit again. Or run `/fix-commit`. |
| CI is red but local passed                     | Usually a Node version mismatch — make sure you're on Node 22+.          |
| `markAsUncloneable is not a function` in tests | Node too old. Use Node 22 or newer.                                      |
| A commit message is rejected                   | Use Conventional Commits: `feat(scope): message` (lowercase, no period). |
| I really must skip the gate                    | `--no-verify` exists but **still fails CI** — emergency only.            |

---

## 14. The golden rules (never do these)

- ❌ `as any`, `!` non-null assertions, `@ts-ignore` — fix the types instead.
- ❌ `// eslint-disable` — fix the code, not the check.
- ❌ `console.log` in production code.
- ❌ Hardcoded user-facing text, arbitrary Tailwind values (`w-[127px]`), or inline styles.
- ❌ Raw `useEffect` for data fetching — use TanStack Query.
- ❌ Editing the gate/ESLint/AI config for one project's convenience.

---

## 15. Where to go next

- **[`docs/onboarding.md`](./onboarding.md)** — the fast day-one version of this guide.
- **[`AGENTS.md`](../AGENTS.md)** — the authoritative rulebook.

That's the whole boilerplate, A–Z. Copy the example, respect the gate, and ship with confidence.
