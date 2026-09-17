# CLAUDE.md

## Agent skills

All skills below live in `.claude/skills/` and are committed to this repo, so anyone who clones it gets them
automatically — no plugin install required. For a plain-English guide to every skill (what it does, when to use it,
example commands), see [`docs/agents/skills-guide.md`](docs/agents/skills-guide.md).

### Issue tracker

Issues live in GitHub Issues on `Gok-boilerplates/nestjs-backend`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim as label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Planning work whose route is not yet clear

Use [`/wayfinder`](docs/guides/wayfinder.md) when making an issue
implementation-ready would mean guessing an unresolved architectural or product
decision. Use the normal issue workflow when the path is already clear.

Enforcement rules are in [`AGENTS.md`](AGENTS.md); the guide teaches the
workflow. Do not fork or wrap the skill — it is managed by `npx skills`.

## Architecture documentation is mandatory for architecture-affecting work

If a change alters **module ownership or boundaries, the authentication or
authorization model, persistence strategy, an external integration, or a
cross-cutting convention**, you MUST invoke the
[`architecture-documentation`](.claude/skills/architecture-documentation/SKILL.md)
skill and update the documentation in the same PR.

Not afterwards, and not in a follow-up issue. Documentation that lags the code
is worse than none, because people trust it and are wrong.

The skill decides where the doc goes, whether an ADR is required, and whether a
diagram earns its place. Do not make those choices independently — that is the
drift it exists to prevent.

- Index: [`docs/architecture/README.md`](docs/architecture/README.md)
- Decisions: [`docs/adr/README.md`](docs/adr/README.md)
- Checked by `pnpm run docs:check` (stage 6 of `pnpm run verify`, and CI)

Most changes are not architectural. Answering "no" to the question above is the
common and correct case.
