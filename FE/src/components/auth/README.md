# Auth Feature

The "day one" auth screens every real project needs before its first real feature —
login, signup, forgot-password, OTP verification, and password reset. Wired against a
real `/auth` backend contract (access token + rotating refresh token), not a stub.

This folder holds the **forms** (RHF + Zod + the mutation/store call that submits
them). The **pages** that route to them — layout glue, `Seo`, reading
`location.state`/search params, navigating — live in `src/pages/auth/`.

## What it does

- `LoginForm` (page: `src/pages/auth/LoginPage.tsx`) — email + password, goes through
  `useLogin` (`src/hooks/auth/useAuth.ts`). On success, navigates to
  `location.state.from` (where `RoleGuards`/`AuthenticatedRoute` sent the user from) or
  their role's home route.
- `SignupForm` (page: `SignupPage.tsx`) — name + email + phone + password + confirm,
  creates the account then redirects to `/verify-signup-otp` with the email in router
  state.
- `ForgotPasswordForm` (page: `ForgotPasswordPage.tsx`) — email only, triggers a reset
  OTP, redirects to `/verify-forgot-password-otp` with the email in router state.
- `OtpForm` (pages: `VerifySignupOtpPage.tsx` and `VerifyForgotPasswordOtpPage.tsx`) —
  generic 6-digit code form; the two pages give it different `onVerify`/`onResend`
  callbacks against different endpoints:
  - Signup verify → activates the account and starts a session (`useVerifyOtp`'s own
    `onSuccess` calls `authStore.setSession`) → `getHomeRouteForRole(user.role)`
    (`src/routes/ProtectedRoutes.tsx`) — the signed-in user's own role's home route
    (today every role lands on `/dashboard`, filtered to what that role may see).
  - Forgot-password verify → returns a single-use reset token → `/reset-password`
    with the token in router state.
  - Both pages redirect back to where the flow starts if hit directly with no email
    in state (can't verify without knowing which email).
- `ResetPasswordForm` (page: `ResetPasswordPage.tsx`) — new password + confirm only
  (no email/code field — the backend resolves the account from the reset token
  itself). The page resolves the token from either router state (arriving from the
  OTP-verify step) or a `?token=` query string (arriving from the backend's emailed
  reset-link flow) — both entry points land on the same page for free.

## State approach

- **Server state:** every mutation — including login/logout — goes through a named
  TanStack Query hook in `src/hooks/auth/useAuth.ts` (`useLogin`, `useSignup`,
  `useLogout`, `useForgotPassword`, `useResetPassword`, `useVerifyOtp`, plus
  `useResendSignupOtp`/`useVerifyForgotPasswordOtp` for the forgot-password OTP flow) —
  never an inline `useMutation` in a form component. `useLogin`/`useLogout` don't call
  `authService` directly like the others do: `authStore` must stay the single source of
  truth for session state, since `api-client.ts`'s response interceptor calls
  `useAuthStore.getState().logout()` from outside React on a failed token refresh, and a
  hook can never be called from there. See that file's own doc comment for the full
  reasoning.
- **Client/session state:** `src/stores/authStore.ts` (`persist`-backed) —
  `accessToken`, `refreshToken`, and `user` are the single source of truth;
  `api-client.ts` reads/writes them directly, never via a component or
  `localStorage` read.
- **Form state:** React Hook Form + Zod (`src/schemas/auth/auth.schema.ts`), composed from
  `src/schemas/common/common.schema.ts` primitives (email/password/phone).

## API dependency

`src/constants/auth.ts`'s `AuthRoutes` mirrors the real backend's `/auth/*` paths;
`src/services/auth/authService.ts` has one typed method per endpoint, called only from
`src/hooks/auth/useAuth.ts` (never straight from a form/page) and from `api-client.ts`'s
own refresh-token handling. `src/mocks/handlers.ts` mocks the same envelope/shapes for
`pnpm dev` with no real backend running.

Four endpoints are fully implemented in `authService` but have **no page** here —
`changePassword`, `logoutAllDevices`, `activeSessions`, and `appleCallback` — since a
settings/sessions screen would itself be a business-domain addition beyond this
boilerplate's scope (see AGENTS.md § zero business-domain lock-in). A project that
needs one can build it directly on top of these methods.

## Token handling

`src/services/api-client.ts` implements the full session lifecycle against the real
backend's 15-minute access token / 60-day rotating refresh token:

- **Attach:** every outgoing request reads `useAuthStore.getState().accessToken` and
  sets `Authorization: Bearer <token>` via an Axios request interceptor.
- **Persist:** `authStore.ts` is `zustand/persist`-backed, so the session survives a
  page reload. `hasHydrated` tracks whether that async rehydration has finished, so
  `RoleGuards`/`AuthRedirectRoute`/`AuthenticatedRoute` (`src/routes/`) never
  false-redirect on a fresh page load before the persisted session is read back.
- **Refresh-and-retry:** a 401 on any non-auth-flow route triggers exactly one
  single-flight `/auth/refresh-token` call (concurrent 401s share it), retries the
  original request once with the new access token, and writes **both** rotated tokens
  back — never just the access token, since replaying a spent refresh token trips the
  backend's stolen-token detection and logs the user out everywhere. A failed refresh,
  or a second 401 after retrying, ends the session the same way a manual logout does.
- **Cross-tab:** `src/hooks/common/useSyncAuthAcrossTabs.ts` listens for the persisted auth
  key changing in another tab (e.g. that tab logging out) and re-syncs this tab's
  state instead of leaving it showing a stale session.
