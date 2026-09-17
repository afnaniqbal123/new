---
name: fe-prototype
description: Use when the shape of a UI or a piece of state isn't decided yet and needs to be seen before it's built for real. Builds a throwaway prototype under a scratch route to answer one specific design/UI question, then is deleted — never merged, never wired into the quality gate.
---

# Prototyping a UI/state question

Adapted from Matt Pocock's `prototype` skill for this stack. A prototype answers ONE
concrete question ("does a multi-step form with a Zustand step-store feel right?", "what
does this table look like with 50 rows?") — it is not a first draft of the real feature.

## Rules

- Build it under a route not wired into `AppRouters.tsx`'s exported `router` (e.g. a local
  dev-only entry, or a component rendered directly in a scratch file) — it must never ship.
  Never add it to `src/routes/AppRouters.tsx`.
  It does not need tests, a README, or to pass `pnpm gate` — it is explicitly exempt from
  the boilerplate's normal component conventions while it stays a prototype.
- Use the real stack (Zustand/TanStack Query/RHF+Zod/Tailwind tokens) so the answer is
  representative — don't reach for a different library "just for the prototype."
- Keep it disposable: once the question is answered, either delete the prototype outright or
  hand its answer to `fe-component-scaffold` to build the real, tested version. A prototype
  is never "cleaned up into" the real feature in place — start the real feature fresh via
  `ExampleWidget`'s shape instead.

## Procedure

1. State the specific question the prototype needs to answer, in one sentence.
2. Build the smallest thing that answers it — real data shapes where it matters, fake data
   (or MSW) everywhere else.
3. Show it, get the answer to the question.
4. Delete the prototype or explicitly hand off to `fe-component-scaffold` — never leave it
   half-merged into the real tree.
