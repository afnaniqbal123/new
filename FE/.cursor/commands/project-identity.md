<!-- AUTO-GENERATED from .claude/commands — edit the source, then run `pnpm ai:sync`. -->

Propagate the project identity: $ARGUMENTS

Follow the `fe-project-identity` skill in `.claude/skills/fe-project-identity/SKILL.md`
exactly — this is a ONE-TIME, display-text-only rename, run early in a new project.

1. Confirm the project name, one-sentence description, and (only if the developer wants them
   renamed) portal display names — don't invent a portal name that wasn't given.
2. Update: `index.html`'s `<title>`, `package.json`'s `name`/`description`,
   `src/i18n/locales/en/common.json`'s `APP_NAME` (and `PORTAL_MEMBER_TITLE`/
   `PORTAL_ADMIN_TITLE` values only if portal names were given) — and the same keys in every
   other locale file that exists. Then grep the repo for the exact old `APP_NAME` string as a
   final check for any other hardcoded occurrence.
3. Verify with `pnpm check:i18n`, `pnpm check:types`, and
   `pnpm exec playwright test e2e/smoke.spec.ts` specifically, then a full `pnpm verify`.

**Never**: edit `AGENTS.md`'s rules/domain-agnostic framing, or rename the underlying
`Role.MEMBER`/`Role.ADMIN` enum, folders, or routes — a portal display name is text shown to a
user, not a structural rename. See the skill file's own § Boundaries for why conflating the
two is a real risk, and point the developer at the separate "adding/renaming a role" process
in `AGENTS.md` if that's genuinely what they want instead.
