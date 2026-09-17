/**
 * Transactional email providers this module can send through.
 *
 * Exactly one is active per deployment, chosen by the `EMAIL_PROVIDER`
 * environment variable. The generator removes the implementations that were not
 * selected at project creation, so a project only ships the provider it uses.
 */
export enum EmailProviderEnum {
  // #region emailProvider:brevo
  BREVO = 'brevo',
  // #endregion emailProvider:brevo
}

/** Every provider this build kept, in declaration order. */
export const AVAILABLE_EMAIL_PROVIDERS: string[] =
  Object.values(EmailProviderEnum);

/**
 * Reads an `EMAIL_PROVIDER` value the way both the startup validator and the
 * factory must read it — one function, because when they each had their own
 * the two disagreed: one treated a blank value as unset, the other as unknown,
 * and the app refused to boot on an env file the validator had just approved.
 *
 * Returns `undefined` for a value naming no provider in this build. Blank and
 * missing are not that — they mean "unset", and the caller decides the default.
 */
export function readEmailProvider(raw: unknown): {
  unset: boolean;
  provider?: EmailProviderEnum;
} {
  if (typeof raw !== 'string' || raw.trim() === '') return { unset: true };

  const normalized = raw.trim().toLowerCase();
  return AVAILABLE_EMAIL_PROVIDERS.includes(normalized)
    ? { unset: false, provider: normalized as EmailProviderEnum }
    : { unset: false };
}
