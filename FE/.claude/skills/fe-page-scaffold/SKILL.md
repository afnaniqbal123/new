---
name: fe-page-scaffold
description: Use when a design reference (screenshot/Figma/pen.dev) shows a FULL PAGE — multiple visual regions, not one focused piece. Recognizes and decomposes the page into reusable primitives, existing-component extensions, and page-specific pieces, then delegates each piece's actual build to the fe-component-scaffold skill. For a single component or one self-contained feature, use fe-component-scaffold directly instead — this skill is for the "whole page, multiple pieces" case that skill doesn't handle on its own.
---

# Scaffolding a full page

Authoritative conventions: `AGENTS.md` § Component Conventions, § Directory Map, § Testing.
Reference implementation: `src/pages/common/ExamplePage.tsx` (the composition shape), the
whole `src/components/example/` folder (the CRUD-with-invalidation shape any data-driven
piece should match).

This skill **orchestrates**, it doesn't build. Every actual piece gets built by invoking the
`fe-component-scaffold` skill for it — this file never duplicates that skill's identity/
reference-check/duplicate-check/build steps. If what's in front of you turns out to be one
component or one self-contained feature (not a full page), stop and use
`fe-component-scaffold` directly instead; don't run a one-piece build through this skill.

**Say "page," not "feature," when talking to the developer** — ask "what page are you
building?" not "what feature?". The file/component/test structure this skill produces is
organized around the page as the top-level unit (Step 4 below), so the language used to talk
about it should match, throughout every question this skill asks.

## Step 1 — Recognize scope

Look at the reference before asking anything else. Is it:

- **A full page** — a header, several visually distinct regions, more than one kind of
  content (e.g. some stat cards, a table, maybe a chart) → continue with this skill.
- **One focused piece** — a single card, a single form, a single list → this isn't a page-
  scaffold job. Use `fe-component-scaffold` directly and stop here.

If genuinely ambiguous, ask: _"Is this one component, or a full page made of several pieces?"_

## Step 2 — Design-fidelity principle (read before decomposing anything)

**A design reference is a reference for visual intent, never a pixel-perfect spec to copy
values from.** This applies to every piece this skill produces, not just the page shell:

- A fixed pixel value in the reference (`width: 500px`, a hardcoded gap) becomes a
  responsive/proportional equivalent appropriate to its surrounding layout — a percentage, a
  `flex`/`grid` sizing rule, or a Tailwind responsive utility (`md:w-1/2`, `flex-1`, etc.) —
  never the literal pixel value transcribed as-is. A literal pixel value hard-codes exactly
  the breakage this repo's responsive/token-driven system exists to prevent.
- Every color, spacing, radius, and type value still translates to this repo's `@theme`
  tokens (`src/index.css`) — same rule `fe-component-scaffold`'s own reference-check step
  already applies per piece, restated here because it's easy to lose sight of at the
  whole-page level: "faithful port" means matching structure, states, and content shape, not
  transcribing literal numbers.
- Build with real frontend-engineering judgment — semantic HTML, accessible patterns
  (`AGENTS.md` § Accessibility), and genuine responsive behavior at every breakpoint the
  surrounding layout implies, even if the reference only shows one viewport size. Treat the
  reference as "what it should look like and roughly how it's organized," never as "exact
  values to transcribe."

## Step 3 — Inventory and decompose

List every distinct visual region in the reference (header, stat row, table, chart, sidebar
panel, ...), then classify each one:

- **Repeated shape → a new `src/components/common/` primitive, even on first use.** If the
  same visual shape appears more than once _within this one page_ (e.g. four stat cards with
  the same layout, differing only in label/value/icon), that repetition is itself sufficient
  evidence of reusability — scaffold it once, parameterized, and use it N times. Don't wait
  for a second, unrelated page to need the same shape before extracting it; by then it's
  usually copy-pasted twice already.
- **Resembles something that already exists → hand off to `fe-component-scaffold`'s own
  Step 3 (duplicate-check) for that specific piece.** Don't re-decide this yourself — that
  step's whole job is deciding extend-vs-new, and it belongs to `fe-component-scaffold`, not
  a duplicate judgment call made here.
- **Genuinely page-specific** (a chart or widget with logic unique to this page, not reused
  anywhere else) → `src/components/<concern>/<page-name>/<Name>.tsx`, mirroring the existing
  `<role>/<feature>/` nesting this repo already uses (e.g.
  `src/components/admin/dashboard/RevenueChart.tsx`). If it's simple and appears only once,
  it doesn't need its own file at all — inline it directly in the page, the same way
  `ExampleWidget.tsx` inlines its own list-item markup instead of extracting a single-use
  `ExampleListItem` component.

## Step 4 — Build each piece by invoking `fe-component-scaffold`

For every piece identified in Step 3 (except anything inlined directly into the page), invoke
the `fe-component-scaffold` skill for it — its own identity/reference-check/duplicate-check/
build steps apply exactly as documented there, scoped to that one piece's slice of the overall
reference. Do not re-implement any of that logic here.

Charts specifically: use **recharts**, with every color sourced from this repo's `@theme` CSS
custom properties (`fill="var(--color-brand-500)"`, `stroke="var(--color-border)"`, etc.) —
never a hardcoded hex/JS color value, exactly like every other visual value in this repo.
Verified working (`src/index.css`'s tokens resolve correctly through recharts' SVG output in
both light and dark mode — confirmed by direct rendering + screenshot comparison, not
assumed). Two things worth knowing before you touch this:

