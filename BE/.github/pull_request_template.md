## What and why

<!-- What changes, and what problem it solves. Link the issue. -->

Closes #

## Checks

- [ ] `pnpm run verify` passes (lint, conventions, types)
- [ ] `pnpm test` passes
- [ ] Tests cover the new behaviour, including its failure paths

## Touching authentication or authorization?

Delete this section if not. Otherwise, read
[`docs/architecture/security/authentication.md`](../docs/architecture/security/authentication.md)
first — it has a table of where each kind of change belongs — and confirm:

- [ ] No new route is authenticated by hand; `JwtAccessGuard` is global
- [ ] Any intentionally anonymous route says so with `@Public()`, and the PR says why
- [ ] Access tokens are still verified only in `JwtStrategy` and signed only in `TokenService`
- [ ] Nothing new reads the user collection to authenticate or to check a role
- [ ] 401 means "no valid identity"; 403 means "identity fine, not allowed"
- [ ] `test/auth/` still passes: `pnpm run test:e2e:auth`

If this PR needs a lint rule in `tools/eslint-rules/rules/auth.mjs` relaxed,
it is an architecture change — add an ADR under `docs/adr/` rather than
editing the rule.
