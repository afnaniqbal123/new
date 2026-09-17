<!-- AUTO-GENERATED from .claude/commands — edit the source, then run `pnpm ai:sync`. -->

Diagnose and fix this runtime bug: $ARGUMENTS

Follow the `fe-debug` skill in `.claude/skills/fe-debug/SKILL.md` exactly — this is for a bug
the quality gate doesn't catch (wrong behavior at runtime, not a blocked commit). For a
blocked commit instead, use `/fix-commit`.

1. Get an exact, minimal repro (route, input, state) before touching any code.
2. Narrow to the layer that's actually lying: TanStack Query (server state — query keys,
   invalidation, `meta.skipErrorToast`), Zustand (client state — selector scope, persisted
   state winning over a fresh fetch), React (render — key stability, effect deps, memoization),
   or the Axios/Zod boundary (`src/services/api-client.ts` interceptors, schema mismatches).
3. Form a hypothesis, verify it with the smallest possible check before writing the fix.
4. Fix the root cause — never suppress with `eslint-disable`/`as any`/`@ts-ignore`.
5. Add a regression test using `renderWithProviders` and the real failure mode, not a trivial
   happy path.

Stop and ask before proceeding if the fix would require changing a third-party library's
behavior, touches auth/token handling, or the "bug" turns out to be a wrong test expectation
rather than wrong code.
