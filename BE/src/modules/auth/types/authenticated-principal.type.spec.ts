import { TOKEN_TYPES } from 'src/modules/auth/constants/auth.constant';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import {
  isAccessTokenClaims,
  toAuthenticatedPrincipal,
} from './authenticated-principal.type';

/**
 * The runtime half of the access-token trust boundary. Everything here is a
 * payload that has *already* passed signature, expiry, algorithm, issuer and
 * audience checks — so each rejection below is a token that is cryptographically
 * valid and still must not authenticate an API request.
 */
describe('isAccessTokenClaims', () => {
  const valid = {
    sub: '507f1f77bcf86cd799439011',
    email: 'user@example.com',
    role: USER_ROLES.ADMIN,
    type: TOKEN_TYPES.SIGNIN_TOKEN,
  };

  it('accepts a well-formed access token payload', () => {
    expect(isAccessTokenClaims(valid)).toBe(true);
  });

  it('accepts an access token carrying a session id', () => {
    expect(isAccessTokenClaims({ ...valid, sid: 'session-1' })).toBe(true);
  });

  it('rejects a password-reset token', () => {
    expect(
      isAccessTokenClaims({
        ...valid,
        type: TOKEN_TYPES.RESET_PASSWORD_TOKEN,
      }),
    ).toBe(false);
  });

  it('rejects a payload with no token type', () => {
    const { type: _type, ...noType } = valid;
    expect(isAccessTokenClaims(noType)).toBe(false);
  });

  it('rejects an unknown token type', () => {
    expect(isAccessTokenClaims({ ...valid, type: 'API_KEY_TOKEN' })).toBe(
      false,
    );
  });

  it('rejects a missing subject', () => {
    const { sub: _sub, ...noSub } = valid;
    expect(isAccessTokenClaims(noSub)).toBe(false);
  });

  it('rejects a blank subject', () => {
    expect(isAccessTokenClaims({ ...valid, sub: '   ' })).toBe(false);
  });

  it('rejects a non-string subject', () => {
    expect(isAccessTokenClaims({ ...valid, sub: 12345 })).toBe(false);
  });

  it('rejects a missing email', () => {
    const { email: _email, ...noEmail } = valid;
    expect(isAccessTokenClaims(noEmail)).toBe(false);
  });

  it('rejects a missing role', () => {
    const { role: _role, ...noRole } = valid;
    expect(isAccessTokenClaims(noRole)).toBe(false);
  });

  // A role the application does not know would reach RolesGuard as an opaque
  // string and silently fail every comparison — or, if the comparison were
  // ever loosened, pass them all.
  it('rejects a role that is not a known role', () => {
    expect(isAccessTokenClaims({ ...valid, role: 'SUPERUSER' })).toBe(false);
  });

  it('rejects a non-string session id', () => {
    expect(isAccessTokenClaims({ ...valid, sid: 42 })).toBe(false);
  });

  it.each([[null], [undefined], ['a-string'], [42], [[]]])(
    'rejects a non-object payload (%p)',
    (payload) => {
      expect(isAccessTokenClaims(payload)).toBe(false);
    },
  );
});

describe('toAuthenticatedPrincipal', () => {
  it('maps verified claims onto the canonical principal', () => {
    expect(
      toAuthenticatedPrincipal({
        sub: 'user-1',
        email: 'user@example.com',
        role: USER_ROLES.CASHIER,
        type: TOKEN_TYPES.SIGNIN_TOKEN,
        sid: 'session-1',
      }),
    ).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      role: USER_ROLES.CASHIER,
      sessionId: 'session-1',
    });
  });
});
