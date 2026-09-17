# Architecture documentation

The canonical description of how this system is built. Start here.

Written and maintained under the
[`architecture-documentation`](../../.claude/skills/architecture-documentation/SKILL.md)
skill, which is mandatory for architecture-affecting work — see
[`CLAUDE.md`](../../CLAUDE.md).

## The documents

| Document                                                               | Answers                                                    |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`system-context.md`](./system-context.md)                             | What this system is, who uses it, what it depends on       |
| [`module-architecture.md`](./module-architecture.md)                   | Which module owns what, and which dependencies are allowed |
| [`security/authentication.md`](./security/authentication.md)           | How a request proves who it is                             |
| [`security/authorization.md`](./security/authorization.md)             | What an identified caller may do                           |
| [`integrations/email-providers.md`](./integrations/email-providers.md) | Which email provider sends, and what each one costs        |

Decisions live separately, in [`../adr/`](../adr/README.md). A document
describes how things _are_; an ADR records _why_ — and survives the code it
was written about.

## Where a new document goes

```text
docs/architecture/
├── README.md                 index — every doc below must appear in it
├── system-context.md         the system and its externals (C4 level 1)
├── module-architecture.md    modules, ownership, dependency rules (C4 level 2-3)
├── data-architecture.md      schemas, ownership of data, flows        (when needed)
├── security/                 authentication, authorization, boundaries
├── integrations/             one file per significant external system (when needed)
└── modules/                  deep-dive per module, when the module README is not enough
```

Slots marked _(when needed)_ deliberately do not exist yet. An empty document
that says "TBD" is worse than no document — it looks like an answer. Create one
when there is something true to write in it.

Per-module implementation detail belongs in that module's `README.md`, not
here. This directory is for what crosses module boundaries.

## The standard, in short

- **Markdown** for prose, **Mermaid** for diagrams. Not PlantUML, Structurizr,
  Draw.io, or an image of a whiteboard.
- **C4 concepts** for levels of zoom — context, container, component. The
  vocabulary, not the toolchain.
- **ADRs** for decisions that are hard to reverse and surprising without
  context.
- **Evidence, not assumption.** Every claim traces to code, configuration, or a
  recorded decision. If you cannot point at the thing, do not write it down.

The full rules are in the skill's
[references](../../.claude/skills/architecture-documentation/references/).

## Checked, not just written

```bash
pnpm run docs:check
```

Runs as stage 6 of `pnpm run verify` and in CI. It verifies relative links
resolve, Mermaid blocks pass a structural sanity check (known diagram type,
balanced brackets — **not** a parse), ADRs are named and structured per policy,
and every document here appears in the table above.

It checks facts, not prose. Nothing in it has an opinion about your wording.
