import { CONFIG } from '../constants/config';
import { EMAIL_ERRORS } from '../constants/api-response/email.response';
import {
  AVAILABLE_EMAIL_PROVIDERS,
  readEmailProvider,
} from '../enums/email-provider.enum';

/**
 * Startup gate for the email provider selection.
 *
 * `EMAIL_PROVIDER` names which implementation this build sends through, and the
 * generator removes the ones that were not chosen. A typo, or a value naming a
 * provider that was stripped out, is not a runtime error to handle — it means
 * nothing can send. Booting anyway would turn it into an unsent password reset
 * hours later, so it fails here, at ConfigModule load, before the app listens.
 *
 * Unset is fine and common: the factory falls back to whichever provider the
 * build kept.
 *
 * Wired through `ConfigModule.forRoot({ validate })` in `AppModule`.
 */
export function validateEmailEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const raw = config[CONFIG.EMAIL_PROVIDER];
  const { unset, provider } = readEmailProvider(raw);

  if (!unset && !provider) {
    throw new Error(
      `${EMAIL_ERRORS.PROVIDER_NOT_CONFIGURED}: EMAIL_PROVIDER="${String(raw)}". ` +
        `Available: ${AVAILABLE_EMAIL_PROVIDERS.join(', ')}`,
    );
  }

  return config;
}
