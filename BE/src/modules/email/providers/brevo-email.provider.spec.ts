import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EMAIL_ERRORS } from '../constants/api-response/email.response';
import { BrevoEmailProvider } from './brevo-email.provider';
import type { SendEmailOptions } from './email-provider.interface';

const sendTransacEmail = jest.fn();

jest.mock('@getbrevo/brevo', () => ({
  BrevoClient: jest.fn().mockImplementation(() => ({
    transactionalEmails: { sendTransacEmail },
  })),
}));

const options = (over: Partial<SendEmailOptions> = {}): SendEmailOptions => ({
  to: 'someone@example.com',
  subject: 'Subject',
  html: '<p>Body</p>',
  senderEmail: 'shared@example.com',
  senderName: 'Brand',
  ...over,
});

const provider = () =>
  new BrevoEmailProvider({ get: () => undefined } as unknown as ConfigService);

const body = (error: unknown) =>
  (error as HttpException).getResponse() as { status: number; message: string };

describe('BrevoEmailProvider', () => {
  beforeEach(() => sendTransacEmail.mockReset().mockResolvedValue({}));

  it('maps the message onto the Brevo payload', async () => {
    await provider().send(options({ text: 'Body' }));

    expect(sendTransacEmail).toHaveBeenCalledWith({
      to: [{ email: 'someone@example.com' }],
      subject: 'Subject',
      htmlContent: '<p>Body</p>',
      textContent: 'Body',
      sender: { email: 'shared@example.com', name: 'Brand' },
    });
  });

  it('omits textContent when there is no plain-text body', async () => {
    // Brevo rejects a null textContent rather than ignoring it, so the key has
    // to be absent, not empty.
    await provider().send(options());

    expect(sendTransacEmail.mock.calls[0][0]).not.toHaveProperty('textContent');
  });

  it('refuses to send when no sender is configured', async () => {
    const error = await provider()
      .send(options({ senderEmail: '' }))
      .catch((e: unknown) => e);

    expect(body(error)).toMatchObject({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: EMAIL_ERRORS.SENDER_NOT_CONFIGURED,
    });
    expect(sendTransacEmail).not.toHaveBeenCalled();
  });

  it('names an unreachable provider separately from a refusal', async () => {
    // The SDK reports a network failure as a bare "fetch failed", which says
    // nothing actionable — a bad key and an unreachable host need different
    // fixes, so they get different messages.
    sendTransacEmail.mockRejectedValue({ message: 'fetch failed' });

    const error = await provider()
      .send(options())
      .catch((e: unknown) => e);

    expect(body(error).message).toBe(EMAIL_ERRORS.PROVIDER_UNREACHABLE);
  });

  it('reports a rejected message as a send failure', async () => {
    sendTransacEmail.mockRejectedValue({
      body: { message: 'Invalid API key' },
    });

    const error = await provider()
      .send(options())
      .catch((e: unknown) => e);

    expect(body(error).message).toBe(EMAIL_ERRORS.SEND_FAILED);
  });

  it('does not leak the vendor error text to the caller', async () => {
    sendTransacEmail.mockRejectedValue({
      body: { message: 'Invalid API key' },
    });

    const error = await provider()
      .send(options())
      .catch((e: unknown) => e);

    expect(JSON.stringify(body(error))).not.toContain('Invalid API key');
  });
});
