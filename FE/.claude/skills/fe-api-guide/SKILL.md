---
name: fe-api-guide
description: Use when integrating a backend into the frontend or when given an OpenAPI/spec file. Generates consolidated API docs, suggested api-routes constants, and Zod schemas from the spec — without inventing endpoints.
---

# Frontend API integration guide

Authoritative conventions: `AGENTS.md` § Data & State.

## Inputs

An OpenAPI/Swagger file, a Postman collection, or a written endpoint list.

## Outputs (write under `docs/api/`)

1. **`docs/api/README.md`** — every endpoint: method, path, auth, params, request/response
   shapes, and error cases, grouped by service area.
2. **Suggested `src/constants/<concern>.ts` entries** — API routes are grouped by
   **portal/concern, never by feature or backend service area** (see `AGENTS.md` §
   Constant Registries): a new endpoint is a new member on the relevant existing portal's
   enum (`AuthRoutes` in `auth.ts`, `MemberRoutes` in `member.ts`, ...), not a new enum
   named after the spec's own service area (e.g. an "Orders" backend service integrated
   into the member portal adds members to `MemberRoutes`, it does not get its own
   `OrderRoutes`). Add a new `src/constants/<concern>.ts` file only when the spec
   introduces a genuinely new portal/concern that doesn't exist in `src/routes/roles.ts`
   yet. Every route string is an absolute path only — never a hardcoded host or version
   prefix (no `/api/v1/...`); the host comes from `VITE_API_BASE_URL`. A route needing a
   path param stays a plain string member for its static base path (enum members can only
   be string/numeric literals, never functions) — interpolate the param at the call site
   inside the matching service function (e.g. `` `${MemberRoutes.ORDERS}/${id}` ``). Do not
   overwrite unrelated enums.
3. **Suggested `src/constants/queryKeys.ts` entries** — new members on the global `QueryKey`
   enum for every list/detail endpoint this integration adds a TanStack Query hook for (see
   `AGENTS.md` § Data & State) — never a per-feature key factory, never an inline string
   literal in the hook itself. Unlike the route enums above, this registry stays flat/global,
   not split per concern — see that file's own comment for why.
4. **Suggested `src/schemas/<concern>/*.schema.ts`** — Zod schemas for each request/response,
   one folder per portal/concern (same convention as the route enums above), with inferred
   TypeScript types, so the query layer can validate payloads at the boundary.
5. **Suggested `src/services/<concern>/<name>Service.ts` entries** — one typed async method
   per endpoint, matching `src/services/auth/authService.ts`'s shape. This is where the
   suggested route constant + schema actually get used: the service function calls
   `apiClient` and `.parse()`s the response with the suggested schema before returning. A
   hook's `queryFn`/`mutationFn` calls this service function — never `apiClient` directly
   (AGENTS.md § Data & State's hard rule).
6. **Per-service README** for each major area (under `docs/api/` — this is API reference
   documentation, distinct from a feature's own code folder, which does not get its own
   `README.md`; see AGENTS.md § Component Conventions).

## Rules

- Stay faithful to the spec — never invent endpoints, fields, or status codes.
- Types flow one direction: Zod schema → `z.infer` type. Do not hand-duplicate interfaces.
- All fetching goes through `src/services/api-client.ts`, wrapped by a
  `src/services/<concern>/` service function, called from a TanStack Query hook — never a
  hook calling `apiClient` directly.
