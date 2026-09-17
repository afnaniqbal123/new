import { useMutation } from '@tanstack/react-query';
import { authService } from 'src/services/auth/authService';
import { useAuthStore } from 'src/stores/authStore';

/**
 * Every auth mutation hook in one file — the `<concern>`-scoped counterpart to
 * `src/hooks/common/`'s `example/` CRUD hooks. None of these invalidate a cached
 * query (AGENTS.md § Data & State's documented exception: a one-off auth action
 * has nothing cached to invalidate).
 *
 * `useLogin`/`useLogout` are deliberately NOT thin `authService` wrappers like
 * the rest of this file — `authStore` must stay the single source of truth for
 * session state, because `src/services/api-client.ts`'s response interceptor
 * calls `useAuthStore.getState().logout()` directly from outside React (on a
 * failed token refresh) and can never call a hook. `useLogin` calls
 * `authService.login` directly (nothing outside React needs to log in), then
 * sets the session itself via `setSession` — the same method
 * `useVerifyOtp`/`VerifySignupOtpPage` already uses to complete a session from
 * a non-login flow.
 */

/** Logs in; sets the session on success (mirrors the AGENTS.md mutation-hook shape). */
export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      authService.login(credentials),
    meta: { skipErrorToast: true },
    onSuccess: (session) => {
      // The session carries its tokens flat alongside the user, so the whole
      // object satisfies `AuthTokens` structurally — see types/auth.
      setSession(session.user, session);
    },
  });
}

/** Ends the current session via `authStore.logout` — see the file doc above for why. */
export function useLogout() {
  const logout = useAuthStore((state) => state.logout);
  return useMutation({
    mutationFn: () => logout(),
  });
}

/** Creates the account; the server sends a signup-verification OTP. No session yet. */
export function useSignup() {
  return useMutation({
    mutationFn: (values: { name: string; email: string; phone: string; password: string }) =>
      authService.signup(values),
    meta: { skipErrorToast: true },
  });
}

/**
 * Emails a signup-style OTP for password reset. Reused for both
 * `ForgotPasswordForm`'s initial submit and `VerifyForgotPasswordOtpPage`'s
 * "resend code" action — both call the same `authService.forgotPassword`.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (values: { email: string }) => authService.forgotPassword(values),
    meta: { skipErrorToast: true },
  });
}

/** Sets a new password using the reset token from either the OTP or link flow. */
export function useResetPassword() {
  return useMutation({
    mutationFn: (values: { token: string; password: string }) =>
      authService.verifyResetPassword(values),
    meta: { skipErrorToast: true },
  });
}

/** Verifies the signup OTP — activates the account and starts a session. */
export function useVerifyOtp() {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn: (values: { email: string; otp: string }) => authService.verifySignupOtp(values),
    meta: { skipErrorToast: true },
    onSuccess: (session) => {
      // The session carries its tokens flat alongside the user, so the whole
      // object satisfies `AuthTokens` structurally — see types/auth.
      setSession(session.user, session);
    },
  });
}

/** Requests a new signup-verification OTP for the same email. */
export function useResendSignupOtp() {
  return useMutation({
    mutationFn: (values: { email: string }) => authService.resendSignupOtp(values),
  });
}

/**
 * Verifies the forgot-password OTP, returning a single-use reset token — a
 * distinct endpoint from `useVerifyOtp` (this one never sets a session).
 */
export function useVerifyForgotPasswordOtp() {
  return useMutation({
    mutationFn: (values: { email: string; otp: string }) =>
      authService.verifyForgotPasswordOtp(values),
    meta: { skipErrorToast: true },
  });
}
