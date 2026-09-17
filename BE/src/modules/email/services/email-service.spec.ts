import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CONFIG as APP_CONFIG } from 'src/constants/config.constant';
import { MediaService } from 'src/modules/media/media.service';
import { EMAIL_BRAND } from '../constants/email-brand.constant';
import { EMAIL_ERRORS } from '../constants/api-response/email.response';
import { EmailService } from './email-service';
import type { EmailProvider } from '../providers/email-provider.interface';

/**
 * The module's only public entry point, and the one file the generator never
 * deletes. It names no vendor: what is asserted here is that it resolves the
 * recipient and sender and hands finished content on — whichever provider the
 * project was generated with receives it.
 */

const send = jest.fn();

const service = (env: Record<string, string> = {}) =>
  new EmailService(
    { get: (key: string) => env[key] } as unknown as ConfigService,
    {} as unknown as MediaService,
    { name: 'test', send } as unknown as EmailProvider,
  );

const body = (error: unknown) =>
  (error as HttpException).getResponse() as { status: number; message: string };

describe('EmailService.sendEmail', () => {
  beforeEach(() => send.mockReset().mockResolvedValue(undefined));

  it('hands the finished message to whichever provider is configured', async () => {
    await service({
      [APP_CONFIG.EMAIL_SENDER]: 'noreply@example.com',
    }).sendEmail('someone@example.com', 'Subject', '<p>Body</p>', 'Body');

    expect(send).toHaveBeenCalledWith({
      to: 'someone@example.com',
      subject: 'Subject',
      html: '<p>Body</p>',
      text: 'Body',
      senderEmail: 'noreply@example.com',
      senderName: EMAIL_BRAND.appName,
    });
  });

  it('uses EMAIL_SENDER_NAME as the display name when set', async () => {
    await service({
      [APP_CONFIG.EMAIL_SENDER]: 'noreply@example.com',
      [APP_CONFIG.EMAIL_SENDER_NAME]: 'Support Desk',
    }).sendEmail('someone@example.com', 'Subject');

    expect(send.mock.calls[0][0].senderName).toBe('Support Desk');
  });

  it('falls back to the brand name when EMAIL_SENDER_NAME is blank', async () => {
    // `.env` ships the key blank, so this is the default path. Reading it with
    // `??` kept "" and sent mail from an empty display name.
    await service({
      [APP_CONFIG.EMAIL_SENDER]: 'noreply@example.com',
      [APP_CONFIG.EMAIL_SENDER_NAME]: '',
    }).sendEmail('someone@example.com', 'Subject');

    expect(send.mock.calls[0][0].senderName).toBe(EMAIL_BRAND.appName);
  });

  it('omits the text body when none was given', async () => {
    await service({
      [APP_CONFIG.EMAIL_SENDER]: 'noreply@example.com',
    }).sendEmail('someone@example.com', 'Subject', '<p>Body</p>');

    expect(send.mock.calls[0][0].text).toBeUndefined();
  });

  it('rejects an unusable recipient before the provider is touched', async () => {
    const error = await service({ [APP_CONFIG.EMAIL_SENDER]: 'a@b.com' })
      .sendEmail('   ', 'Subject')
      .catch((e: unknown) => e);

    expect(body(error)).toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      message: EMAIL_ERRORS.RECIPIENT_REQUIRED,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('passes an empty sender through rather than deciding for the provider', async () => {
    // A provider may hold its own verified sender — SendGrid does — so the
    // decision belongs to it. Rejecting here made EMAIL_SENDER mandatory even
    // for providers that never need it.
    await service({}).sendEmail('someone@example.com', 'Subject');

    expect(send.mock.calls[0][0].senderEmail).toBe('');
  });
});
