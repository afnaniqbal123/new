<!-- AUTO-GENERATED from .claude/commands — edit the source, then run `pnpm ai:sync`. -->

Scaffold a new page: $ARGUMENTS

Follow the `fe-page-scaffold` skill in `.claude/skills/fe-page-scaffold/SKILL.md` exactly —
this is for a full-page design reference with multiple visual regions, not one component. If
what's actually being asked for is a single component or one self-contained feature instead,
use `/new-component` or `/new-feature` directly; don't run a one-piece build through this
skill.

That skill:

1. Confirms the reference is genuinely a full page, not one piece.
2. Applies the design-fidelity principle before decomposing anything — a fixed pixel value in
   the reference becomes a responsive equivalent, never a literal transcribed value.
3. Inventories every visual region and classifies each: a repeated shape (even on first use)
   becomes a new `src/components/common/` primitive; something that resembles an existing
   piece goes through `fe-component-scaffold`'s own duplicate-check; a genuinely page-specific
   piece goes under `src/components/<concern>/<page-name>/`.
4. Builds every identified piece by invoking `fe-component-scaffold` for it — never
   re-implementing that skill's own steps here.
5. Composes every piece directly in the top-level page file — no intermediate
   `<PageName>Feature.tsx` layer unless a piece is genuinely reusable across multiple pages.
6. Writes `<PageName>.workflow.test.tsx` against the real flow the page actually has — not an
   invented interaction that doesn't exist on the page.

Charts use recharts with `@theme` CSS custom-property colors (see the skill file for the two
known recharts gotchas: props don't forward to SVG elements, and don't assert on a chart's
exact computed color in an automated test).

Then run `pnpm verify`.
