---
description: Build a throwaway prototype to answer one specific UI/state design question before building the real feature.
argument-hint: '<the one question the prototype needs to answer>'
allowed-tools: Read, Write, Bash(pnpm run *)
---

Build a scratch prototype to answer: $ARGUMENTS

Follow the `fe-prototype` skill in `.claude/skills/fe-prototype/SKILL.md` exactly. A prototype
is never merged, never added to `src/routes/AppRouters.tsx`'s exported router, and is exempt
from the normal component conventions (no test, no README, no `pnpm verify`) while it stays a
prototype.

1. State the one specific question this needs to answer, in one sentence.
2. Build the smallest thing that answers it, using the real stack (Zustand/TanStack Query/
   RHF+Zod/Tailwind tokens — not a substitute library) so the answer is representative.
3. Show it, get the answer to the question.
4. Delete it, or hand off to `/new-component`/`/new-feature` to build the real, tested
   version — never leave it half-merged into the real tree.
