<!-- AUTO-GENERATED from .claude/commands — edit the source, then run `pnpm ai:sync`. -->

Generate frontend API integration documentation for the spec at: $ARGUMENTS

Follow the `fe-api-guide` skill in `.claude/skills/fe-api-guide/SKILL.md`.

Produce, under `docs/api/`:

1. A consolidated Markdown reference of every endpoint (method, path, params, request/response types).
2. Suggested entries for the relevant portal/concern's `src/constants/<concern>.ts` route
   enum and `src/schemas/<concern>/` Zod contracts.
3. A per-module README for each backend service area.

Keep everything domain-accurate to the provided spec. Do not invent endpoints.
