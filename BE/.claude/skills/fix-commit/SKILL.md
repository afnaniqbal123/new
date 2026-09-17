---
name: fix-commit
description: Fix everything blocking a commit — pre-commit quality gate failures (lint, project conventions, type errors, secrets, structure), commit-message rejections, and post-commit test failures. Use when a commit was blocked or the developer runs /fix-commit, and when paying down baselined convention debt with --debt.
---

# Fix a blocked commit

The pre-commit gate (`scripts/hooks/pre-commit.mjs`) blocked a commit, a
commit message was rejected, or post-commit tests failed. Fix the underlying
code so the commit succeeds — never bypass the gate.

## Absolute rules

- **Never run `git commit --no-verify`**, never edit `eslint-suppressions.json`
  by hand, never add `// eslint-disable` to silence a finding, and never
  loosen a rule in `eslint.config.mjs`. Those hide the problem instead of
  fixing it. If a rule is genuinely wrong for a case, say so and ask the
  developer — do not disable it yourself.
- **Never commit on the developer's behalf** unless they explicitly asked you
  to. Fix, re-stage, verify, then report.
- Fix the _code_, not the check.

## 1. Find out what failed

The gate writes a machine-readable report of its last failure:

```bash
cat .git/quality-gate/last-failure.json
```

If that file is missing or stale, reproduce the failure directly:

```bash
npm run verify        # the full gate across the repository
npm run typecheck     # type errors only
npm run lint:check    # lint and convention violations only
npx jest --silent     # tests
```

## 2. Fix each finding

Findings fall into five groups. Every convention finding names the reference
page that documents the rule — read it before fixing, and follow the pattern
that already exists in neighbouring modules rather than inventing a new one.

### Guard rails (secrets, `.env`, build output, conflict markers)

The most serious category. A credential that reaches git history must be
rotated, so **stop and tell the developer** rather than quietly rewriting.

- Staged `.env` file → `git restore --staged <file>`, then make sure the keys
  (names only, no values) are documented in `.env.example`.
- Hard-coded secret → move the value to `.env`, add the key to the `CONFIG`
  enum in `src/constants/config.constant.ts`, read it with
  `ConfigService.get<string>(CONFIG.KEY)`, and tell the developer the exposed
  credential should be rotated.
- Conflict markers → finish resolving the merge.

### Project conventions (`nestjs/*` rules)

Read `.claude/skills/best-practices/` and apply the documented pattern:

| Rule                              | Fix                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-raw-http-exception`           | Replace `throw new XException(...)` with `SerializeHttpError(null, HttpStatus.X, SOME_ERRORS.Y)`. Add the message to the module's error enum if it does not exist.                                            |
| `no-hardcoded-message`            | Move the inline string into a `*_SUCCESS` / `*_ERRORS` enum under the module's `constants/api-response/` (or `constants/errors.ts` / `constants/success.ts`) and pass the enum member.                        |
| `require-api-property`            | Add `@ApiProperty()` (or `@ApiPropertyOptional()` for optional fields) to the DTO field.                                                                                                                      |
| `require-dto-validation`          | Add the correct `class-validator` decorator for the field's type.                                                                                                                                             |
| `require-api-tags`                | Add `@ApiTags('Feature')` to the controller class.                                                                                                                                                            |
| `require-api-bearer-auth`         | Add `@ApiBearerAuth()` above the HTTP verb decorator on the guarded endpoint.                                                                                                                                 |
| `no-raw-request-decorator`        | Replace `@Req()` with `@GetUser()`, `@GetUser('id')` or `@GetOrganizationId()`. If the raw request is genuinely required (Stripe/PayPal webhook signature verification), say so and ask — do not force a fix. |
| `no-db-in-controller`             | Move the query into the matching service and call the service from the controller.                                                                                                                            |
| `no-process-env`                  | Add the key to the `CONFIG` enum and read it with `ConfigService`.                                                                                                                                            |
| `require-schema-timestamps`       | Pass `{ timestamps: true }` to `@Schema()`.                                                                                                                                                                   |
| `no-cross-module-relative-import` | Use the absolute `src/...` path.                                                                                                                                                                              |

### Type errors

Fix the actual type. Do not paper over it with `as any`, non-null `!`, or
`@ts-ignore` — those are how the errors got there in the first place.

### Structure and naming

Rename files/folders to kebab-case with the right suffix (see
`references/naming.md`), or write the missing module `README.md` documenting
what the module does and what it exposes.

### Commit message

Rewrite it as Conventional Commits: `<type>(<scope>): <subject>`, lower-case
subject, no trailing period, under 72 characters. The developer re-runs their
`git commit` with the corrected message.

### Failing tests

A post-commit failure means the commit exists but is broken. Fix the code (or
the test, if the test encodes the wrong expectation), then tell the developer
to fold the fix in with `git add -A && git commit --amend --no-edit`.

## 3. Re-stage and verify

Re-stage only the files that were already part of the commit, then confirm the
gate is green:

```bash
git add <the files you fixed>
npm run verify
```

Report what you changed, anything you deliberately did not change and why, and
whether the developer can now re-run their `git commit`.

## Paying down baselined debt (`--debt <rule>`)

`eslint-suppressions.json` holds violations that pre-date the gate. New code
is held to the full standard; this backlog shrinks deliberately.

```bash
npm run debt                      # what is left, ranked by rule
npx eslint 'src/**/*.ts' --no-suppressions --rule-filter <rule>
```

Work **one rule at a time**, in small reviewable batches:

1. Fix every occurrence of that rule.
2. Run `npm run lint:baseline:prune` to drop the suppressions now unused.
3. Run `npm run verify` and `npx jest` to prove nothing regressed.
4. Commit as `refactor(lint): <rule description>`.

Never regenerate the whole baseline with `--suppress-all` to make a failure go
away; that silently re-suppresses new violations too.
