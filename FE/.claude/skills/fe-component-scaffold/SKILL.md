---
name: fe-component-scaffold
description: Use when creating a new React component or feature folder. Starts by pinning down the component's identity (name + feature/purpose) and whether a design reference exists (Figma/pen.dev frame + screenshot, or none), then scaffolds it — typed props interface, hooks backed by a service file, no per-feature README — following the ExampleWidget shape and matching the existing design system.
---

# Scaffolding a component or feature

Authoritative conventions: `AGENTS.md` § Component Conventions and § Directory Map.
Reference implementation: `src/components/example/`.

Every component built through this skill goes through four steps, in order:
**1) identity → 2) reference check → 3) duplicate check → 4) build.** Don't skip straight to code.

## Step 1 — Pin down identity

Before writing anything, confirm out loud (or ask if not given):

- **Name** — PascalCase, specific to what it does (not `Card2` or `Wrapper`).
- **Feature/purpose** — one sentence: what it's for and where it lives
  (`src/components/common/<Name>/` for a reusable primitive, `src/components/<concern>/`
  for a non-portal-specific feature screen/flow — e.g. `auth/`, `example/` — or
  `src/components/<portal>/` for one scoped to a single portal/area).
- **Reusability shape** — what varies per caller (variants, sizes, content via `children`,
  data via props) vs what's fixed. A component hardcoded to one call site's copy or data
  is not done — push anything caller-specific into props.

## Step 2 — Reference check

