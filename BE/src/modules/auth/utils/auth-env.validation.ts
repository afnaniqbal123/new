import { CONFIG, JWT_SECRET_MIN_LENGTH } from 'src/constants/config.constant';
import { AUTH_STARTUP_ERRORS } from 'src/modules/auth/constants/auth.constant';

/**
 * Startup gate for the JWT signing configuration.
 *
 * A missing or trivially short `JWT_SECRET` is not a runtime error to be
 * handled — it means every token the process issues is forgeable. Booting in
 * that state and failing later, per request, would leave a signing key that
 * looks like it works. So it fails here, at ConfigModule load, before the app
 * listens.
 *
 * Wired through `ConfigModule.forRoot({ validate })` in `AppModule`.
 */
export function validateAuthEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const secret = config[CONFIG.JWT_SECRET];

  if (typeof secret !== 'string' || secret.trim() === '') {
    throw new Error(AUTH_STARTUP_ERRORS.JWT_SECRET_MISSING);
  }

  if (secret.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(AUTH_STARTUP_ERRORS.JWT_SECRET_TOO_WEAK);
  }

  return config;
}
