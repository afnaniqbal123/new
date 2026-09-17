# ADR 0004 — pnpm as the canonical package manager

- **Status:** Accepted
- **Date:** 2026-08-31
- **Tracking issue:** [#41](https://github.com/Gok-boilerplates/nestjs-backend/issues/41)

## Context

The repository had no explicit package-manager decision. Both `yarn.lock` and
`package-lock.json` were committed, `package.json` did not pin a package manager,
CI used npm, and contributor/agent instructions mixed npm and Yarn commands.

That ambiguity is costly in an agent-first repository. Every task can otherwise
re-decide how dependencies are installed, which lockfile is authoritative, and
which command CI should mirror. The result is avoidable lockfile churn,
different dependency-resolution behaviour, and review noise.

The realistic choices were:

- **Yarn v1.** Familiar to parts of the team, but a legacy generation with an
  older install model and weaker modern workspace/package-management ergonomics.
- **npm.** Universally available and simple, but less strict by default around
  undeclared dependency access and less efficient for repeated installs and
  future multi-package growth.
- **pnpm.** Strict dependency isolation, content-addressable storage,
  deterministic lockfiles, and strong workspace support fit a repository that
  is changed frequently by humans and automation.

This is a repository convention, not a claim that pnpm is universally superior.

## Decision

Use **pnpm** as the sole supported package manager.

- Pin the exact pnpm version in `package.json#packageManager`.
- Commit `pnpm-lock.yaml` as the only dependency lockfile.
- Remove `package-lock.json` and `yarn.lock`.
- Use `pnpm install --frozen-lockfile` in CI.
- Use pnpm commands in canonical contributor and agent documentation.
- Reject competing npm/Yarn lockfiles in the existing CI quality gate rather
  than introducing a standalone package-manager validation script.

## Consequences

### Positive

- Humans and agents have one dependency-management path to follow.
- CI and local installs use the same lockfile and package-manager version.
- pnpm's stricter dependency model exposes undeclared dependency assumptions
  earlier.
- Content-addressable storage reduces repeated-install disk usage and supports
  future workspace growth without changing package-manager strategy.

### Costs

- Contributors need pnpm available locally. Corepack or another supported pnpm
  installation method is a small onboarding requirement.
- pnpm's non-flat dependency layout can reveal packages that incorrectly relied
  on transitive dependencies being reachable.
- Existing npm/Yarn habits and commands must migrate once rather than remain as
  parallel supported paths.

## Migration and rollback

The migration lands atomically with the generated `pnpm-lock.yaml`, package
manager pin, CI updates, documentation changes, and removal of competing
lockfiles. No application runtime behaviour is intentionally changed.

If this decision must be reversed, record the replacement package manager in a
new ADR, regenerate its lockfile from the declared dependency graph, update CI
and canonical documentation in the same change, and supersede this ADR. Do not
re-introduce parallel package-manager support as an interim steady state.
