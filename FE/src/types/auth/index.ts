/** Auth-scoped TypeScript contracts. Types (unlike components) MAY be barrel-exported. */

/** Authenticated principal, matching the backend's `/auth` user shape. */
export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  /** Role for role-gated routes (see src/routes/RoleGuards.tsx). */
  role: string;
  status: string;
  avatar?: string;
  /**
   * The tenant this user belongs to.
   *
   * Required by every tenant-scoped API route, which the backend's
   * `OrganizationAccessGuard` reads from an `x-organization-id` header and
   * checks against the user's real membership. `api-client.ts` attaches it
   * automatically — no call site passes it.
   *
   * Absent for a user who has signed up but not yet created a workspace,
   * which is a real state the onboarding flow handles.
   */
  organization?: string;
}

/**
 * Access + refresh token pair. The access token is a short-lived (15m) JWT sent
 * as `Authorization: Bearer`; the refresh token is a 60-day opaque credential
 * sent only to `/auth/refresh-token` and rotated on every use (see
 * src/services/api-client.ts for the rotation/retry logic).
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

/**
 * What the backend actually returns from every endpoint that opens a session
 * (`/auth/login`, the signup-OTP verification, the social callbacks).
 *
 * The token pair is **flat alongside** the user, not nested under a `tokens`
 * key — this mirrors the API's own `IssuedSession & { user }` exactly
 * (BE `src/modules/auth/refresh-token.service.ts`). An earlier version of this
 * file described a nested `{ user, tokens }` shape that no endpoint ever
 * returned; the MSW handlers mirrored the same fiction, so the whole test suite
 * agreed with itself and the mismatch only appeared against the real server.
 * Mock fixtures must therefore always be derived from a real recorded payload.
 */
export type AuthSession = AuthTokens & { user: AuthUser };
