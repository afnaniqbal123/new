# ADR 0005 — Region-anchored removal as the project generation strategy

- **Status:** Accepted
- **Date:** 2026-09-08

## Context

This repository is a boilerplate: teams start new services from it. Most start
by cloning it and deleting the modules they do not want. That deletion is
larger than it looks — a module is not only its folder. Removing `stripe` also
means editing `src/app.module.ts`, `src/constants/config.constant.ts`,
`src/scripts/seed.ts`, `.env.example`, and `package.json`. Miss one and the
project fails to boot, or ships env keys for a provider it never calls.

Doing that by hand, per project, is how every generated project ends up
slightly different from every other one — which defeats the point of a
boilerplate.

Not every module can be removed. Measured against the real import graph
(`scripts/architecture/graph.mjs`), five are imported by other modules rather
than only by `app.module.ts`:

| Module          | Imported by             |
| --------------- | ----------------------- |
| `auth`          | six modules             |
| `user`          | five modules            |
| `media`         | `auth`, `email`, `user` |
| `email`         | `auth`, `user`          |
| `authorization` | `stripe`, `user`        |

Removing any of those does not produce a smaller project; it produces one that
does not compile.

## Decision

Optional modules are removed by a generator driven by a declarative manifest.

- `scripts/modules.manifest.mjs` records each optional module's footprint:
  folders, an anchor tag, npm dependencies, and inter-module dependencies.
- Shared files carry `// #region module:<key>` / `// #endregion module:<key>`
  anchors (`# #region` in `.env.example`) around the lines belonging to that
  module.
- `scripts/setup.mjs` copies the template to a new folder, then deletes the
  folders, strips the anchored regions, and prunes the dependencies of every
  module that was not selected.
- `create.sh` fetches the template through `gh` and runs the wizard, so a
  developer never clones the boilerplate at all.

The five modules above are listed as core and are not offered as choices.

**Anyone adding a new optional module must add its anchors and its manifest
entry in the same change.** That is the cross-cutting obligation this decision
creates.

## Consequences

What this buys: every generated project is the boilerplate minus an exact,
recorded set of modules, rather than minus whatever someone remembered to
delete. Removal touches config, env, dependencies and the seed script, not just
the folder — the parts most often missed by hand.

What it costs:

**The anchors are comments, and nothing enforces them.** A module added without
anchors will silently appear in every generated project, and the failure is
invisible until someone wonders why they got a module they did not tick. The
wizard verifies that anchors are _balanced_ before it writes anything, but it
cannot know about an anchor that was never written. This is real debt, recorded
in [`module-architecture.md`](../architecture/module-architecture.md#optional-modules-and-the-generator).

**The manifest is a second module map.** `module-architecture.md` describes
ownership in prose; `modules.manifest.mjs` encodes part of the same thing in
code. They can drift, and only the second one is executable.

**The generator itself is unverified by the gate.** `eslint.config.mjs` ignores
`scripts/**`, and the Jest config only matches `*.spec.ts`, so `setup.mjs` is
neither linted nor unit-tested. It is exercised end to end by generating a
project and running `pnpm run verify` inside it, which is a real check but a
manual one.

**A generated project ships without a lockfile when dependencies were pruned.**
`pnpm-lock.yaml` still pins the removed packages, and `pnpm install
--frozen-lockfile` — what the copied CI runs — rejects that outright. Rewriting
pnpm's lockfile by hand is not something to attempt, so the file is dropped and
the first `pnpm install` writes a correct one.

## Alternatives rejected

**A branch or repository per module combination.** Six optional modules is 64
combinations, and each one drifts from the others the moment anyone fixes a bug
in only the branch they are working on.

**Schematics that generate modules into an empty project.** This inverts the
value: the boilerplate's worth is code that has been run and tested together,
not templates that produce untested code. Generating `stripe` fresh gives you
something no one has exercised.

**Extracting modules into optional packages in a monorepo.** Cleaner in
principle, and it would make `email` and `media` genuinely optional. It also
requires decoupling `auth` and `user` from them first — a much larger change
than the problem currently justifies. If that decoupling ever happens for other
reasons, this decision is worth revisiting.

**Leaving it manual and writing a checklist.** A checklist is a convention with
nothing executing it, which is the situation this ADR exists to replace.
