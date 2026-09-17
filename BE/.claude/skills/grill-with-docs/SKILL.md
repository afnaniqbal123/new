---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.
disable-model-invocation: true
---

Call the Skill tool twice, for "grilling" and "domain-modeling".

Any ADR produced follows the canonical policy in
[`docs/adr/README.md`](../../../docs/adr/README.md) — required `Status` and
`Date`, `NNNN-kebab-slug.md` filename, and a row added to the index table.
`npm run docs:check` enforces it.
