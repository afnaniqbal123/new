# AGENTS.md

Enforcement-level rules for any agent working in this repository. Short by
design — this file is read every session, so it holds only what changes what
you do. Teaching material lives under [`docs/`](docs/) and is linked from each
rule.

Claude Code additionally loads [`CLAUDE.md`](CLAUDE.md); the two do not
duplicate each other.

## Architecture is decided by humans

> Humans control architecture. AI agents execute within those boundaries.

Every architectural question left open is one you would answer again on every
task, differently each time. They are already answered — read, do not
re-decide. See the [agent-first contract](README.md#agent-first-engineering-philosophy).

## Before implementing

- **Read the boundaries.** [Module map](docs/architecture/module-architecture.md),
  [authentication](docs/architecture/security/authentication.md),
  [authorization](docs/architecture/security/authorization.md), [ADRs](docs/adr/README.md).
- **Use pnpm only.** The version is pinned by `package.json#packageManager` and
  `pnpm-lock.yaml` is the only supported dependency lockfile. See
  [ADR 0004](docs/adr/0004-pnpm-canonical-package-manager.md).
- **Put code where the map says**, not where it is convenient to reach.
- **Reuse the approved pattern** rather than inventing a parallel one.
- **No abstraction without a concrete need.** No interface, factory, or
  repository layer that removes no real coupling.

## Architecture-affecting work requires documentation

If a change alters **module ownership or boundaries, the authentication or
authorization model, persistence strategy, an external integration, or a
cross-cutting convention**, invoke the
[`architecture-documentation`](.claude/skills/architecture-documentation/SKILL.md)
skill and update the docs **in the same PR**.

Most changes are not architectural. Answering "no" is the common case.

## Use Wayfinder when the route is not clear

Use [`/wayfinder`](docs/guides/wayfinder.md) when making an issue
implementation-ready would mean **guessing an unresolved architectural or
product decision**. Use the normal issue workflow when ownership, constraints,
and acceptance criteria are already clear enough for one implementation path.

The rules that bind, when you do:

- **Name the destination first.** It fixes the scope; nothing else is decidable
  without it.
- **Wayfinder plans; it does not build.** Produce decisions, not deliverables.
  The pull to just do the work means you have reached the edge of the map —
  hand off.
- **Only ticket what you can state precisely now.** The rest stays as fog. The
  test is whether you can phrase the question, not whether you can answer it.
- **One non-research decision ticket per session**, in a fresh session. Do not
  carry one enormous context forward.
- **Claim before working** — assign the ticket to yourself first, or concurrent
  sessions collide.
- **The map is an index.** Detail lives in the ticket; the map gists and links.
- **Do not fork or wrap the skill.** It is managed by `npx skills` and
  `skills-lock.json`.

## The quality gate is not an obstacle

A failing check names the rule, the offending path, and the doc that explains
it. Treat it as architecture feedback.

Never silence a finding with `eslint-disable`, a baseline edit, or
`--no-verify`. If a rule genuinely needs to change, that is an
[ADR](docs/adr/README.md).

```bash
pnpm run verify   # all six stages
```

## Tests move with behaviour

Cover new behaviour at the lowest useful level; cover boundaries with
integration or e2e tests. A behaviour change without a test change is
incomplete.
