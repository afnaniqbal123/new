# Backend guide

A readable layer over the documentation that already lives in this repo. Five
self-contained HTML pages — no build step, no dependencies, no network calls
except a Google Fonts stylesheet. Open any of them straight from disk.

```bash
open docs/guide/index.html          # macOS
xdg-open docs/guide/index.html      # Linux
```

## The pages

| Page                                         | Answers                                                          |
| -------------------------------------------- | ---------------------------------------------------------------- |
| [`index.html`](./index.html)                 | Which page do I want, and what shape is this repo in?            |
| [`start.html`](./start.html)                 | How do I get a repo — a new project, or the toolkit in mine?     |
| [`quickstart.html`](./quickstart.html)       | How do I run it and ship my first endpoint?                      |
| [`architecture.html`](./architecture.html)   | How is it put together, and why?                                 |
| [`api-reference.html`](./api-reference.html) | What endpoints exist, and what guards each one?                  |
| [`skills.html`](./skills.html)               | Which agent skills does this repo ship, and when does each fire? |

Every page links to the others, so any entry point works. `index.html` is the
one to share with someone new.

## What is in them

- **Quickstart** — install and `.env`, every environment variable grouped by
  module, the commands you actually use, anatomy of a module, a worked first
  endpoint, the six-stage commit gate, and a troubleshooting table.
- **Architecture** — system context, the module map, per-module ownership
  (owns / does not own / exposes), the request lifecycle, authentication and
  authorization in detail, the nine dependency rules, enforcement, and the full
  debt register.
- **API Reference** — all 90 routes across 16 controllers, each with its
  authentication model, request shape, and caveats. Plus the four modules with
  no HTTP surface, and an audit of what is currently open.
- **Agent Skills** — the 19 skills in [`.claude/skills/`](../../.claude/skills/),
  what each does, whether it fires automatically or only when you type
  `/name`, the four Claude Code hooks, and how skill conflicts are settled.

## Relationship to the rest of `docs/`

These pages **describe**; they do not decide. The canonical, CI-checked sources
are:

| Source                                                   | Owns                                             |
| -------------------------------------------------------- | ------------------------------------------------ |
| [`../architecture/`](../architecture/README.md)          | Module boundaries, ownership, the security model |
| [`../adr/`](../adr/README.md)                            | Decisions, and why they were made                |
| [`../quality-gate.md`](../quality-gate.md)               | The commit gate and the convention rules         |
| [`../guides/permissions.md`](../guides/permissions.md)   | Writing authorization policies                   |
| [`../agents/skills-guide.md`](../agents/skills-guide.md) | The plain-English skills guide                   |

**When these pages and the sources above disagree, the sources win.** Nothing
here is checked by `pnpm run docs:check` — it verifies Markdown, not HTML — so
treat a mismatch as a bug in this folder.

## Regenerating

The pages are hand-written against the code rather than generated, so there is
no script to re-run. The counts they quote (90 routes, 16 controllers, 12
modules, 19 skills) were taken from `src/` and `.claude/skills/` directly. If
you add a module or a route, update the affected page in the same PR — the same
rule [`CLAUDE.md`](../../CLAUDE.md) applies to architecture documentation.

Verify a route count with:

```bash
grep -rhcE "^\s*@(Get|Post|Put|Patch|Delete|Sse)\(" \
  $(find src -name '*.controller.ts' ! -name '*.spec.ts') | paste -sd+ | bc
```

## Known gaps recorded in these pages

They document the repo honestly, including its problems. The three that matter
most:

- The chat WebSocket handshake and the notifications SSE stream are both
  **unauthenticated** — each trusts a client-supplied user id.
- `POST /users` and `GET /users` carry **no permission check**.
- Outside `/auth/*`, failures return **HTTP 200** with the real status in the
  body.

All three are on the debt register in
[`../architecture/module-architecture.md`](../architecture/module-architecture.md).
