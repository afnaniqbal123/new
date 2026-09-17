# Quality Gate

Automated enforcement of this project's coding standards. It runs on every
commit so non-compliant code cannot land by accident, and so conventions are
caught in seconds by a tool rather than days later in review.

The standards themselves live in `.claude/skills/best-practices/` (how code is
written) and `docs/architecture/` (how modules relate). This document describes
how both are enforced.

---

## What runs, and when

### `pre-commit` — blocks the commit

| #   | Stage                  | Checks                                                                                                                                         | Typical |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **Guard rails**        | Staged `.env` files, hard-coded credentials, build output, files over 1 MB, unresolved merge-conflict markers                                  | <1s     |
| 2   | **Lint & conventions** | `eslint --fix` + `prettier --write` on staged files, then the strict gate: TypeScript correctness rules and the 15 `nestjs/*` convention rules | 2–5s    |
| 3   | **Type safety**        | `tsc --noEmit` across the project                                                                                                              | ~2s     |
| 4   | **Structure**          | File/folder naming, folder–suffix agreement, README for new modules                                                                            | <1s     |
| 5   | **Architecture**       | Module dependency cycles, foreign schema reads, provider-SDK leakage — ratcheted against `architecture-baseline.json`                          | <1s     |
| 6   | **Documentation**      | Relative links resolve, Mermaid sanity check, ADR naming/required fields, architecture index completeness                                      | <1s     |

Stage 2 **fixes what it can** — formatting, quote style, import order, and
every auto-fixable rule — and re-stages the result. You only ever see what
needs a human decision.

Every stage runs even after one fails, so a blocked commit shows the complete
list of problems in one pass.

### `commit-msg` — blocks the commit

Conventional Commits, via commitlint. A rejection prints the format, the
allowed types, and working examples.

### `post-commit` — reports, never blocks

`jest --findRelatedTests` on the files just committed — only the suites that
actually import them. Changing one service runs 2 suites in ~2s, not the whole
project.

Tests deliberately run _after_ the commit. A commit is a local checkpoint;
making every one wait on Jest is what pushes people towards `--no-verify`. The
full suite is CI's job.

If it reports failures, fix them and fold the fix into the same commit:

```bash
git add -A && git commit --amend --no-edit
```

---

## The convention rules

Fifteen custom ESLint rules in `tools/eslint-rules/` encode the
`best-practices` skill. They are ESLint rules rather than a bespoke script for
a reason: violations appear **live in your editor as you type**, not only when
you try to commit.

| Rule                              | Enforces                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `no-raw-http-exception`           | Errors go through `SerializeHttpError`, keeping the `{ data, status, message }` envelope |
| `no-hardcoded-message`            | User-facing messages come from an `api-response` enum                                    |
| `require-api-property`            | Every DTO field has `@ApiProperty()`                                                     |
| `require-dto-validation`          | Every DTO field has a `class-validator` decorator                                        |
| `dto-class-suffix`                | Classes in `dto/` end in `Dto`                                                           |
| `require-api-tags`                | Every controller has `@ApiTags()`                                                        |
| `require-api-bearer-auth`         | Guarded endpoints declare `@ApiBearerAuth()`                                             |
| `no-db-in-controller`             | Controllers stay thin — no injected models                                               |
| `no-raw-request-decorator`        | `@GetUser()` instead of `@Req()`                                                         |
| `require-schema-timestamps`       | `@Schema({ timestamps: true })`                                                          |
| `require-schema-exports`          | Schema files export class, schema and document type                                      |
| `no-process-env`                  | Config read via `ConfigService` + the `CONFIG` enum                                      |
| `no-cross-module-relative-import` | Absolute `src/...` paths across module boundaries                                        |
| `no-barrel-file`                  | No `index.ts` barrels                                                                    |
| `no-focused-tests`                | No `.only` / `fdescribe` reaching CI                                                     |

---

## The suppressions baseline

`eslint-suppressions.json` records the violations that already existed when the
gate was introduced (219 at the time of writing). It is a **ratchet**:

- New and changed code must be fully clean.
- Pre-existing violations do not block anyone's unrelated work.
- The list can only shrink — a new violation is never suppressed automatically.

See what is left:

```bash
pnpm run debt
```

Pay some down, one rule at a time:

```bash
claude "/fix-commit --debt nestjs/no-raw-http-exception"
pnpm run lint:baseline:prune   # drop suppressions that are now unused
```

Never run `--suppress-all` to make a failure go away; it re-suppresses new
violations along with the old ones.

---

## When a commit is blocked

Every finding tells you the file, the line, what is wrong, the concrete fix,
and the convention page that explains it. To have Claude apply the fixes:

```bash
claude "/fix-commit"
```

Or work through it yourself:

