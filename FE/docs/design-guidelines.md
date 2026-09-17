# Design Guidelines

This file holds the handful of visual/styling conventions that aren't already covered by
`AGENTS.md` § Styling Tokens or by reading `src/index.css`'s `@theme` block directly — the
few things worth writing down in prose rather than leaving implicit in the component code.
Like every value in `src/index.css`, everything below is a neutral default meant to be
overridden per project, not a permanent brand decision.

## Flat-by-default

No shadow tokens exist in `@theme` — depth is conveyed through the `surface`/`surface-muted`
color contrast and `border`, never `box-shadow`. This is deliberate, not an oversight: a
`shadow-lg` at a call site is exactly the kind of arbitrary, ungoverned visual value AGENTS.md
§ Component Conventions already bans. If a project genuinely needs elevation, add real shadow
tokens to the `@theme` block first — don't hardcode one at the call site.

## Typography hierarchy

The six type sizes in `@theme` map to a fixed hierarchy — pick by role, not by "what looks
about right":

- **2xl** (1.5rem) — page-level headings (rare; most screens don't need one).
- **xl** (1.25rem) — section headings, dialog titles.
- **lg** (1.125rem) — card/list-item titles.
- **base** (1rem) — body text, form inputs.
- **sm** (0.875rem) — labels, button text, secondary text.
- **xs** (0.75rem) — helper/error text, badges.

## Component-specific conventions

- **Buttons** — `rounded-md`, no border. Primary: `bg-brand-600` / white text,
  `hover:bg-brand-700`. Secondary: `bg-surface-muted` / foreground text, `hover:bg-border`.
  Ghost: transparent, `hover:bg-surface-muted`. Danger: `bg-danger` / white text,
  `hover:opacity-90`.
- **Dialogs** (Radix `Dialog`) — `rounded-lg`/`rounded-xl` corners, `surface` background with
  a translucent `surface-inverted` overlay behind it, `border-border` — no shadow (see
  Flat-by-default above).
- **Navigation** (`RoleLayout`'s sidebar/topbar) — the active-item state is `surface`/
  `surface-muted` background contrast only, never a shadow or a heavy border.
