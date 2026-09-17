import { EmailProviderEnum } from '../enums/email-provider.enum';

/**
 * What every provider is given. Deliberately narrow: the sender, the templating
 * and the branding are `EmailService`'s job, so a provider receives finished
 * content and does nothing but hand it to an API.
 */
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  senderEmail: string;
  senderName: string;
}

/**
 * The contract each provider implements.
 *
 * `EmailService` depends on this and never on a vendor SDK, which is what makes
 * a provider removable without touching a caller. Adding one takes four steps,
 * all of them in the same change — see
 * `docs/architecture/integrations/email-providers.md`.
 */
export interface EmailProvider {
  /** Matches the `EMAIL_PROVIDER` value that selects this implementation. */
  readonly name: EmailProviderEnum;

  /**
   * Sends one message, or throws. Providers translate their own SDK's failure
   * into the module's error messages rather than leaking a vendor error shape
   * to the caller — the caller cannot tell one vendor's error from another's,
   * and should not have to.
   */
  send(options: SendEmailOptions): Promise<void>;
}

/** DI token for the single provider selected at boot. */
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
