# Where documentation lives

## The hierarchy

```text
docs/
├── architecture/
│   ├── README.md                 index — every doc below must be listed
│   ├── system-context.md         the system, its users, its externals
│   ├── module-architecture.md    ownership and dependency rules
│   ├── data-architecture.md      who owns which data, how it flows   (when needed)
│   ├── security/
│   │   ├── authentication.md     how a caller proves identity
│   │   └── authorization.md      what an identified caller may do
│   ├── integrations/             one file per significant external system (when needed)
│   └── modules/<module>.md       deep dive, only when the README is not enough
└── adr/
    ├── README.md                 policy + index of decisions
    └── NNNN-slug.md
```

Slots marked _(when needed)_ are intentionally absent until there is something
true to put in them. A stub reading "TBD" looks like an answer and is worse
than a missing file.

## Choosing the file

| The change is about                                    | It belongs in                |
| ------------------------------------------------------ | ---------------------------- |
| What the system is, or a new external dependency       | `system-context.md`          |
| A module boundary, ownership, or an allowed dependency | `module-architecture.md`     |
| Who may call what, and how that is decided             | `security/authorization.md`  |
| How a caller is identified                             | `security/authentication.md` |
| A schema that crosses module boundaries                | `data-architecture.md`       |
| One external provider's contract and failure modes     | `integrations/<provider>.md` |
| How one module works inside                            | that module's `README.md`    |
| Why a choice was made, when it was contested           | an ADR                       |

Two tests when it is genuinely unclear:

- **Does it cross a module boundary?** If no, it is a module README.
- **Would it still be true if the code were rewritten?** If yes, it is probably
  an ADR — decisions outlive implementations.

## Module READMEs

Every module has one. It describes that module's own API and internals:
endpoints, exported services, the schemas it owns. It does **not** restate the
architecture — it links to it.

## What this directory is not

- Not a changelog. Git has that.
- Not API reference. That is Swagger, plus whatever integration guides live in
  `docs/` for clients.
- Not a tutorial. Guides live in `docs/guides/`.
- Not aspiration. Document what is; put what should be in an issue.
