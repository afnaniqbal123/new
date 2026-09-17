# Pages

One file per route. A page is thin: layout glue (`Seo`, headings, footer links),
route-only concerns (`location.state`, search params, `navigate`) — the actual form/UI
logic lives in the matching `src/components/<concern>/` folder.

## Directory Structure

- `common/` — pages reachable by every role, in two different ways:
  `SettingsPage`/`ProfilePage`/`NotificationsPage` are registered in
  `src/routes/ProtectedRoutes.tsx`'s `COMMON_PROTECTED_ROUTES` (`roles: 'all'` — still
  auth-gated, just reachable by any signed-in role); `ForbiddenPage` and `ExamplePage` are
  a separate, third category — reachable whether signed in or not, no auth guard at all —
  wired as their own hardcoded `<Route>`s in `AppRouters.tsx`'s public shell block instead,
  not through either routing registry. See `AGENTS.md`/`docs/onboarding.md`'s routing
  walkthrough for the full three-way split. `"/"` itself lives in that same public-shell
  block but isn't an example of this third category — `src/routes/HomeRedirectRoute.tsx` is
  never real content; it's an auth-aware redirect (signed in → the role's home route;
  signed out → `/login`), the fix for a successful signup/login otherwise bouncing back to
  `/login` whenever no role/dashboard exists yet.
- `auth/` — the Auth feature's five pages (login/signup/forgot-password/verify/reset),
  each pairing with the matching form in `src/components/auth/` — see that folder's
  README for the full flow.
- `<role>/` — pages owned by one role (see `src/routes/ProtectedRoutes.tsx` § the role
  system). Ships with two examples, both single placeholder pages: `member/`
  (`Role.CASHIER`) and `admin/` (`Role.ADMIN`). Add a new role by adding it to
  `src/routes/roles.ts`, its routes to `ProtectedRoutes.tsx`, its sidebar variant to that
  same file's `ROLE_LAYOUT`, then a folder here of the same name — no router, guard, or
  layout code changes needed.

## Rule

A page never duplicates its component's logic — it wires props/callbacks and handles
routing. If a "page" starts holding real form state or business logic, that logic
belongs in `src/components/<concern>/` instead.

See `AGENTS.md` and `src/components/README.md` for the full, authoritative rule set.
