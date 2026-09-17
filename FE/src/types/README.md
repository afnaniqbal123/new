# Types

Every shared TypeScript `interface` lives under `src/types/<concern>/index.ts` — the
same `<concern>`-folder convention already used by `src/hooks/<concern>/` and
`src/services/<concern>/`:

- `common/` — a type used by more than one concern (`ApiResponse<TData>`,
  `Paginated<TItem>`). Confirm a type is genuinely cross-concern before adding it
  here — a type used by exactly one concern belongs in that concern's own folder,
  never force-moved into `common/` just because it's shared-shaped.
- `auth/` — auth-scoped types only (`AuthUser`, `AuthTokens`).
- `admin/`, `member/`, a future portal — created as needed for a type genuinely
  specific to that role, same "stays empty until needed" precedent as
  `src/hooks/admin/`/`src/hooks/member/`.

Types (unlike components) MAY be barrel-exported — each concern folder's `index.ts` is
exactly that barrel. There is no top-level `src/types/index.ts` — import directly from
the concern the type actually belongs to (`from 'src/types/auth'`,
`from 'src/types/common'`).
