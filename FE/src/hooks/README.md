# Hooks

Every hook lives under `src/hooks/<concern>/<hookName>.ts` — `<concern>` is the same
naming already used for `src/components/<concern>/`/`src/pages/<concern>/`: `common/`
for anything generic or cross-role, `auth/` for a hook scoped to the auth flow, or a
role name (`admin`, `member`, and any future portal, e.g. `customer`) for a hook
genuinely specific to that role's own pages. There is no other location for a hook — a
feature's own data-fetching hook does **not** live co-located inside its component
folder; it goes here, under the concern it belongs to, exactly like every other hook.

`src/hooks/auth/useAuth.ts` holds every auth mutation hook in one file (`useLogin`,
`useSignup`, `useLogout`, `useForgotPassword`, `useResetPassword`, `useVerifyOtp`, plus
two supporting exports for the forgot-password OTP flow). `src/hooks/admin/` and
`src/hooks/member/` don't exist yet, and that's expected, not a gap — no hook in this
boilerplate is genuinely role-specific today. The structure is ready for a role-specific
hook the moment one is actually needed; an empty/missing role folder here is the same
"nothing to see yet" state as `src/components/admin/`/`member/` themselves (see
`AGENTS.md` § Directory Map — those don't physically exist either until a real
role-specific component is added). Don't read an absent `src/hooks/<role>/` as a mistake
or something forgotten.

**Every hook's `queryFn`/`mutationFn` calls a function from a matching
`src/services/<concern>/` file — never `apiClient` directly.** See
`src/services/README.md` for the service-layer half of this split; `useExampleItems.ts`
(-> `services/common/exampleService.ts`) is the reference shape.

See `AGENTS.md` § Directory Map for the full "which concern-folder does a new hook go
in" decision.

## Rules

- camelCase with a `use` prefix (`useDebouncedValue.ts`).
- Exhaustive `useEffect`/`useCallback` dependencies (ESLint-enforced).
- Unit-tested to ≥80% coverage.
