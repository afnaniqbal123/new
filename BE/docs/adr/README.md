# Architecture Decision Records

An ADR records _why_ a decision was made. The code shows what was decided; only
this says what the alternatives were and why they lost.

## The records

| #                                                          | Decision                                                         | Status   |
| ---------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| [0001](./0001-authentication-boundaries.md)                | Authentication boundaries                                        | Accepted |
| [0002](./0002-markdown-mermaid-canonical-documentation.md) | Markdown + Mermaid as the only architecture documentation format | Accepted |
| [0003](./0003-casl-canonical-authorization-engine.md)      | CASL as the canonical authorization engine                       | Accepted |
| [0004](./0004-pnpm-canonical-package-manager.md)           | pnpm as the canonical package manager                            | Accepted |
| [0005](./0005-region-anchored-module-generator.md)         | Region-anchored removal as the project generation strategy       | Accepted |
| [0006](./0006-schema-timestamps-exempt-embedded-subdocuments.md) | `require-schema-timestamps` exempts embedded subdocuments    | Accepted |
| [0007](./0007-public-product-assistant-endpoint.md)        | The product assistant is unauthenticated and has no data access  | Accepted |

## When an ADR is required

All three must be true:

1. **Hard to reverse** — changing your mind later costs real work.
2. **Surprising without context** — a future reader will look at the code and
   ask "why on earth is it done this way?"
3. **A genuine trade-off** — there were real alternatives and one was chosen
   for specific reasons.

If it is easy to reverse, skip it — you will just reverse it. If it is not
surprising, nobody will wonder. If there was no alternative, there is nothing
to record beyond "we did the obvious thing".

### Always an ADR

- Adopting a framework or library as canonical architecture
- Module ownership or boundary changes
- Authentication or authorization model changes
- Persistence or storage strategy changes
- Infrastructure or deployment strategy changes
- Major cross-cutting conventions

### Never an ADR

Routine implementation detail. Which loop you used, how a function is named,
anything a reader can see from the code and would not question.

## Format

Filename `NNNN-kebab-slug.md`, four digits, sequential — take the highest
number present and add one.

```md
# ADR 0002 — Short statement of the decision

- **Status:** Accepted
- **Date:** 2026-08-25
- **Tracking issue:** [#19](https://github.com/Gok-boilerplates/nestjs-backend/issues/19)

## Context

What forced a decision. The constraints, and what was actually observed —
not a general essay on the topic.

## Decision

What was chosen, stated plainly.

## Consequences

What this costs as well as what it buys. An ADR with only upsides is an
advertisement, not a record.
```

`Status` and `Date` are required and checked by `pnpm run docs:check`. Everything
below the header block is guidance: a three-sentence ADR that captures a real
trade-off beats a templated one that fills every heading and says nothing.

`Status` is one of `Accepted`, `Proposed`, `Deprecated`, or
`Superseded by ADR-NNNN`.

## Superseding

Do not edit a decision that turned out wrong — that erases the reasoning
someone may need. Write a new ADR, set the old one to
`Superseded by ADR-NNNN`, and link them both ways. The trail is the point.
