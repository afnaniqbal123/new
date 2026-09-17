---
description: Review frontend/component code against this repo's conventions with a reviewer's mindset.
argument-hint: '[optional: files or diff range]'
allowed-tools: Read, Grep, Bash(git diff *)
---

Review the relevant code with a code-review mindset. Scope: $ARGUMENTS — default to
`git diff` (and `git diff --staged`) if nothing is named. Read each change's full
surrounding context, not just the diff hunk.

Do not make code changes unless explicitly asked.

## Source of truth

`AGENTS.md` is the only rulebook — cite the specific section a finding violates
(e.g. "§ Component Conventions", "§ Data & State"). Deterministic tools (ESLint,
strict jsx-a11y, Impeccable, React Doctor) already catch what's mechanical; this
review exists for what they structurally can't — semantic judgment calls like an
`useEffect` that only mirrors derived state, a mutation that should invalidate a
query but doesn't, or a component whose reusability was never actually pushed
into props. Don't re-report what `pnpm gate` would already catch — assume it
ran and passed; look past it.

## What to check

- **Correctness & regressions** — logic errors, edge cases, state that can drift
  out of sync, race conditions.
- **Conventions** (`AGENTS.md`) — typed props interface, single named export, no
  `props: any`, no barrel `index.ts`, `cva()` for variants (not manual ternaries),
  tokens-only Tailwind (including inside `cva()` maps), no hardcoded strings
  (`t('KEY')` from `src/i18n/locales/`), no `as any`/`!`/`@ts-ignore`/`eslint-disable`.
- **Data & State** (`AGENTS.md` § Data & State) — query keys defined on the global
  `QueryKey` enum (`src/constants/queryKeys.ts`), never a per-feature key
  factory or an inline string literal; a mutation that touches cached data returns
  `invalidateQueries(...)` from its `onSuccess`, with a matching success toast;
  Zod v4 top-level formats (`z.email()`, not `.email()` chained); `mutate` over
  `mutateAsync` unless there's a real reason.
- **Accessibility** — labels, keyboard reachability, focus order, heading order —
  read the markup as if strict `jsx-a11y` and React Doctor both missed something,
  because sometimes they do (see AGENTS.md § Accessibility).
- **Reusability** — does this component only actually work at its one call site?
  Caller-specific data/copy belongs in props, not baked in.
- **Styling** — no class string hoisted into a shared constant instead of a real
  `cva()` variant; no `dark:` override at the call site (AGENTS.md § Styling Tokens).

## How to report

Group findings by severity, most severe first:

- **Blocking** — breaks a hard rule or an actual invariant (auth/token handling,
  a real bug, a banned pattern).
- **Should fix** — a clear convention violation or a real but non-critical bug.
- **Nit** — style/polish, safe to leave for a follow-up.

For each: `path:line`, the rule/section it violates, why it matters, and a
concrete fix (a short snippet where useful) — not just "consider refactoring."

If the diff is clean, say so plainly and name anything that looked risky but
checked out. Be concrete and terse — no praise padding, no hypotheticals.
