import { CONFIG } from '../constants/config';
import { EmailProviderEnum } from '../enums/email-provider.enum';
import { validateEmailEnv } from './email-env.validation';

/**
 * The startup gate for `EMAIL_PROVIDER`.
 *
 * Nothing here names a provider: the generator deletes `EmailProviderEnum`
 * members along with their implementations, so a test asserting on a specific
 * one stops compiling in any project that did not pick it.
 */

const AVAILABLE: string[] = Object.values(EmailProviderEnum);

describe('validateEmailEnv', () => {
  it('lets an unset or blank provider through — the factory has a fallback', () => {
    expect(() => validateEmailEnv({})).not.toThrow();
    expect(() =>
      validateEmailEnv({ [CONFIG.EMAIL_PROVIDER]: '' }),
    ).not.toThrow();
  });

  it.each(AVAILABLE)('accepts %s, which this build ships', (name) => {
    expect(() =>
      validateEmailEnv({ [CONFIG.EMAIL_PROVIDER]: name }),
    ).not.toThrow();
  });

  it('refuses a provider this build cannot send through', () => {
    // The case that matters after generation: a project keeps one provider,
    // someone copies an older .env naming another, and the app must not boot
    // pretending it can send.
    expect(() =>
      validateEmailEnv({ [CONFIG.EMAIL_PROVIDER]: 'mailchimp' }),
    ).toThrow(/not available in this build/);
  });

  it('names what is available, so the fix is in the error', () => {
    expect(() => validateEmailEnv({ [CONFIG.EMAIL_PROVIDER]: 'nope' })).toThrow(
      new RegExp(AVAILABLE.join(', ')),
    );
  });
});
