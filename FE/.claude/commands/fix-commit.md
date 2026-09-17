---
description: Diagnose and fix a blocked pre-commit quality-gate failure, then re-verify.
argument-hint: '[optional: stage name or file path]'
allowed-tools: Read, Edit, Bash(pnpm run *), Bash(pnpm exec *), Bash(git add *)
---

Fix the frontend quality-gate failure that blocked the commit. Scope hint: $ARGUMENTS

Follow the `fe-fix-commit` skill in `.claude/skills/fe-fix-commit/SKILL.md` exactly.

1. Read `.git/quality-gate/last-failure.json`. If missing, run `pnpm verify` to reproduce.
2. Fix the underlying **code**, following `AGENTS.md`.
   - Never add `eslint-disable`, `as any`, `!`, `@ts-ignore` — see `AGENTS.md` § Never Do.
   - Never `--no-verify` — see `AGENTS.md` § Agent Execution Safety.
   - Accessibility and type fixes are permanent code fixes, not suppressions.
3. Re-stage only the files you changed, then run `pnpm verify` until green.
4. Report what was fixed and anything that still needs human input. Do not commit unless asked.
