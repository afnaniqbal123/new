# Services

`api-client.ts` and `queryClient.ts` live directly at `src/services/` root —
cross-cutting infrastructure every concern's service depends on, not a "concern" of
their own (the same reasoning that keeps `src/lib/utils.ts` and `src/constants/`
un-concern-scoped). Everything else — a real API client for one concern — lives under
`src/services/<concern>/`, the same `<concern>`-folder convention already used by
`src/hooks/<concern>/`: `auth/authService.ts` and `common/exampleService.ts` are the ones
that exist today.

**Hard rule: every `src/hooks/<concern>/` hook's `queryFn`/`mutationFn` calls a function
from a matching `src/services/<concern>/` file — a hook never calls `apiClient`
directly.** This used to be an exception for `src/components/example/` (its hooks called
`apiClient` inline, with no service file) — that shape was a mistake, not a deliberate
carve-out: `exampleService.ts` now exists and every one of `ExampleWidget`'s hooks calls
into it, exactly like `authService.ts`/`useAuth.ts`. There is no remaining exception to
this rule. A role's own concern folder (e.g. `services/member/`) doesn't exist until that
role has a real endpoint — same "stays empty until needed" precedent as
`src/hooks/admin/`/`src/hooks/member/`.

## Rules

- One file per external API surface, one typed method per endpoint (see
  `auth/authService.ts`).
- Every call goes through `apiClient` (`src/services/api-client.ts`) — never a raw
  `fetch`/a new axios instance.
- The service function itself is the boundary: it makes the HTTP call _and_ runs the
  Zod `.parse()` that validates the response, before returning typed data. The calling
  hook trusts that return value — it does not re-validate.
- Called only from a `src/hooks/<concern>/` hook (never straight from a
  component/page) — `src/hooks/auth/useAuth.ts` and `src/hooks/common/useExampleItems.ts`
  (+ its mutation-hook siblings) are the reference shapes.
- Standalone `*.test.ts`, co-located next to the file, against real MSW handlers
  (never a direct `apiClient`/axios mock) — see `AGENTS.md` § Testing.
