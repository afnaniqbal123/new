---
name: fe-theme-setup
description: Use ONCE, early in a new project built on this boilerplate, to establish the project-wide brand theme from a design reference — the token-level pass that edits the single `@theme` block in src/index.css (colors, radius, spacing, type). This is project-wide and one-time, not per-component — for building or matching an individual component to an already-established theme, use fe-component-scaffold instead. Re-run only for a substantial, deliberate re-theme, not a one-off tweak.
---

# Setting the project-wide theme

Authoritative source: `AGENTS.md` § Styling Tokens (`src/index.css`'s `@theme` block is the
**only** place a design token is defined — no component ever hardcodes a color, radius, or
arbitrary Tailwind value). This skill is how that block gets its real, project-specific values
for the first time. It does not touch individual components' markup — see
`fe-component-scaffold` for that.

## Step 1 — Reference check

Ask the user (use `AskUserQuestion` if not already given in the conversation):

> "What's the design reference for this project's theme — a screenshot, a Figma/pen.dev file,
> or a description?"

Same three options `fe-component-scaffold` uses for a single component, applied here to the
whole brand instead:

- **pen.dev / `.pen` file** — don't ask for a screenshot; read it directly via the Pencil MCP
  tools (`get_app_state` with `include_schema` + `include_canvas_design`, then
  `get_guidelines`).
- **Figma or a screenshot** — ask for one legible enough to read exact colors, corner radii,
  and typography (a link alone isn't enough).
- **Description only** — take the user's words (brand colors, font names, "rounded and soft"
  vs. "sharp and dense") as the source instead of an image.

Every token value must trace back to something in the reference. Never invent a value the
reference doesn't support — if the reference doesn't specify something (e.g. a danger-state
color), keep this repo's existing neutral default for it rather than guessing.

## Step 2 — Read the current state before touching it

Read the full `@theme` block in `src/index.css` (and the `.dark { ... }` override block right
below it) before changing anything — inspect before edit, per `AGENTS.md` § Agent Execution
Safety. Note what's already there: the `--color-brand-*` ramp, the semantic
`--color-surface`/`--color-foreground`/`--color-border`/`--color-danger`/`--color-success`
tokens, the `--radius-*` scale, `--spacing`, the `--text-*` scale, and `--font-sans`/
`--font-mono`.

## Step 3 — Derive real values from the reference

Translate the reference into concrete values for whichever tokens it actually informs:

- **Brand color ramp** (`--color-brand-50` … `--color-brand-900`) — derive from the
  reference's primary brand color; keep the existing ramp's lightness/chroma progression shape
  (light→dark, OKLCH) so contrast relationships stay predictable, don't just replace `500` and
  leave the rest inconsistent.
- **Semantic surface/foreground tokens** — only change these if the reference calls for a
  non-neutral ground (e.g. a warm off-white surface); otherwise leave them as-is and let
  `--color-ring`'s dependency on `--color-brand-500` carry the brand color through.
- **Radius scale** — match the reference's actual corner rounding (sharp/subtle/pill), not a
  guess — if buttons in the reference are clearly `4px`, don't leave `--radius-md` at its
  boilerplate default.
- **Font families** — `--font-sans`/`--font-mono` from the reference's actual typeface(s). If
  the reference specifies a Google Font, that's a project-level addition to the app's font
  loading (not scope-covered by this skill's token edit alone) — flag it to the user rather
  than silently wiring up a new `<link>`/import.
- **Spacing** — only touch `--spacing` if the reference's density genuinely deviates from
  Tailwind's default 4px base; don't change it on a hunch.

Update the `.dark { ... }` override block to match — a re-theme that only updates light-mode
tokens leaves dark mode inconsistent with the new brand.

## Step 4 — Apply the change in the one central place

Edit only the `@theme` block (and its `.dark` override) in `src/index.css`. Never hardcode a
resulting value anywhere else — no inline `style={{}}`, no new arbitrary Tailwind value, no
one-off override at a call site (`AGENTS.md` § Never Do, § Styling Tokens). If matching the
reference seems to require a value with no token to hold it, add the token to `@theme` — don't
work around the system.

## Step 5 — Audit every existing common component under the new theme

Read the actual current contents of `src/components/common/` (don't assume the list — it
changes over time) and, for each one, confirm it still renders coherently against the new
token values — pay particular attention to anything Radix-based with its own interaction
states (`Dialog`, `DropdownMenu`, `ConfirmDialog`, `Toaster`) and anything text-on-color
(`Button` variants, `SearchInput`, form validation states in `FormField`/`PasswordInput`).

Specifically check **color-contrast ratios** against the strict `jsx-a11y` rules already
enforced in this repo (`AGENTS.md` § Accessibility: ≥ 4.5:1 normal text, ≥ 3:1 large text) —
run `pnpm check:a11y` after the token change, since a contrast regression on a component whose
markup didn't change can still be triggered by a computed-style rule, and read the actual
components against the checklist to catch what static lint can't (e.g. a brand color that's
technically compliant against `--color-surface` but not against `--color-surface-muted`).

## Step 6 — If something breaks, escalate — never silently compensate

If the new theme pushes any component's contrast (or another enforced constraint) out of
compliance, **do not** quietly nudge the token to "fix" it without telling the user — that's
weakening the constraint to make the conflict disappear, which `AGENTS.md` § Agent Execution
Safety explicitly forbids ("escalate, don't weaken"). Instead:

1. Name the exact component + token combination that fails and why (the actual contrast
   ratio computed vs. the 4.5:1/3:1 bar).
2. Present it to the user as a decision: adjust the offending brand token slightly (and by how
   much), or accept a different token relationship, or confirm the reference itself has an
   accessibility problem worth raising with whoever supplied it.
3. Only change the token once the user has chosen — never on your own judgment.

## Step 7 — Verify

Run the same verification this repo already expects for any change (see `AGENTS.md` §
Agent Execution Safety and § The Quality Gate, `docs/onboarding.md` § 4 for the full trace) —
don't invent a separate process:

- `pnpm check:a11y` — the strict `jsx-a11y` pass, targeted first since this change is most
  likely to trip it.
- `pnpm check:build` — confirms the new `@theme` values compile cleanly through Tailwind v4's
  CSS-first pipeline.
- `pnpm check:test` — every existing `*.workflow.test.tsx` that touches a `common/` primitive
  should still pass unchanged. A token/color change should never require rewriting a test
  assertion — Testing Library queries by role/label, not by color or class — so a test failure
  here is a signal something is actually broken, not something to patch the test around.
- Finish with the full `pnpm verify` before calling the theme pass done.

## Never

- Don't touch anything outside `src/index.css`'s `@theme`/`.dark` blocks to apply a theme
  change — no inline styles, no new arbitrary Tailwind values, no per-component color override.
- Don't create a `*.test.tsx` for a `src/components/common/` primitive as part of this pass —
  this repo deliberately doesn't unit-test primitives at that level (`AGENTS.md` § Testing);
  they're covered by the workflow tests re-run in Step 7.
- Don't invent a token the reference doesn't support, and don't silently weaken an
  accessibility bar to make a chosen brand color fit — see Step 6.
- Don't re-run this skill for a small tweak (e.g. nudging one button's hover shade) — that's a
  normal token edit, not a project-wide re-theme.
