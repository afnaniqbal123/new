<!-- AUTO-GENERATED from .claude/commands — edit the source, then run `pnpm ai:sync`. -->

Scaffold a new component: $ARGUMENTS

Follow the `fe-component-scaffold` skill in `.claude/skills/fe-component-scaffold/SKILL.md`
and the conventions in `AGENTS.md` § Component Conventions. That skill starts by pinning down
the component's name/purpose and checking for a design reference (Figma/pen.dev + screenshot,
or none) before writing any code — do that first.

Create in `src/components/<target>/`:

- `<ComponentName>.tsx` — typed props interface, single named export, full a11y, tokens only.

No test file for a `common`/`layouts` component on its own — this repo tests at the workflow
level (see `AGENTS.md` § Testing), not by unit-testing individual primitives.

No barrel export. No hardcoded strings — add a key to `src/i18n/locales/<lng>/common.json`
and read it with `useTranslation()`'s `t('KEY')`. Then run `pnpm verify`.
