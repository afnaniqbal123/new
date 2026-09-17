import { type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CONFIG } from '../constants/config';
import {
  AVAILABLE_EMAIL_PROVIDERS,
  EmailProviderEnum,
  readEmailProvider,
} from '../enums/email-provider.enum';
import { EMAIL_PROVIDER, type EmailProvider } from './email-provider.interface';
// #region emailProvider:brevo
import { BrevoEmailProvider } from './brevo-email.provider';
// #endregion emailProvider:brevo

/**
 * Resolves `EMAIL_PROVIDER` to the one implementation this build ships.
 *
 * The `#region emailProvider:*` blocks are removal anchors: `scripts/setup.mjs`
 * strips the branches for providers not chosen at project creation, so a
 * generated project has no import of an SDK it does not depend on. Adding a
 * provider means adding a branch here wrapped in its own anchor pair, or the
 * generator cannot remove it — see
 * `docs/architecture/integrations/email-providers.md`.
 *
 * Instantiated directly rather than injected: each provider needs only
 * `ConfigService`, and a switch reads more clearly than a registry of classes
 * that must all be resolvable whether or not they were kept.
 */
export const emailProviderFactory: Provider = {
  provide: EMAIL_PROVIDER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): EmailProvider => {
    // One reader, shared with `validateEmailEnv`. Unset falls back to whichever
    // provider this build kept — not a named one, since the generator can
    // remove any of them. An unknown value never reaches here: the validator
    // rejected it at ConfigModule load.
    const { provider } = readEmailProvider(
      configService.get<string>(CONFIG.EMAIL_PROVIDER),
    );
    const configured =
      provider ?? (AVAILABLE_EMAIL_PROVIDERS[0] as EmailProviderEnum);

    switch (configured) {
      // #region emailProvider:brevo
      case EmailProviderEnum.BREVO:
        return new BrevoEmailProvider(configService);
      // #endregion emailProvider:brevo
    }
  },
};