Ask the user (use `AskUserQuestion` if it's not already obvious from the conversation):

> "Is there a design reference for this component, or should I design it?"

**Option A — There is a reference.**
A Figma frame or a pen.dev (`.pen`) frame.

- **pen.dev / `.pen` file**: don't ask for a screenshot — read the file directly via the
  Pencil MCP tools (`get_app_state` with `include_schema` + `include_canvas_design`, then
  `get_guidelines`). Build straight from that schema.
- **Figma (or anything without an MCP reader)**: ask the user for a screenshot of the frame
  — a link alone isn't enough visibility. Zoom/crop so spacing, states (hover/disabled/error),
  and text are legible.
- Build a **faithful port** of that reference — same structure, states, and content shape —
  re-expressed 100% through this repo's standards (Step 4). This is not a redesign: don't
  improvise layout the reference didn't show, but do translate colors/spacing/type to our
  `@theme` tokens rather than eyeballing arbitrary values.

**Option B — No reference.**
Ask a follow-up: _"Should I design it, or will you provide a screenshot/description to match?"_

- **B1 — Design it.** Before laying anything out, look at 2–3 existing common components
  (e.g. `Button.tsx`, `Input.tsx`, `Dialog.tsx`) to read the current spacing scale, radius,
  color tokens, and interaction patterns, then design the new one to feel like it belongs
  next to them — same density, same states, same token usage.
- **B2 — User provides reference material.** Take whatever they give (screenshot, described
  layout) and build it so it matches the existing theme (`@theme` tokens in `src/index.css`),
  color palette, and component patterns already in the repo — consistency with what exists
  beats matching the reference pixel-for-pixel if the two conflict.

## Step 3 — Duplicate check (mandatory, not a suggestion)

Before writing any new component code, actually look for something that already does this —
don't rely on remembering the repo from earlier in the conversation:

- List `src/components/common/`, the concern/portal folder Step 1 named
  (`src/components/<concern>/` or `src/components/<portal>/`), **and every other
  `src/components/<role>/` folder that exists** (`ls src/components/` — anything that isn't
  `common/auth/example/layouts` is a role folder, same list `roleBoundaries/
no-cross-role-component-import` in `eslint.config.js` derives it from). Read the props/
  purpose of anything that looks related, not just filenames that happen to match. Checking
  every role folder, not only the target one, is what catches the cross-role case in the
  promotion rule below — skipping it is how a second, near-identical component quietly gets
  built in a different role's folder instead of being found.
- **Don't just match "same core purpose" — also ask "is this a new variant of an existing
  component?"** A near-duplicate isn't only "another table/list/modal" — it's also a
  different _look_ (shape, size, position) of something that already exists but currently
  only ships one look. Concretely: before scaffolding anything that is fundamentally a
  `<button>` (an icon-only trigger, a floating action button, a toolbar button, a link
  styled as a button, ...), check whether `Button.tsx`'s existing `variant`/`size` axes
  already cover it, or would with one more `cva()` variant — same question for anything
  that's fundamentally an `<input>`, a modal/overlay, a list row, etc. against `Input.tsx`/
  `Dialog.tsx`/whatever's closest. A worked example from this exact failure mode: a
  circular, icon-only, fixed-position "+" trigger was once built as a standalone
  `FloatingActionButton.tsx` — wrong, because "circular, icon-only, fixed-position" is
  three variant/shape/position facts about a button, not a different kind of component.
  The fix was a `shape` variant (`default`/`circle`) and a `size="icon"` on `Button.tsx`
  itself; position (`className="fixed right-6 bottom-6"`) is page layout passed at the
  call site, not part of the component's look. Ask this question even when nothing in
  `src/components/common/` shares the new piece's exact filename or literal purpose —
  the match to look for is "shape of the interaction," not "identical feature."
- Decide, and act accordingly:
  - **Near-duplicate exists, or the new piece is really a variant of an existing one**
    (same core purpose _or_ the same underlying primitive with a different variant/size/
    shape) → extend the existing component (a new `cva()` variant, a new prop, a new size/
    shape) instead of scaffolding a parallel one. Implement inside that existing file and
    stop here — do not continue to Step 4 as if this were a new component.
  - **No real overlap** → proceed to Step 4.
  - **Ambiguous** (partial overlap; extending might compromise the existing component's
    simplicity or its other callers) → ask the user directly, e.g.: _"This repo already has
    `<X>` in `src/components/common/`, which does `<Y>`. Do you want me to extend it, or is
    this genuinely a separate component?"_ Do not decide unilaterally — a duplicate primitive
    that quietly drifts from its sibling is exactly the failure mode this step exists to
    prevent (see `AGENTS.md`'s Never-list: a component that only works for its first call site
    belongs in props, not a copy-paste; and `AGENTS.md` § Component Conventions' "a new look
    on an existing common component is a new `cva()` variant, never a parallel component"
    rule).
  - **Near-duplicate found, but it lives in a _different_ role's folder
    (`src/components/<other-role>/`) than the one this new component belongs to → promote
    it, don't cross-import and don't duplicate it.** `roleBoundaries/no-cross-role-component-
import` (`eslint.config.js`) hard-blocks importing it from outside that role as-is, and
    copy-pasting a second near-identical version into the new role's folder is exactly the
    duplication Step 3 exists to prevent — neither is the fix once **two** roles genuinely
    need the same shape. Concretely (worked example: a `Drawer` built for
    `components/customer/`, then needed — with small adjustments — on an admin page):
    1. Confirm with the user this is really the same underlying component with new
       variant/prop needs, not two components that only coincidentally look similar today
       (same test as the ambiguous case above — ask if it's not obvious).
    2. Move the file from `src/components/<original-role>/` to `src/components/common/`,
       generalizing it on the way: strip anything hardcoded to the original role (copy,
       role-specific data shape, a role-specific default) out into props, the same way any
       other common component takes its variance through props rather than assuming a
       single caller.
    3. Update the original role's existing call site(s) to import from the new
       `src/components/common/` location — the component's behavior for that role must not
       change as a side effect of the move.
    4. Add whatever new variant/size/prop the new role's use case needs (Step 4 below),
       same as extending any other common component.
    5. Build the new role's usage against the now-common component.
       A component already living in `src/components/common/` needs no such move — this
       sub-step only applies the first time a role-private component gains a second role.

## Step 4 — Build

### A common component (`src/components/common/<Name>/` or file)

- `<Name>.tsx` — `interface <Name>Props`, single **named** export, variants/sizes through
  `cva()` (not ternary strings), caller `className` merged last with `cn()`, explicit button
  `type`, labeled inputs, tokens-only Tailwind (including inside `cva()` variant maps — the
  lint rule doesn't scan those), text from `src/i18n/locales/<lng>/common.json` via
  `useTranslation()`'s `t('KEY')` — never a hardcoded string, never a default-parameter
  value (a hook can't sit in a default-parameter position — resolve `prop ?? t('KEY')`
  inside the function body instead).
- **No test file for this component on its own.** This repo tests at the workflow level,
  not the isolated-primitive level — a common primitive gets exercised through whichever
  feature workflow test(s) actually use it, not a standalone unit test of its own. See
  `AGENTS.md` § Testing.

Verify by running it (`pnpm dev`) too, checking it against the identity/reusability
decided in Step 1.

### A feature (`src/components/<concern-or-portal>/<Name>/`)

Copy `src/components/example/` and rename; gut the logic. Its hooks live in
`src/hooks/common/` and its service in `src/services/common/exampleService.ts`, not the
component folder — copy both too, into `src/hooks/<concern>/` and
`src/services/<concern>/` for the new feature (`common/` unless the feature is genuinely
role-specific), not alongside `<Name>.tsx`. Its schema (`src/schemas/common/
example.schema.ts`) moves into `src/schemas/<concern>/` the same way. Keep:

- `<Name>.tsx` (component) and `<name>Store.ts` (feature-scoped Zustand UI state, if
  needed). **No `README.md`** — `AGENTS.md`/`docs/GUIDE.md` is the reference for how a
  feature is shaped; a feature folder does not additionally document itself.
- `src/services/<concern>/<name>Service.ts` — one typed async method per endpoint (list/
  create/update/delete, or whichever the feature needs), each method making the actual
  `apiClient` call and Zod-`.parse()`-ing the response before returning. Matches
  `src/services/auth/authService.ts`'s shape (a plain object of async methods).
  `src/services/common/exampleService.ts` is the reference shape.
- `use<Name>*.ts` (TanStack Query hook, keyed off a new member on
  `src/constants/queryKeys.ts`'s global `QueryKey` enum — never a per-feature key
  factory) under `src/hooks/<concern>/<hookName>.ts` — company-wide convention, never
  co-located inside the feature's own component folder. **The hook's `queryFn`/
  `mutationFn` calls the service file above — it never calls `apiClient` directly and
  never does its own Zod validation** (that's the service function's job). `src/hooks/
common/useExampleItems.ts` (calling `exampleService.list`) is the reference shape.
- `<Name>.workflow.test.tsx`, co-located, **mandatory** for a feature — copy
  `ExampleWidget.workflow.test.tsx`'s shape and adapt it to this feature's real flow (load →
  interact → success/empty/error), through `renderWithProviders` and the real MSW-backed
  network layer (`src/mocks/handlers.ts` — add a scenario there if the feature's backend can
  respond in a new way a test needs, never an inline mock bypassing MSW). A feature that
  splits into multiple pieces (e.g. `AddXModal`, `EditXModal`) gets one
  `<Piece>.workflow.test.tsx` per piece, in the same folder — never a separate parallel test
  folder. See `AGENTS.md` § Testing for the full scope/naming rules.

Add the matching thin route wrapper in `src/pages/common/<Name>Page.tsx` (or
`src/pages/<portal>/` for a portal-specific feature) — see `src/pages/README.md`. Wire the
route per `AGENTS.md`/`docs/onboarding.md`'s routing walkthrough: role-gated → registered in
`ProtectedRoutes.tsx`; guest-only → `PublicRoutes.tsx`; reachable whether signed in or not
(the `ExamplePage` shape this skill scaffolds from) → its own hardcoded `<Route>` in
`AppRouters.tsx`'s public shell block, not a registry entry in either file above.

Any new API endpoint is a new member on the relevant **portal/concern's** existing route
enum in `src/constants/<concern>.ts` (`AuthRoutes` in `auth.ts`, `CommonRoutes` in
`common.ts`, and one such file per additional role/concern the moment it actually gets a
real endpoint — see `src/routes/roles.ts` for whatever roles currently exist) — never a
new enum per feature. The route string itself is an absolute path only, never a hardcoded
host or version prefix (no `/api/v1/...`) — see `AGENTS.md` § Constant Registries.

## Never

- Barrel `index.ts` for components. Hardcoded strings. Arbitrary Tailwind values. `props: any`.
- A component that only works for its first call site — if a second usage would need to
  fork it, its variance belongs in props, not a copy-paste.
- A hook that calls `apiClient` directly instead of a `src/services/<concern>/` function.
- A new API-route enum named after a feature instead of a portal/concern, or a route
  string with a hardcoded host/version prefix.
- A per-feature `README.md`.
- A new one-off component for something that's really an existing common component with a
  different variant/size/shape (see Step 3's worked `FloatingActionButton` example).
- A cross-role import to reuse a role-private component from another role's folder
  (`roleBoundaries/no-cross-role-component-import` blocks it), or a second near-duplicate
  copy in the new role's own folder — promote it into `src/components/common/` instead
  (Step 3's promotion sub-step).

Finish by running `pnpm verify`.
