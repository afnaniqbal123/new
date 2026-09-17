export enum TOKEN_TYPES {
  /**
   * The only JWT purpose accepted as an API access credential. Every other
   * member of this enum exists so the access path can explicitly reject it.
   */
  SIGNIN_TOKEN = 'SIGNIN_TOKEN',

  /**
   * Legacy. Password reset no longer issues a JWT at all — it uses an opaque,
   * hashed, single-use record (see `PasswordResetService` and ADR 0001). The
   * member is kept so the access path has a concrete non-access purpose to
   * reject in tests, and so any token still in flight from the old build is
   * refused rather than silently accepted.
   *
   * @deprecated Never issued. Do not reintroduce reset credentials as JWTs.
   */
  RESET_PASSWORD_TOKEN = 'RESET_PASSWORD_TOKEN',
}

export enum AUTH_PROVIDER {
  GOOGLE = 'GOOGLE',
  APPLE = 'APPLE',
  CUSTOM = 'CUSTOM',
}

/** Passport strategy name for the one access-JWT verification path. */
export const JWT_ACCESS_STRATEGY = 'jwt';

/**
 * Header a client uses to say which organization a request is *for*. It is an
 * assertion by the caller, not proof of anything — `OrganizationAccessGuard`
 * is what turns it into authorized tenant context.
 */
export const ORGANIZATION_HEADER = 'x-organization-id';

/**
 * Boot-time failures, not API responses. They are never serialized into an
 * HTTP envelope — the process stops before it can serve anything — which is
 * why they live here rather than under `constants/api-response/`.
 */
export enum AUTH_STARTUP_ERRORS {
  JWT_SECRET_MISSING = 'JWT_SECRET is not configured. Refusing to start: every token this process issued would be forgeable.',
  JWT_SECRET_TOO_WEAK = 'JWT_SECRET is too short to sign tokens safely. Refusing to start: use at least 32 characters of high-entropy secret.',
}
