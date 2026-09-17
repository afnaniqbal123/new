# New Developer / New Project Quick-Start Guide

You're starting a **real project** on top of the Geeks FE Boilerplate. This is the fast,
practical path — for the architecture deep-dive, see the pointer table at the bottom.

---

## 1. Getting Started Fast

```bash
git clone <your-new-repo-url>
cd <your-new-repo>
pnpm install     # installs deps + sets up git hooks — never rewrites a tracked file
pnpm dev         # http://localhost:5173 — runs immediately, no backend needed (MSW mocks it)
```

That's it. There's no real backend to configure yet — Mock Service Worker answers every API
call out of the box. Before your first commit, sanity-check the gate once:

```bash
pnpm verify      # the full 16-check quality gate — run this before every "done"
```

---

## 2. The Recommended Build Order

Do these roughly in this order — each step makes the next one meaningfully easier:

1. **Repo setup** — clone, install, confirm `pnpm dev` boots and `pnpm verify` is green on a
   fresh clone.
2. **`fe-project-identity` skill** — one-time rename: project name, package name, app name,
   and (optionally) your portal display names. Purely display text — doesn't touch structure.
3. **`fe-theme-setup` skill** — one-time: point it at your real brand (colors, radius,
   spacing, type) and it edits the single `@theme` block in `src/index.css`. Every component
   already reads tokens, so this alone re-skins the whole app.
4. **Wire up the real `/auth` backend** — the login/signup/OTP/reset flow already exists and
   works end-to-end against mocks; use the `fe-api-guide` skill against your real OpenAPI spec
   to generate the route constants/schemas. This is also the point where you'd set up your
   real env — skippable entirely until you get here:
   ```bash
   cp .env.example .env.local
   ```
   - `VITE_API_BASE_URL` — leave empty for MSW-mocked, same-origin dev (the default); set it
     to your real API host once you're actually wiring up the backend.
   - `VITE_ENABLE_MOCKS` — `true` by default, keeps the app fully runnable with zero backend.
     Every var is Zod-validated at module load (`src/constants/env.ts`) — a missing/malformed
     value fails loudly at startup instead of shipping a silent misconfiguration.
5. **Set up your real roles/portals** — the boilerplate ships two example roles (`MEMBER`,
   `ADMIN`) as placeholders. Rename/add roles via the documented 3-step process in
   `AGENTS.md` (`roles.ts` → `ProtectedRoutes.tsx` → `pages/<role>/`) — no skill for this one,
   it's a structural decision you make deliberately.
6. **The open-ended build loop** — from here on, every real feature is: `fe-page-scaffold` for
   a full page with multiple regions, or `fe-component-scaffold` directly for one component or
   one self-contained feature — repeat per feature for the life of the project.

**Why this order matters:** identity and theme are cheap, one-time passes that touch nothing
structural — doing them first means every screen you build afterward already looks and reads
like your real product, instead of needing a re-skin pass later. Auth and roles are worth
locking in before the main build loop because most real pages end up gated behind them.

One nuance worth knowing: it's fine if your real dashboards/roles aren't ready the moment auth
is wired up. A signed-in user with no home route configured yet sees a clear developer-facing
message (not a confusing silent bounce back to the login screen) — this was a real trap in
earlier boilerplate versions and is now handled gracefully, so you don't have to force a strict
"roles before auth" ordering if your project genuinely needs to build them the other way.

---

## 3. Best Practices To Actually Follow

A short list of things that make the automation actually work _for_ you instead of fighting
you. (Full detail lives in `AGENTS.md` — this is the checklist, not the rulebook.)

- ✅ **Copy the reference folders, never build from scratch.** `components/example/` +
  `pages/common/ExamplePage.tsx` for any list/search screen; `components/auth/` +
  `pages/auth/` for any multi-page form flow. Copy the hooks too — they live in
  `hooks/common/`, not inside the component folder, so they don't come along automatically.
- ✅ **Put every new hook/service/type in the right `<concern>/` folder.** `common/` if it's
  generic or cross-role, a role name if it's genuinely specific to that role's own pages.
  Never leave a new file flat.
- ✅ **Never bypass the quality gate.** No `eslint-disable`, no `--no-verify`, no `as any`.
  If a check feels genuinely wrong for your case, that's a conversation to have — not a
  suppression to add.
- ✅ **`fe-page-scaffold` vs. `fe-component-scaffold`** — a whole page with multiple visual
  regions goes to `fe-page-scaffold` (it decomposes the page, then delegates each piece);
  one component or one self-contained feature goes straight to `fe-component-scaffold`.
- ✅ **Copy the workflow test alongside the feature.** This repo tests real user flows
  (load → interact → success/error) through the actual components and MSW-backed network
  layer — it does not unit-test `Button`/`Input`/`Dialog` in isolation. The workflow test is
  part of what you copy, not a follow-up step.
