import { apiClient } from 'src/services/api-client';
import { AuthRoutes } from 'src/constants/auth';
import type { ApiResponse } from 'src/types/common';
import type { AuthSession, AuthTokens, AuthUser } from 'src/types/auth';

/**
 * Auth API client — one method per `AuthRoutes` endpoint (src/constants/auth.ts).
 * This boilerplate's Auth contract ships hand-authored as a reference stub (each method
 * below documents its own behavior) rather than generated from a spec — a real backend
 * integration would instead run the `fe-api-guide` skill
 * (.claude/skills/fe-api-guide/SKILL.md) against its OpenAPI spec to produce
 * `docs/api/README.md` and this file's equivalent for that service. Every call here just
 * posts/gets and unwraps `response.data.data`: a non-2xx response never reaches this
 * file because `api-client.ts`'s response interceptor already turned it into a
 * thrown `ApiError` (including the refresh-and-retry dance on an expired access
 * token) before axios resolves. Token persistence is owned by authStore.ts.
 */
export const authService = {
  /** Creates the account; the server sends a signup-verification OTP. */
  async signup(payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<void> {
    await apiClient.post<ApiResponse<boolean>>(AuthRoutes.SIGNUP, payload);
  },

  /** Verifies the signup OTP — activates the account and starts a session. */
  async verifySignupOtp(payload: { email: string; otp: string }): Promise<AuthSession> {
    const { data } = await apiClient.post<ApiResponse<AuthSession>>(
      AuthRoutes.VERIFY_SIGNUP_OTP,
      payload
    );
    return data.data;
  },

  async resendSignupOtp(payload: { email: string }): Promise<void> {
    await apiClient.post<ApiResponse<boolean>>(AuthRoutes.RESEND_SIGNUP_OTP, payload);
  },

  async login(credentials: { email: string; password: string }): Promise<AuthSession> {
    const { data } = await apiClient.post<ApiResponse<AuthSession>>(AuthRoutes.LOGIN, credentials);
    return data.data;
  },

  /** Exchanges a refresh token for a rotated pair. Called by api-client.ts's 401 handling. */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const { data } = await apiClient.post<ApiResponse<AuthTokens>>(AuthRoutes.REFRESH_TOKEN, {
      refreshToken,
    });
    return data.data;
  },

  /** Emails a signup-style OTP for password reset. */
  async forgotPassword(payload: { email: string }): Promise<void> {
    await apiClient.post<ApiResponse<boolean>>(AuthRoutes.FORGOT_PASSWORD, payload);
  },

  /** Verifies the forgot-password OTP, returning a single-use reset token. */
  async verifyForgotPasswordOtp(payload: {
    email: string;
    otp: string;
  }): Promise<{ resetToken: string }> {
    const { data } = await apiClient.post<ApiResponse<{ resetToken: string }>>(
      AuthRoutes.VERIFY_FORGOT_PASSWORD_OTP,
      payload
    );
    return data.data;
  },

  /** Alternate entry point: emails a reset link instead of an OTP. Not wired to a page. */
  async forgotPasswordLink(payload: { email: string }): Promise<void> {
    await apiClient.post<ApiResponse<boolean>>(AuthRoutes.FORGOT_PASSWORD_LINK, payload);
  },

  /** Sets a new password using the reset token from either OTP or link flow. */
  async verifyResetPassword(payload: { token: string; password: string }): Promise<void> {
    await apiClient.post<ApiResponse<boolean>>(AuthRoutes.VERIFY_RESET_PASSWORD, payload);
  },

  /** Sign in with Apple. Implemented for parity with the API; no page consumes it yet. */
  async appleCallback(payload: { idToken: string }): Promise<AuthSession> {
    const { data } = await apiClient.post<ApiResponse<AuthSession>>(
      AuthRoutes.APPLE_CALLBACK,
      payload
    );
    return data.data;
  },

  async getAuthenticatedUser(): Promise<AuthUser> {
    const { data } = await apiClient.get<ApiResponse<AuthUser>>(AuthRoutes.ME);
    return data.data;
  },

  /**
   * Changes the password for the current session. Succeeding revokes every
   * session (including this one) — not wired to a page yet, see
   * components/auth/README.md for what a project adding a settings page needs.
   */
  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiClient.post<ApiResponse<boolean>>(AuthRoutes.CHANGE_PASSWORD, payload);
  },

  /** Ends the current session (identified from the access token, no body needed). */
  async logout(): Promise<void> {
    await apiClient.post(AuthRoutes.LOGOUT);
  },

  /** Ends every session for the current user. Not wired to a page yet. */
  async logoutAllDevices(): Promise<void> {
    await apiClient.post(AuthRoutes.LOGOUT_ALL_DEVICES);
  },

  /** Lists this user's live sessions. Not wired to a page yet. */
  async activeSessions(): Promise<
    Array<{
      _id: string;
      deviceInfo: string;
      ipAddress: string;
      createdAt: string;
      expiresAt: string;
    }>
  > {
    const { data } = await apiClient.get<
      ApiResponse<
        Array<{
          _id: string;
          deviceInfo: string;
          ipAddress: string;
          createdAt: string;
          expiresAt: string;
        }>
      >
    >(AuthRoutes.ACTIVE_SESSIONS);
    return data.data;
  },
};
