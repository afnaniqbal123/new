<!-- AUTO-GENERATED from .claude/commands — edit the source, then run `pnpm ai:sync`. -->

Run an accessibility audit on: $ARGUMENTS

Follow the `fe-a11y-audit` skill in `.claude/skills/fe-a11y-audit/SKILL.md`.

1. Run the strict a11y lint pass: `pnpm exec eslint --config eslint.a11y.config.js <path>`.
2. Read the markup by hand against the `AGENTS.md` § Accessibility checklist (labeling,
   focus order, keyboard reachability) — there's no automated a11y test in this boilerplate.
3. Report each violation in plain language with the concrete code fix. Do not suppress
   rules; fix the markup.
