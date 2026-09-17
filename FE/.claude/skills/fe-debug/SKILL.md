---
name: fe-debug
description: Use when something is broken at runtime — a component renders wrong, state gets stale/inconsistent, a query refetches in a loop, a perceived performance regression — and the cause isn't obvious yet. A phased diagnosis loop for React/TanStack Query/Zustand bugs, distinct from fe-fix-commit which only handles quality-gate failures.
---

# Diagnosing a frontend runtime bug

Adapted from Matt Pocock's `diagnosing-bugs` skill for this stack. Use this for a bug
someone can reproduce but no one has explained yet. For a blocked commit (type/lint/a11y/test
failure), use `fe-fix-commit` instead — this skill is for bugs the quality gate doesn't catch.

## Procedure

1. **Reproduce first.** Get an exact, minimal repro (route, input, state) before touching
   code. If it can't be reproduced reliably, that inconsistency is itself the first clue —
   don't guess at a fix for something you can't trigger on demand.
2. **Narrow the layer.** This stack has a small number of places state actually lives — find
   which one is lying:
   - **Server state wrong/stale** — TanStack Query: check `queryKey` stability, `staleTime`,
     whether a mutation is invalidating the right key, and (since this boilerplate now toasts
     query errors globally) whether `meta.skipErrorToast` is masking a real failure.
   - **Client state wrong** — Zustand: check the store's selector usage (over-broad selectors
     re-render everything), and if it's `persist`-backed (like `authStore`), check whether
     stale persisted state is winning over a fresh fetch.
   - **Render/prop issue** — React: check key stability (never array index), effect deps,
     and whether a memoized value is comparing by reference when it should compare by value.
   - **Network/API layer** — check `src/services/api-client.ts` interceptors aren't silently
     swallowing or double-transforming the response, and that the Zod schema at the boundary
     actually matches what the API returns (a schema mismatch throws inside the query, which
     can look like an unrelated rendering bug).
3. **Form a hypothesis, then verify it with the smallest possible check** (a console assertion
   in dev, a targeted test, React DevTools) before writing the fix — don't fix-and-pray.
4. **Fix the root cause**, not the symptom — this repo's rule against `eslint-disable`/`as
any`/`@ts-ignore` applies here too; a suppressed type error is often the actual bug.
5. **Add a regression test** that would have caught this — the `*.workflow.test.tsx`
   convention (`AGENTS.md` § Testing), using `renderWithProviders` and the real failure
   mode, not a trivial happy path.

## Red flags that mean "stop and ask"

The fix requires changing a third-party library's behavior, touches auth/token handling, or
the "bug" turns out to be the test encoding the wrong expectation rather than the code being
wrong — surface it instead of guessing.
