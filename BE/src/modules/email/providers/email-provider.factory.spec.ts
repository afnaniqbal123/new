import { ConfigService } from '@nestjs/config';

import { CONFIG } from '../constants/config';
import { EmailProviderEnum } from '../enums/email-provider.enum';
import { emailProviderFactory } from './email-provider.factory';

/**
 * The factory decides, once at boot, which vendor every email in the system
 * goes through. It is also the file the generator edits when a provider is
 * removed, so the cases that matter are the ones where `EMAIL_PROVIDER` and the
 * providers this build kept disagree.
 *
 * Nothing here names a provider. The generator deletes `EmailProviderEnum`
 * members along with their implementations, so a test asserting on
 * `EmailProviderEnum.BREVO` stops compiling in any project that did not pick
 * Brevo — which is exactly the failure this file exists to prevent. Every case
 * below derives its inputs from whatever the build actually kept.
 */

type Factory = { useFactory: (config: ConfigService) => { name: string } };

const AVAILABLE: string[] = Object.values(EmailProviderEnum);

const build = (value?: string) => {
  const config = {
    get: (key: string) =>
      key === String(CONFIG.EMAIL_PROVIDER) ? value : undefined,
  } as unknown as ConfigService;
  return (emailProviderFactory as unknown as Factory).useFactory(config);
};

describe('emailProviderFactory', () => {
  it.each(AVAILABLE)('uses the provider EMAIL_PROVIDER names: %s', (name) => {
    expect(build(name).name).toBe(name);
  });

  it.each(AVAILABLE)('tolerates casing and padding around %s', (name) => {
    // Env files are edited by hand; `SES` and ` ses ` are the same intent.
    expect(build(`  ${name.toUpperCase()}  `).name).toBe(name);
  });

  it('falls back to a provider this build kept when EMAIL_PROVIDER is unset', () => {
    // Not a named default: the generator can remove any provider, so the
    // fallback has to be whichever one survived.
    expect(AVAILABLE).toContain(build(undefined).name);
  });

  it('treats a blank EMAIL_PROVIDER as unset, not as an unknown provider', () => {
    // `.env` ships the key blank, and ConfigService returns "" for it. Reading
    // that with `??` kept the empty string and refused to boot on an env file
    // validateEmailEnv had just approved.
    expect(AVAILABLE).toContain(build('').name);
  });
});
