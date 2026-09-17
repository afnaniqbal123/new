# Geeks FE Boilerplate

A company-wide, **domain-agnostic**, production-grade React + Vite boilerplate. Clone it, run
one command, and start any project (dashboard, marketing site, internal tool, portal, admin
panel) inside a consistent, pre-guarded architecture — with quality enforced by tooling, not
by discipline.

## Quick start

```bash
pnpm install   # installs deps + sets up Husky hooks (never rewrites tracked files)
pnpm dev       # http://localhost:5173 — runs with MSW-mocked data, no backend needed
pnpm verify    # full quality gate; run before every commit
```

New here? Read **[`docs/GUIDE.md`](./docs/GUIDE.md)** — the complete A–Z guide (what this is, how
to use it, the tools, and how to extend it), written for interns and seniors alike. For the fast
day-one version see **[`docs/onboarding.md`](./docs/onboarding.md)**. The authoritative rules are
in **[`AGENTS.md`](./AGENTS.md)**.

## Tech stack

Vite · TypeScript (strict) · React 18+ (function components only) · React Router v7 (data
router) · Tailwind CSS v4 (`@theme` tokens) · Zustand · TanStack Query v5 · React Hook Form +
Zod · Axios · i18next (JSON-driven, mandatory for all text) · MSW (browser worker in dev,
Node server in tests) · Vitest + React Testing Library · ESLint (flat) + Prettier · Husky +
lint-staged + commitlint. See `AGENTS.md` § Testing for what to test and what to avoid.

## Project layout

```
src/components/{common,auth,example,layouts,<role>}   src/pages/{common,auth,<role>}
src/hooks/<concern>/   src/services/<concern>/   src/types/<concern>/   (concern = common/
  auth/ or a role name — api-client.ts/queryClient.ts stay at services/ root, see AGENTS.md)
utils/ stores/ schemas/ constants/ routes/ mocks/ i18n/
scripts/hooks/pre-commit.mjs   scripts/sync-ai-config.mjs
AGENTS.md  CLAUDE.md  .cursor/{rules,commands}  .claude/{commands,skills}
docs/{GUIDE.md,onboarding.md}  .github/workflows/
```

See `AGENTS.md` § Directory Map for what belongs where.

## The quality gate (blocks the commit)

`pnpm verify` is the single canonical check — 16 checks (guard rails, static-analysis contract,
AI-command sync, lint-config-contract, a hardening-features contract, i18n-key parity, types,
tests, lint, a11y, format, style, React Doctor, build, a bundle-size budget, and a Playwright
browser smoke-gate), each its own `check:*`/`ai:check`/
`static-analysis:contract` script, always full-repo and non-mutating. CI runs a handful of the
cheaper checks as their own named steps first (for a readable status line), then runs the full
`pnpm verify` — the canonical rule set still lives in one place, not hand-duplicated into the
workflow. `scripts/hooks/pre-commit.mjs` runs most of these on every commit, scoped to
just the staged files for speed — same rule set, not a different one (a couple, like the build
and the test suites, are whole-repo concerns a staged scan can't meaningfully speed up). See
`AGENTS.md` § The Quality Gate for the full breakdown, and § Checks vs Fixes for which
commands are safe to run blind.

`--no-verify` is an emergency escape hatch only — **it still fails CI.**

## Scripts

| Script                           | Does                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `preview` | Vite dev / prod build / preview                                                                                 |
| `pnpm verify`                    | **The** canonical gate — all 16 checks, full-repo                                                               |
| `pnpm gate`                      | Run most of the same checks scoped to staged files (pre-commit) — not `check:test`/`check:e2e`, see `AGENTS.md` |
| `pnpm check:<name>`              | Run one check standalone — see `AGENTS.md` for the list of 16                                                   |
| `pnpm test` / `test:run`         | Vitest watch mode / single run (`test:run` is what `check:test` runs)                                           |
| `pnpm test:e2e:headed`           | Playwright, whole suite, visible browser — local visual debugging (not required by the gate)                    |
| `pnpm test:e2e:changed`          | Playwright, `--only-changed`, visible browser — advanced; only tracks `e2e/` files, not `src/`, see `AGENTS.md` |
| `pnpm test:e2e` / `check:e2e`    | Playwright, headless (what `verify`/CI run)                                                                     |
| `pnpm lint` / `format`           | Check-only, non-mutating (part of `verify`)                                                                     |
| `pnpm lint:fix` / `format:fix`   | The mutating versions — write the fixes to disk                                                                 |
| `pnpm ai:sync`                   | Regenerate `.cursor/commands/` from `.claude/commands/` (mutating)                                              |
| `pnpm ai:check`                  | Verify `.cursor/commands/` isn't stale (non-mutating; part of `verify`)                                         |
| `pnpm doctor`                    | React Doctor full scan, including the Socket.dev supply-chain check (manual/opt-in, not part of `verify`)       |

## How AI tooling works here (Cursor ⇄ Claude Code)

One source of truth: **`AGENTS.md`**. Cursor reads it natively; `CLAUDE.md` imports it;
`.cursor/rules/*.mdc` only add glob-scoped pointers. Slash commands are authored once in
`.claude/commands/` and mirrored to `.cursor/commands/` by `pnpm ai:sync` (checked by `pnpm
ai:check`, part of `verify`, so a forgotten sync fails CI). Deeper playbooks
are Agent Skills in `.claude/skills/` (Cursor reads that folder too). Ask either tool "what are
this project's component conventions?" and you get the same answer, because both read `AGENTS.md`.

## Domain-agnostic by design

Nothing assumes what the app does. The only example feature is
`src/components/example/ExampleWidget.tsx` — **copy its folder, rename it, gut the logic** to
start a real feature. See `docs/onboarding.md` for the day-one workflow.
