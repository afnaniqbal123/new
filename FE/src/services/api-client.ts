import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { CONFIG } from 'src/constants/config';
import { AuthRoutes } from 'src/constants/auth';
import { useAuthStore } from 'src/stores/authStore';
import { authService } from 'src/services/auth/authService';

/** Normalized error the whole app can rely on (a real Error subclass). */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * This instance's fixed `Content-Type: application/json` default breaks a `FormData`
 * body (e.g. a file upload) if sent as-is: confirmed empirically (axios 1.19.0's own
 * `transformRequest`, `node_modules/axios/lib/defaults/index.js`) — with a JSON
 * content-type already set, axios coerces the `FormData` into a JSON-stringified
 * object instead of sending real multipart data, and any `File`/`Blob` entry becomes
 * an empty `{}` (its binary content is silently dropped, not an error). Pass
 * `{ headers: { 'Content-Type': undefined } }` in that one call's config to fix it —
 * this lets the request layer set the correct `multipart/form-data; boundary=...`
 * header itself (also confirmed empirically); a fixed `multipart/form-data` string
 * would still be wrong, since it would be missing the required boundary parameter.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Routes where a 401 means "wrong credentials/OTP/token", not "access token
 * expired" — must never trigger a refresh attempt (retrying a bad login as a
 * refreshed request makes no sense, and refresh-token's own 401 must fall
 * straight through to a hard logout instead of trying to refresh itself).
 */
const AUTH_FLOW_ROUTES: string[] = Object.values(AuthRoutes).filter(
  (route) => route !== AuthRoutes.ME && route !== AuthRoutes.CHANGE_PASSWORD
);

function isAuthFlowRoute(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_FLOW_ROUTES.some((route) => url.includes(route));
}

function extractMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const body = data as { message?: unknown; msg?: unknown };
  // The backend's one documented inconsistency: validation errors (400) use
  // `msg`, every other application error uses `message`.
  if (typeof body.message === 'string') return body.message;
  if (typeof body.msg === 'string') return body.msg;
  return undefined;
}

function toApiError(error: AxiosError): ApiError {
  // error.message is always a string (Error's own type guarantee) — never
  // nullish, so there's nothing for a trailing `?? 'Network error'` to catch.
  return new ApiError(
    extractMessage(error.response?.data) ?? error.message,
    error.response?.status ?? 0,
    error.response?.data
  );
}

// ---- Request interceptor: attach bearer token ----
// Reads from the auth store directly (not React state) — the standard pattern
// for an axios instance living outside the component tree. The
// api-client -> authStore -> authService -> api-client import cycle is safe here
// because every read happens inside a callback, never at module-eval time.
apiClient.interceptors.request.use((request: InternalAxiosRequestConfig) => {
  const { accessToken, user } = useAuthStore.getState();

  if (accessToken) {
    request.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Tenant context. Every business-domain route on the API is tenant-scoped
  // and refuses a request without this header; attaching it here means no
  // service or hook has to remember to, and there is exactly one place that
  // decides which organization the app is acting as.
  //
  // The header is a *claim*, not an authorization: the backend checks it
  // against the user's real membership and rejects a mismatch, so sending it
  // from the client is safe.
  if (user?.organization) {
    request.headers.set('x-organization-id', user.organization);
  }

  return request;
});

/**
 * Single-flight refresh: concurrent 401s share one in-flight `/auth/refresh-token`
 * call instead of each firing their own (which would race and, per the backend's
 * reuse-detection, log the user out everywhere — see docs/auth-token-refresh.md
 * for the full rationale). Cleared once the call settles, success or
 * failure, so a later 401 can retry rather than await a permanently-failed promise.
 */
let inFlightRefresh: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) throw new Error('No refresh token available');

  const tokens = await authService.refreshToken(refreshToken);
  // Write BOTH tokens back — the refresh token rotates on every use, and
  // persisting only the new access token would leave a spent refresh token in
  // storage that trips the backend's stolen-token detection on the next refresh.
  useAuthStore.getState().setTokens(tokens);
  return tokens.accessToken;
}

// ---- Response interceptor: error normalization + single-flight refresh-and-retry ----
// The access token is short-lived (15m) by design, so — unlike a hard-logout-on-
// 401 default — silently refreshing once and retrying is the right default here;
// see docs/auth-token-refresh.md for the pattern this adapts.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    const shouldAttemptRefresh =
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthFlowRoute(original.url);

    if (!shouldAttemptRefresh) {
      return Promise.reject(toApiError(error));
    }

    original._retry = true;

    // Only the refresh itself is guarded here — a retry failure below is a
    // problem with that one request, not a dead session, so it must not be
    // caught by the same catch that ends the session on a failed refresh.
    try {
      inFlightRefresh ??= refreshAccessToken().finally(() => {
        inFlightRefresh = null;
      });
      const accessToken = await inFlightRefresh;
      original.headers.set('Authorization', `Bearer ${accessToken}`);
    } catch {
      // Refresh failed (expired/invalid/revoked session) — end the session the
      // same way a manual logout does, then let RoleGuards redirect.
      const { logout } = useAuthStore.getState();
      await logout();
      return Promise.reject(toApiError(error));
    }

    return apiClient(original);
  }
);
