import { TOKEN_TYPES } from 'src/modules/auth/constants/auth.constant';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';

/**
 * The canonical authenticated caller.
 *
 * Produced in exactly one place — `JwtStrategy.validate()` — and attached to
 * `request.user`. Everything downstream (`@GetUser`, `RolesGuard`,
 * `OrganizationAccessGuard`, controllers) reads this shape and nothing else.
 * One producer means the trust boundary is one file wide and can be audited
 * as a unit.
 */
export type AuthenticatedPrincipal = {
  id: string;
  email: string;
  role: USER_ROLES;
  /** Refresh session that minted this access token, when there was one. */
  sessionId?: string;
};

/**
 * The claim set an access JWT must carry. This is the *verified* shape — the
 * signature, expiry, algorithm, issuer and audience are checked by
 * passport-jwt before these claims are ever looked at.
 */
export type AccessTokenClaims = {
  sub: string;
  email: string;
  role: USER_ROLES;
  type: TOKEN_TYPES.SIGNIN_TOKEN;
  sid?: string;
};

const KNOWN_ROLES = new Set<string>(Object.values(USER_ROLES));

/**
 * Runtime guard over a decoded JWT payload.
 *
 * A TypeScript annotation on a decoded token is a comment, not a check: the
 * payload arrives as an attacker-influenced string and `as AccessTokenClaims`
 * would assert a shape nothing verified. Every field the authorization layer
 * later trusts is therefore checked here, and anything missing, malformed, or
 * of an unknown purpose fails closed.
 */
export function isAccessTokenClaims(
  payload: unknown,
): payload is AccessTokenClaims {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const claims = payload as Record<string, unknown>;

  // Token purpose. A reset (or any other) credential is cryptographically
  // valid under the same secret, so signature and expiry alone do not make a
  // token an access credential — this is the check that separates them.
  if (claims.type !== TOKEN_TYPES.SIGNIN_TOKEN) {
    return false;
  }

  if (typeof claims.sub !== 'string' || claims.sub.trim() === '') {
    return false;
  }

  if (typeof claims.email !== 'string' || claims.email.trim() === '') {
    return false;
  }

  // `role` drives authorization without a database read, so an unrecognised
  // value must not reach `RolesGuard` as an opaque string.
  if (typeof claims.role !== 'string' || !KNOWN_ROLES.has(claims.role)) {
    return false;
  }

  if (claims.sid !== undefined && typeof claims.sid !== 'string') {
    return false;
  }

  return true;
}

export function toAuthenticatedPrincipal(
  claims: AccessTokenClaims,
): AuthenticatedPrincipal {
  return {
    id: claims.sub,
    email: claims.email,
    role: claims.role,
    sessionId: claims.sid,
  };
}
