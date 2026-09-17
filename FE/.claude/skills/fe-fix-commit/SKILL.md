---
name: fe-fix-commit
description: Use when a React/TypeScript commit is blocked by the pre-commit quality gate (guard rails, type errors, lint/convention, accessibility, style consistency, or react-doctor findings). Diagnoses the failure and fixes the underlying code — never disables checks.
---

# Fixing a blocked frontend commit

Authoritative rules: `AGENTS.md`.

## Absolute rules

- Fix the code, not the check. A11y and type fixes are permanent correctness fixes.
- Suppression/commit/git boundaries: see `AGENTS.md` § Never Do and § Agent Execution Safety.

## Procedure

1. **Find the failure.** Read `.git/quality-gate/last-failure.json`. If stale/missing,
   reproduce with `pnpm verify` (or `pnpm check:types` / `pnpm check:lint`).
2. **Fix by category:**
   - _Guard rails:_ remove `console.*` (or gate behind `import.meta.env.DEV`), move secrets to
     `.env`, resolve merge markers, split oversized files.
   - _Type safety:_ fix the real type; add an `interface`, never cast to `any`.
   - _Lint & conventions:_ add stable `key={item.id}`, type props, move hardcoded text to
     `src/i18n/locales/<lng>/common.json` + `t('KEY')`, fix hook deps, replace arbitrary
     Tailwind values with tokens.
   - _Accessibility:_ add `alt`, associate labels, add button `type`, keyboard handlers, fix heading order.
   - _Style Consistency:_ read what Impeccable flagged and fix the actual markup/CSS —
     there's no CLI auto-fix.
   - _React Diagnostics:_ read what react-doctor flagged (`pnpm exec react-doctor why <file>:<line>`
     explains a specific finding) and fix the real pattern it caught.
3. **Re-stage** only changed files, then run `pnpm verify` until green.
4. **Report** what changed and anything needing a human decision.

## When to ask

Ask before acting if a "hardcoded string" is really a non-translatable literal, or if a rule
seems genuinely wrong for the case.
