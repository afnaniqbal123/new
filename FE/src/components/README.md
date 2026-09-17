# Components

## Directory Structure

- `common/` — Reusable, domain-agnostic UI (Button, Input, Modal, Card, ...).
- `layouts/` — Page shells (`AppLayout`, `AuthLayout`, `ErrorLayout`, `RoleLayout` — one
  component that renders the right shell for whichever role is signed in, see
  `src/routes/ProtectedRoutes.tsx`).
- `<concern>/` (e.g. `auth/`, `example/`) — components for a concern that isn't
  role-specific. Ships with two: `auth/` (the Auth feature's forms — see its
  README) and `example/` (`ExampleWidget`, the reference "how to shape a feature"
  example). Every new non-role concern is a **new folder at this same level**,
  not nested under a `features/` wrapper.
- `<role>/` — components used only within one role's own pages (see
  `src/routes/ProtectedRoutes.tsx` § the role system). No components ship here by default
  (both example roles are single placeholder pages with no role-specific components
  yet) — add a folder at this same level when a real project's role needs one,
  mirroring the matching `src/pages/<role>/` folder.

The matching **pages** (route-level: layout glue, `Seo`, `location.state`/search
params, navigation) live in `src/pages/`, one folder per concern/role, mirroring
this structure — see `src/pages/README.md`.

## Naming Conventions

- **Components:** PascalCase (`Button.tsx`, `UserCard.tsx`).
- **Styles:** match the component name (`Button.styles.ts`) — Tailwind tokens preferred.

## Hard Rules (enforced by the quality gate)

1. TypeScript prop interface — never `props: any`, never `as any`.
2. Named export per component file — **no barrel `index.ts`**.
3. Accessibility compliance — strict `jsx-a11y` lint on every commit.
4. No hardcoded user-facing text — add a key to `src/i18n/locales/<lng>/common.json` and
   read it with `useTranslation()`'s `t('KEY')`.
5. Design tokens only — no arbitrary Tailwind values (`w-[127px]`).
6. A new look on an existing `common/` primitive is a new `cva()` variant on that
   component, never a parallel one-off component (see `Button.tsx`'s `shape`/`size="icon"`
   variants — the reference case is a floating circular action button, which is `Button`,
   not a standalone `FloatingActionButton`).
7. No per-feature `README.md` — `AGENTS.md`/`docs/GUIDE.md` is the reference for how a
   feature is shaped; a feature folder does not additionally document itself.

See `AGENTS.md` for the full, authoritative rule set.