- ✅ **Adding a new API route or query key follows the same registry pattern as roles.** A new
  endpoint is a member on the relevant **portal/concern's** enum in `src/constants/<concern>.ts`
  (e.g. `AuthRoutes` in `auth.ts`, `CommonRoutes` in `common.ts`) — grouped by portal, never by
  feature, and a route string is always absolute/host-only (never a hardcoded `/api/v1`-style
  prefix). A new portal/concern gets its own `constants/<concern>.ts` file the moment it's
  actually needed, since a real `enum` can't nest. A new cached query is a member on
  `QueryKey` in `src/constants/queryKeys.ts` (deliberately flat/global, unlike the route
  enums), referenced directly in the feature's query hook
  (`queryKey: [QueryKey.YOUR_KEY, params]`) — never an inline string literal, never a
  per-feature key factory.
- ✅ **Adding a new language** is copy-translate-register, nothing more: copy
  `src/i18n/locales/en/common.json` to `locales/<lng>/common.json`, translate every value
  (keep the keys identical), then add it to the `resources` object in `src/i18n/index.ts`.
  `check:i18n` (one of the 16 gate checks) enforces every locale's key set matches `en`
  exactly — there's no escape hatch, so do this the same way every time.

---

## 4. Common Pitfalls / What Not To Do

- ❌ **Don't hand-roll a `fetch`/new axios instance.** Every request goes through the shared
  `apiClient`, wrapped in a TanStack Query hook.
- ❌ **Don't put a hook inside a feature's component folder.** That convention is gone —
  every hook lives under `hooks/<concern>/`, full stop.
- ❌ **Don't skip the workflow test "for now."** It's the primary safety net this repo relies
  on instead of primitive-level unit tests — skipping it is a real coverage gap, not a
  shortcut.
- ❌ **Don't fight a blocked commit by disabling the check.** Fix the underlying code — a
  type error, an a11y violation, a hardcoded string — the check is doing its job.
- ❌ **Don't hardcode a string, a hex color, or an arbitrary Tailwind value** (`w-[127px]`).
  Both are lint-enforced: text goes through `t('KEY')`, visual values through `@theme` tokens.
- ❌ **Don't invent a business-domain concept in the boilerplate layer.** If you're extending
  the shared boilerplate itself (not your own project repo), keep it domain-agnostic — real
  features belong in your project, not upstream.
- ❌ **Don't import across roles.** `components/admin/` can never import from
  `components/member/` (or vice versa) — lint-enforced
  (`roleBoundaries/no-cross-role-component-import`). Only `common/` is universal; see the
  architecture guide for the full explanation.
- ❌ **Don't write a commit message the hook will reject.** Commitlint enforces Conventional
  Commits: `<type>(<scope>): <subject>` — types are `feat fix refactor perf test docs style
build ci chore`; subject starts lower-case, no trailing period, ≤72 characters. Example:
  `feat(components): add UserCard component`. This is a common first-commit surprise with zero
  prior warning otherwise.
- ❌ **Don't use a barrel `index.ts` re-export for components** (types may be barrel-exported,
  components may not), **an array index as a React `key`**, **`console.log` in production
  code** (gate dev-only logging behind `import.meta.env.DEV`), **`@ts-ignore`/
  `@ts-expect-error`** (fix the real type instead), or **read `import.meta.env.VITE_X`
  directly outside `src/constants/env.ts`** (add the var to that file's Zod schema instead).

---

## 5. How To Verify You're On Track

- **A clean `pnpm verify` run** ends with every one of its 16 steps printing success and exits
  with status 0 — no red text anywhere in the output. Run it before calling any task "done."
- **A blocked commit** (the Husky pre-commit hook) prints which of its 6 stages failed and on
  which file — the message tells you exactly what to fix, not just that something's wrong.
- **When something feels wrong and you're not sure why:** the failing check's own script
  (`scripts/checks/*.mjs`) is heavily commented with _why_ the rule exists, not just what it
  checks. If you're stuck, the `fe-fix-commit` skill diagnoses a blocked gate and fixes the
  underlying code for you.
- **When you're debugging a runtime bug** (not a gate failure) — wrong render, stale state, a
  refetch loop — that's `fe-debug`, a different skill from `fe-fix-commit`.

---

## 6. Where To Go For More

| Document                                | What it's for                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| **This guide**                          | Fast, practical entry point — what to do, in order, today                          |
| [`AGENTS.md`](../AGENTS.md)             | The authoritative rulebook — every rule, why it exists, exactly enforced how       |
| [`docs/onboarding.md`](./onboarding.md) | Full step-by-step reference — what every command actually does, command by command |
| [`docs/GUIDE.md`](./GUIDE.md)           | The long-form A–Z explanation of the same rules, written for a first-time reader   |

When in doubt, `AGENTS.md` wins — everything else points back to it.
