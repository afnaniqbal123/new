<!-- AUTO-GENERATED from .claude/commands — edit the source, then run `pnpm ai:sync`. -->

Set up the project-wide theme. Reference: $ARGUMENTS

Follow the `fe-theme-setup` skill in `.claude/skills/fe-theme-setup/SKILL.md` exactly — this
is a ONE-TIME, project-wide token pass on `src/index.css`'s `@theme` block, not a per-component
build. For a single component instead, use `/new-component`.

1. Ask for the design reference if not already given — same three options `/new-component`
   uses: a screenshot, a Figma/pen.dev file, or a description.
2. Read the current `@theme` and `.dark` blocks in `src/index.css` before changing anything.
3. Derive real token values from the reference only — brand color ramp, radius scale, fonts,
   spacing — never invent a value the reference doesn't support.
4. Update only `src/index.css`'s `@theme`/`.dark` blocks. Never a per-component override,
   inline style, or new arbitrary Tailwind value anywhere else.
5. Audit every component in `src/components/common/` against the new tokens, especially
   color-contrast (`pnpm check:a11y`). If anything breaks, escalate to the user for a
   decision — never silently weaken the constraint to compensate.
6. Finish with `pnpm check:a11y`, `pnpm check:build`, `pnpm check:test`, then `pnpm verify`.
