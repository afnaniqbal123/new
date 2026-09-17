---
name: fe-project-identity
description: Use ONCE, early in a new project built on this boilerplate, when the developer gives you a project scope (name, description, optionally portal display names) and wants the repo to stop reading as the generic starter. Mechanically renames every place the boilerplate's own identity (title, package name, app name, portal titles) is hardcoded. Does NOT touch AGENTS.md's rules/framing, and does NOT rename roles, folders, or routes — those are separate, structural decisions this skill deliberately never makes.
---

# Propagating a project's identity through the boilerplate

Authoritative source for what this skill must never touch: `AGENTS.md` rule #1 (zero
business-domain lock-in) and its own Directory Map/role-system documentation. This skill
changes **display text only** — see § Boundaries below before doing anything.

## Step 1 — Get the scope

Ask the developer (use `AskUserQuestion` if not already given in the conversation):

> "What's the project's name, a one-sentence description, and — only if you want them
> renamed — display names for the member/admin portals?"

Three inputs, two required:

- **Project name** (required) — becomes the page `<title>`, `package.json`'s `name`
  (kebab-case) and the `APP_NAME` i18n value.
- **One-sentence description** (required) — becomes `package.json`'s `description`.
- **Portal display names** (optional) — if given, becomes the `PORTAL_MEMBER_TITLE`/
  `PORTAL_ADMIN_TITLE` i18n _values_ only (e.g. "Customer Portal" instead of "Geeks FE
  Boilerplate"). If not given, leave these keys' values alone — do not guess a name the
  developer didn't provide.

## Step 2 — Update every mechanical rename target

Read each file's current content first (inspect before edit, `AGENTS.md` § Agent Execution
Safety), then update only the identity string itself, nothing else in the file:

1. **`index.html`** — the `<title>` tag.
2. **`package.json`** — `name` (kebab-case version of the project name) and `description`.
3. **`src/i18n/locales/en/common.json`** — `APP_NAME`'s value (and every other locale file
   that exists, per `check:i18n`'s cross-locale parity requirement — a value changed in `en`
   without the matching change in every other locale fails that check); `PORTAL_MEMBER_TITLE`/
   `PORTAL_ADMIN_TITLE` values, only if the developer gave portal names in Step 1.
4. **Final check — grep for the old app name.** `e2e/smoke.spec.ts` does not currently
   hardcode the app name in any assertion (its headings are `'Sign in'` and `'Example'`), so
   there is nothing to update there today — but grep the repo for the exact old `APP_NAME`
   string as a catch-all after finishing steps 1–3. Anywhere else it turns up hardcoded
   outside the files above is a real miss, not a false positive to ignore.

## Step 3 — Verify

Run `pnpm check:i18n` (catches a locale file left out of step 2.3), `pnpm check:types`, and
`pnpm exec playwright test e2e/smoke.spec.ts` specifically before calling it done. Finish with
a full `pnpm verify`.

## Boundaries — read before starting, not after

This skill's scope is deliberately narrow. Two things it must **never** do, even if asked:

- **Never edit `AGENTS.md`'s rules or framing.** Rule #1's "domain-agnostic, never invent
  products/orders/bookings" framing, the Directory Map, the role system's own documentation —
  all of it stays exactly as-is. Whether/how a real project's rulebook should eventually stop
  describing itself as "a generic starter" is a genuine open question this skill doesn't
  attempt to answer — it's a human decision, explicitly out of scope, not an oversight.
- **Never rename a role, a folder, or a route.** A developer giving a portal display name in
  Step 1 (e.g. "Customer Portal") changes only the _text shown to a user_ — it does not
  rename `Role.MEMBER`, rename `src/components/member/`/`src/pages/member/`, or touch
  `ProtectedRoutes.tsx`'s routes. Renaming the underlying role is a structural change with its
  own existing, separate process (`AGENTS.md`'s "adding/renaming a role" flow — `roles.ts` →
  `ProtectedRoutes.tsx` → `pages/<role>/`, plus the `no-cross-role-component-import` ESLint
  rule that derives its protected-folder list from those same folder names) — conflating a
  display-text rename with that structural one risks this skill silently attempting a much
  bigger, riskier change than "rename only" promises. If the developer wants the role itself
  renamed, say so explicitly and point them at that separate process instead of doing it here.

## Never

- Invent a portal name the developer didn't give.
- Touch any file not listed in Step 2.
- Treat this skill as a substitute for deciding how `AGENTS.md` itself should eventually
  describe a project that's no longer domain-agnostic — that decision stays with the
  developer.
