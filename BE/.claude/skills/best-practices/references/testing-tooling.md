# Testing & Code Quality Tooling

## Testing

### Unit Tests (`*.spec.ts`)

- Co-located next to the file under test: `notifications.service.spec.ts` sits beside `notifications.service.ts`.
- Run with `yarn test` (Jest, configured in `package.json`).
- Use `Test.createTestingModule` from `@nestjs/testing`.
- Each `describe` block maps to one class; each `it` block describes one behaviour.

### E2E Tests (`*.e2e-spec.ts`)

- Live in `test/` at the project root.
- Run with `yarn test:e2e`.
- Config in `test/jest-e2e.json`.

### Git Hooks

| Hook          | Runs                                                                      | Blocks?           |
| ------------- | ------------------------------------------------------------------------- | ----------------- |
| `pre-commit`  | The quality gate — guard rails, lint + conventions, type check, structure | Yes               |
| `commit-msg`  | commitlint (Conventional Commits)                                         | Yes               |
| `post-commit` | `jest --findRelatedTests` on the files just committed                     | No — reports only |

Tests run **after** the commit, not inside the gate, and only the suites that
import the changed files. A commit is a local checkpoint; making every one wait
on the full suite is what drives people to `--no-verify`. The full suite belongs
in CI.

If post-commit tests fail, fix the code and fold it in with
`git add -A && git commit --amend --no-edit`.

---

## Code Quality Tooling

| Tool                  | Config                                      | Purpose                                                                            |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| ESLint                | `eslint.config.mjs` (flat config, ESLint 9) | Static analysis with `typescript-eslint`                                           |
| Local ESLint plugin   | `tools/eslint-rules/`                       | The `nestjs/*` rules that enforce the conventions in this skill                    |
| Suppressions baseline | `eslint-suppressions.json`                  | Violations that pre-date the gate. New code must be clean; this list only shrinks. |
| Prettier              | `.prettierrc`                               | Formatting                                                                         |
| Husky                 | `.husky/*`                                  | Git hooks                                                                          |
| lint-staged           | `package.json → lint-staged`                | ESLint + Prettier on staged files                                                  |
| Gate scripts          | `scripts/hooks/`                            | Orchestration and reporting                                                        |

**Commands:**

| Command                | Does                                        |
| ---------------------- | ------------------------------------------- |
| `npm run verify`       | Run the gate across the whole repo          |
| `npm run typecheck`    | `tsc --noEmit`                              |
| `npm run lint:check`   | Lint without fixing                         |
| `npm run debt`         | What is left in the suppressions baseline   |
| `claude "/fix-commit"` | Have Claude fix whatever blocked the commit |

**The conventions in this skill are enforced automatically.** Each `nestjs/*`
rule maps to a section of these reference documents, and a blocked commit
prints the page to read. Never silence a finding with `eslint-disable`, by
editing `eslint-suppressions.json`, or with `git commit --no-verify` — fix the
code.

**Formatting rules (`.prettierrc`):**

- `singleQuote: true` — use single quotes everywhere
- `trailingComma: 'all'` — trailing commas in multi-line structures

**General rules:**

- Run `yarn lint` to auto-fix linting issues before pushing.
- Run `yarn format` to apply Prettier to all `src/**/*.ts` files.
- Do not disable ESLint rules with inline comments unless absolutely necessary, and always leave a comment explaining why.
- The `noImplicitAny` flag is `false` in `tsconfig.json` — however, **always provide explicit types** on function parameters, return types, and injected dependencies. Rely on inference only for obvious local variables.
