import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { CONFIG } from 'src/constants/config.constant';

/** The outcome of an attempted send. Never throws — the caller records it. */
export interface SendResult {
  ok: boolean;
  /** Meta's message id, when the send succeeded. */
  messageId?: string;
  error?: string;
  /** True when the message was recorded locally rather than actually sent. */
  simulated: boolean;
}

/**
 * Talks to the WhatsApp Cloud API — or stands in for it.
 *
 * ## Why a simulated mode exists
 *
 * Getting a real WhatsApp number requires a Meta Business account, a verified
 * business, a registered number, and template approval that takes days. None
 * of that can be automated, and none of it should block building, demoing or
 * testing the feature. So when credentials are absent this provider records
 * what it *would* have sent and reports success.
 *
 * The important property: **the calling code is identical either way**. There
 * is no `if (simulated)` anywhere above this class. The day real credentials
 * land, they go in `.env` and nothing else changes. CONTEXT.md D10.
 */
@Injectable()
export class WhatsAppCloudProvider {
  private readonly logger = new Logger(WhatsAppCloudProvider.name);

  constructor(private readonly config: ConfigService) {}

  /** Whether real credentials are present. */
  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>(CONFIG.WHATSAPP_ACCESS_TOKEN) &&
      this.config.get<string>(CONFIG.WHATSAPP_PHONE_NUMBER_ID),
    );
  }

  /**
   * Answers Meta's webhook verification handshake.
   *
   * Meta issues a GET with a challenge when the webhook URL is first
   * registered, and expects the challenge echoed back only if the verify
   * token matches. Returning the challenge unconditionally would let anyone
   * register their own webhook against this endpoint.
   */
  verifyWebhookChallenge(
    mode: string,
    token: string,
    challenge: string,
  ): string | null {
    const expected = this.config.get<string>(CONFIG.WHATSAPP_VERIFY_TOKEN);

    if (mode !== 'subscribe' || !expected || token !== expected) {
      return null;
    }

    return challenge;
  }

  /**
   * Verifies the `X-Hub-Signature-256` header against the raw request body.
   *
   * This is what makes the webhook route safe: without it, anyone who learns
   * the URL can post fabricated orders into a business's inbox.
   *
   * Two details that matter:
   *
   * - The hash is over the **raw bytes**, not over re-serialised JSON. Any
   *   round trip through `JSON.parse`/`stringify` changes key order and
   *   whitespace, and the signature stops matching.
   * - The comparison is `timingSafeEqual`, not `===`. A byte-by-byte early
   *   return leaks how much of a guessed signature was correct.
   *
   * When no app secret is configured the method returns false and the caller
   * decides — in practice, accepting only simulated traffic.
   */
  verifySignature(rawBody: Buffer | undefined, signature?: string): boolean {
    const secret = this.config.get<string>(CONFIG.WHATSAPP_APP_SECRET);

    if (!secret || !rawBody || !signature) return false;

    const expected = `sha256=${createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);

    // `timingSafeEqual` throws on a length mismatch rather than returning
    // false, so the lengths are compared first — that comparison leaks only
    // the length, which the attacker already knows.
    if (expectedBuffer.length !== actualBuffer.length) return false;

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  /**
   * Sends a free-form text message.
   *
   * Only valid inside the 24-hour window after the customer last wrote; the
   * caller checks that, because it is a business rule rather than a transport
   * concern.
   */
  async sendText(to: string, text: string): Promise<SendResult> {
    return this.send(to, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    });
  }

  /**
   * Sends a pre-approved template — the only thing Meta permits outside the
   * 24-hour window, and therefore what every reminder and digest uses.
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    parameters: readonly string[],
  ): Promise<SendResult> {
    return this.send(to, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: parameters.length
          ? [
              {
                type: 'body',
                parameters: parameters.map((value) => ({
                  type: 'text',
                  text: value,
                })),
              },
            ]
          : [],
      },
    });
  }

  private async send(
    to: string,
    payload: Record<string, unknown>,
  ): Promise<SendResult> {
    if (!this.isConfigured()) {
      this.logger.log(
        `WhatsApp not configured — simulating send to ${to}. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to send for real.`,
      );

      return {
        ok: true,
        simulated: true,
        messageId: `sim-${Date.now().toString(36)}`,
      };
    }

    const version =
      this.config.get<string>(CONFIG.WHATSAPP_API_VERSION) ?? 'v21.0';
    const phoneNumberId = this.config.get<string>(
      CONFIG.WHATSAPP_PHONE_NUMBER_ID,
    );
    const token = this.config.get<string>(CONFIG.WHATSAPP_ACCESS_TOKEN);

    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${String(phoneNumberId)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${String(token)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as {
        messages?: { id: string }[];
        error?: { message?: string };
      };

      if (!response.ok) {
        // Returned rather than thrown: a failed send is a fact to record on
        // the message, not an exception that should fail the request that
        // triggered it (often a background job).
        return {
          ok: false,
          simulated: false,
          error: body.error?.message ?? `HTTP ${String(response.status)}`,
        };
      }

      return {
        ok: true,
        simulated: false,
        messageId: body.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        ok: false,
        simulated: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }
}
