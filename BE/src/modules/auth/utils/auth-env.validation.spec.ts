import { CONFIG } from 'src/constants/config.constant';
import { AUTH_STARTUP_ERRORS } from 'src/modules/auth/constants/auth.constant';
import { validateAuthEnv } from './auth-env.validation';

describe('validateAuthEnv', () => {
  const strongSecret = 'a'.repeat(32);

  it('passes the config through when the secret is acceptable', () => {
    const config = { [CONFIG.JWT_SECRET]: strongSecret, OTHER: 'value' };
    expect(validateAuthEnv(config)).toBe(config);
  });

  it('refuses to boot without a signing secret', () => {
    expect(() => validateAuthEnv({})).toThrow(
      AUTH_STARTUP_ERRORS.JWT_SECRET_MISSING,
    );
  });

  it('refuses to boot on a blank signing secret', () => {
    expect(() => validateAuthEnv({ [CONFIG.JWT_SECRET]: '   ' })).toThrow(
      AUTH_STARTUP_ERRORS.JWT_SECRET_MISSING,
    );
  });

  it('refuses to boot on a secret short enough to brute-force', () => {
    expect(() => validateAuthEnv({ [CONFIG.JWT_SECRET]: 'short' })).toThrow(
      AUTH_STARTUP_ERRORS.JWT_SECRET_TOO_WEAK,
    );
  });
});