```bash
pnpm run lint         # auto-fix formatting and simple rules
pnpm run typecheck    # every type error
pnpm run lint:check   # lint and convention violations
pnpm run verify       # re-run the gate across the repo
```

---

## Escape hatches

There is deliberately almost no way around this.

- **`git commit --no-verify`** skips every hook. It exists for genuine
  emergencies. Anything committed this way still fails CI, so it buys minutes,
  not permission.
- **A false positive on a secret** — append `quality-gate:allow` to the line.
- **A rule that is genuinely wrong for a case** — raise it with the team and
  change the rule in `tools/eslint-rules/`. Do not add `eslint-disable`, and do
  not hand-edit the suppressions file; both hide the problem from everyone else.

---

## Setup

Hooks install automatically via the `prepare` script on `pnpm install`. If they
are not running:

```bash
pnpm run prepare
git config core.hooksPath   # should print .husky/_
```

---

## Architecture debt: the same ratchet, one level up

Stage 5 applies the suppressions idea to module boundaries.

```text
Existing debt
    ↓
Recorded in architecture-baseline.json
    ↓
New violations block the commit
    ↓
Refactoring removes old entries
    ↓
The baseline only shrinks
```

Entries are keyed by **file**, not by rule, so a new file cannot inherit an
existing exception — `modules/auth` already reading `user.schema.ts` does not
license the next file to do the same.

```bash
pnpm run architecture:check      # what stage 5 runs
pnpm run architecture:baseline   # re-record what remains, after resolving one
```

Failures name the rule, the import path that caused it, and the expected
direction — enough for an agent to correct itself rather than invent a
workaround. Adding a _new_ exception means documenting it in
[`docs/architecture/module-architecture.md`](architecture/module-architecture.md) first; regenerating
the baseline to silence a fresh violation is the same mistake as editing the
lint suppressions.

---

## Documentation checks

Stage 6 verifies facts about the docs, never prose.

```bash
pnpm run docs:check   # what stage 6 runs
pnpm run docs:test    # the checker's own tests, against fixture trees
```

| Check                        | Catches                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| Relative links resolve       | A document moved and the links to it did not                           |
| Mermaid sanity (not a parse) | Empty blocks, unknown diagram types, unbalanced brackets               |
| ADR naming and fields        | Missing `Status`/`Date`, wrong filename, number missing from the title |
| Architecture index           | A document nobody linked, so nobody finds                              |

It has no opinion about wording. **Passing it is not evidence the
documentation is correct** — a page can pass every check and still describe a
system that does not exist. That is what review is for; see
[`.claude/skills/architecture-documentation/`](../.claude/skills/architecture-documentation/SKILL.md).

---

## Security scanning: what runs, and what does not

Three layers were intended. Two exist.

| Layer                     | Catches                                                                    | Status                                                             |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ESLint + `nestjs/*` rules | Project invariants — auth boundaries, module boundaries, response envelope | **Active**, stages 2 and 5                                         |
| Dependabot                | Known-vulnerable and outdated dependencies                                 | **Active** — [`.github/dependabot.yml`](../.github/dependabot.yml) |
| CodeQL                    | Semantic security analysis (injection, taint flow)                         | **Blocked by GitHub entitlement**                                  |

### Why there is no CodeQL workflow

Not an oversight, and not something to "fix" by adding one. Code scanning
needs GitHub Advanced Security, which is not available for a **private**
repository on a **free** organisation plan. Verified against the API rather
than assumed:

```console
$ gh api repos/Gok-boilerplates/nestjs-backend/code-scanning/default-setup
{
  "message": "Advanced Security must be enabled for this repository to use code scanning.",
  "status": "403"
}
```

A CodeQL workflow committed today would initialise, analyse, then fail at the
upload step on every run — a permanently red check that teaches people to
ignore red checks. That is worse than no workflow, so there isn't one.
Tracked in [#24](https://github.com/Gok-boilerplates/nestjs-backend/issues/24),
which stays open and blocked.

**It unblocks when any one of these is true:** the organisation moves to a plan
including GitHub Advanced Security, the repository becomes public (code
scanning is free for public repositories), or GitHub changes the entitlement.
At that point the workflow is a small, well-documented addition — the analysis
is done, only the platform is missing.

### Dependabot alerts are a separate, account-side switch

`.github/dependabot.yml` configures **version updates** — the routine
"a newer release exists" PRs. It does not enable **security alerts**, which are
a repository setting rather than a file, and are currently **off**:

```console
$ gh api repos/Gok-boilerplates/nestjs-backend/vulnerability-alerts   # 404: disabled
$ gh api repos/Gok-boilerplates/nestjs-backend/automated-security-fixes
{ "enabled": false }
```

Turn both on under **Settings → Code security**. They are free for private
repositories and are the half that tells you a dependency is _vulnerable_
rather than merely _old_.
