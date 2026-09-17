/**
 * `Role`-agnostic auth-flow API routes — the one concern folder every portal shares,
 * same as `src/components/auth/`/`src/hooks/auth/`. Routes are absolute path segments
 * only (no host, no version prefix) — `src/services/api-client.ts`'s `baseURL` supplies
 * the host, and there is deliberately no shared "/api/v1"-style prefix constant either:
 * see AGENTS.md § Constant Registries for why a prefix never belongs on an individual
 * route string.
 */
export enum AuthRoutes {
  SIGNUP = '/auth/signup',
  VERIFY_SIGNUP_OTP = '/auth/verify-signup-otp',
  RESEND_SIGNUP_OTP = '/auth/resend-signup-otp',
  LOGIN = '/auth/login',
  REFRESH_TOKEN = '/auth/refresh-token',
  FORGOT_PASSWORD = '/auth/forgot-password',
  VERIFY_FORGOT_PASSWORD_OTP = '/auth/verify-forgot-password-otp',
  FORGOT_PASSWORD_LINK = '/auth/forgot-password-link',
  VERIFY_RESET_PASSWORD = '/auth/verify-reset-password',
  APPLE_CALLBACK = '/auth/apple/callback',
  ME = '/auth/get-authenticated-user',
  CHANGE_PASSWORD = '/auth/change-password',
  LOGOUT = '/auth/logout',
  LOGOUT_ALL_DEVICES = '/auth/logout-all-devices',
  ACTIVE_SESSIONS = '/auth/active-sessions',
}
