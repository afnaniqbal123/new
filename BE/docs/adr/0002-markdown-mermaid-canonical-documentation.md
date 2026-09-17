# ADR 0002 — Markdown and Mermaid as the only architecture documentation format

- **Status:** Accepted
- **Date:** 2026-08-25
- **Tracking issue:** [#20](https://github.com/Gok-boilerplates/nestjs-backend/issues/20)

## Context

Most code in this repository is written by AI agents, and architecture
documentation had no enforced workflow. Every agent could independently decide
where a document belongs, which diagram format to use, when an ADR is required,
and how to update what already exists. Each answer is locally reasonable and
they do not agree with each other, which is how documentation drifts away from
the code it describes.

The workflow we adapted —
[`davila7/claude-code-templates`](https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/commands/documentation/create-architecture-documentation.md)
— explicitly offers a choice between C4, Arc42, ADRs, PlantUML, Structurizr and
Draw.io. For a human team picking a house style once, that menu is the point.
For agents deciding per task, it is the drift itself.

## Decision

One format, no choice:

- **Markdown** for prose, **Mermaid** inline for diagrams.
- **C4 concepts** — context, container, component — as vocabulary for levels of
  zoom, not as a toolchain.
- **ADRs** in `docs/adr/`, policy in `docs/adr/README.md`, required for
  decisions that are hard to reverse, surprising, and a real trade-off.
- **Evidence over assumption**: every claim traces to code, configuration, or a
  recorded decision.

Encoded in the `architecture-documentation` skill, made mandatory for
architecture-affecting work by `CLAUDE.md`, and mechanically checked by
`pnpm run docs:check` as stage 6 of the quality gate.

## Alternatives rejected

**Keep the upstream menu.** Rejected: the choice is the problem. A repository
where one document is PlantUML and the next is Structurizr has no standard, it
has a history of preferences.

**Structurizr or another C4 toolchain.** Genuinely better diagrams, and
rejected anyway — it needs a build step, and diagrams stop rendering in a PR
diff. A diagram nobody sees during review is a diagram nobody corrects. Mermaid
renders natively on GitHub, which makes it reviewable, and reviewable beats
prettier.

**Arc42.** A strong template for a large system documented up front. This is a
starter kit whose modules are deleted as often as extended; most of the
template would be empty headings, and an empty heading looks like an answer.

**Convention without enforcement.** This is what we had. It produced two
architecture documents at the top level, no index, and an ADR policy that
disagreed with the only ADR in the repository.

## Consequences

**Gained.** One place to look, one format to read, one threshold for an ADR.
Broken links, unrenderable diagrams, and malformed ADRs fail the build instead
of being noticed months later. Agents stop re-deciding a settled question.

**Accepted.** Mermaid is weaker than a dedicated C4 tool — no auto-layout, no
model reuse, and large diagrams get unwieldy. The mitigation is a policy of
small single-purpose diagrams, which is better practice regardless.

`docs:check` verifies facts, not truth. A document can pass every check and
still describe a system that does not exist. It narrows the failure mode from
"wrong and broken" to "wrong"; catching wrong is still a reviewer's job.

Changing this standard means superseding this ADR, not quietly adding a
`.puml` file.
