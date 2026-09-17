# CLAUDE.md

@AGENTS.md

## Claude-Code-specific notes

- The rules above come entirely from `AGENTS.md` (imported, not duplicated). Edit rules
  there — never here.
- Use the `/fix-commit`, `/fe-api-guide`, `/new-component`, `/new-feature`, `/new-page`,
  `/a11y-audit`, `/perf-audit`, `/code-review`, `/theme-setup`, `/debug`, `/prototype`, and
  `/project-identity` commands in `.claude/commands/`. See each file for usage.
- Deeper playbooks are Agent Skills in `.claude/skills/` (`fe-fix-commit`, `fe-api-guide`,
  `fe-component-scaffold`, `fe-page-scaffold`, `fe-a11y-audit`, `fe-prototype`, `fe-debug`,
  `fe-theme-setup`, `fe-project-identity`).
- `AGENTS.md` is the full rulebook; `docs/GUIDE.md` is the friendlier walkthrough with the
  same rules explained end to end. Read one of the two before writing or editing any component.
- Git/commit/execution boundaries: see `AGENTS.md` § Agent Execution Safety and § Never Do.
- After changing any `.claude/commands/*.md`, run `pnpm ai:sync` so Cursor's mirror stays current
  (`pnpm ai:check` — part of `pnpm verify` — fails CI if you forget).