- **recharts doesn't forward arbitrary props down to the SVG elements it draws.** A
  `data-testid` on `<Bar>`/`<Line>`/etc. never reaches the rendered `<path>`/`<rect>` — if a
  workflow test needs to target a specific chart element, use recharts' own emitted CSS
  classes (e.g. `.recharts-bar-rectangle`), not a custom `data-testid`.
- **Don't assert on a chart element's exact computed color in an automated test.** Reading
  `getComputedStyle(svgElement).fill` immediately after page load is measurably flaky in
  headless Chromium (confirmed directly: intermittent empty-string reads across repeated
  runs, independent of `ResponsiveContainer`, independent of added waits) — the CSS custom
  property itself always resolves correctly (`getComputedStyle(document.documentElement)`
  never failed), only the freshly-painted SVG element's own computed-style read races the
  paint pipeline. This is a real rendering-vs-testing-instrumentation gap, not a rendering
  bug: the chart genuinely paints the right color, screenshots confirm it. If a workflow test
  needs to prove a chart renders with real data, assert on structure/content (bar count, axis
  labels, tooltip text) the way this repo's other tests assert on `getByRole`/`getByText`,
  not on a scraped color value.

## Step 5 — Compose in the page file directly (explicit rule, not inferred)

**The top-level page file (`src/pages/<role>/<PageName>.tsx` or `src/pages/common/
<PageName>.tsx`) composes every piece from Step 4 directly. No intermediate
`<PageName>Feature.tsx` composition layer — unless a piece is genuinely reusable/embeddable
across _multiple_ pages, not just this one.**

This was previously only inferable from `ExamplePage.tsx`'s own comment (`ExampleWidget` is
"reusable/embeddable," gets its own file, and the page itself still owns the top-level `h1`)
— it's a stated rule now, not something to re-derive by reading that file's comment every
time. `ExampleWidget` earns its standalone existence specifically because it's designed to be
dropped into more than one context; a page built through this skill usually won't have that
property for most of its pieces, so most pages compose flat, directly, no extra layer.

The page file itself:

- Owns its own `<h1>`/`<Seo title={...}>` (same pattern as every existing page).
- Composes each Step-4 piece at `<h2>` or below.
- Handles routing wiring per `AGENTS.md`/`docs/onboarding.md`'s routing walkthrough:
  role-gated → `ProtectedRoutes.tsx`; guest-only → `PublicRoutes.tsx`; reachable whether
  signed in or not → `AppRouters.tsx`'s public shell block.

## Step 6 — New hooks, services, routes, and schemas

Any new data-fetching hook a piece needs goes under `src/hooks/<concern>/<hookName>.ts` —
`common/` unless it's genuinely specific to one role's own pages — never co-located inside a
component folder. **The hook's `queryFn`/`mutationFn` calls a function exported from a
matching `src/services/<concern>/<name>Service.ts` file — it never calls `apiClient`
directly**; the service function owns the HTTP call and the boundary Zod validation. See
`AGENTS.md` § Directory Map / § Data & State and `src/hooks/common/useExampleItems.ts` +
`src/services/common/exampleService.ts` for the reference shape. Any new API endpoint is a
member on the relevant portal/concern's existing route enum in `src/constants/<concern>.ts`
(never a new enum per feature, never a hardcoded host/version prefix on the route string),
and its Zod schema lives in `src/schemas/<concern>/`. This is the company-wide convention,
not specific to this skill — `fe-component-scaffold`'s own build step for a feature applies
identically here, per piece.

## Step 7 — Test the actual composing file

`<PageName>.workflow.test.tsx`, co-located with the page file — not a piece's own file, and
never an invented `Feature.workflow.test.tsx` for a composition layer that (per Step 5)
usually doesn't exist. Cover the **real** flow this specific page demonstrates — reason
through what that actually is, don't apply a fixed load-interact-success/error template
regardless of fit:

- A read-only dashboard showing fetched data with no user actions beyond viewing → the real
  flow is load → data renders correctly (and empty/error states if the data source can
  produce them) — there is no "interact" step to invent, and inventing one just to match a
  template produces a test that doesn't describe anything a real user does.
- A page with real interactions (filters, a CRUD action, a form) → cover load → the actual
  interaction → its real success/empty/error outcomes, the same shape
  `ExampleWidget.workflow.test.tsx` and the auth-form workflow tests already use.

Through `renderWithProviders`, real `@testing-library/user-event`, `getByRole`/
`getByLabelText` queries, and the real MSW-backed network layer — never an inline mock. See
`AGENTS.md` § Testing for the full rules this test still has to follow regardless of which
flow shape applies.

## Never

- Decompose and build a piece here that `fe-component-scaffold`'s own steps should own —
  invoke that skill, don't re-implement its logic.
- Copy a literal pixel value from a reference into the built page (Step 2).
- Add an intermediate `<PageName>Feature.tsx` composition layer for a page whose pieces are
  each single-page-only (Step 5).
- Assert on a chart's exact computed color in an automated test (Step 4).

Finish by running `pnpm verify`.
