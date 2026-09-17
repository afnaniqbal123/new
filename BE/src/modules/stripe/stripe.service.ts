import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { User } from '../user/user.schema';
import { CONFIG } from 'src/constants/config.constant';
import {
  CheckoutSessionRequest,
  PortalSessionRequest,
  STRIPE_EVENT_KIND,
  StripeSubscriptionEvent,
} from 'src/modules/stripe/types/subscription-event.type';

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const stripeSecretKey = this.configService.get<string>(
      CONFIG.STRIPE_SECRET_KEY,
    );
    const stripeWebhookSecret = this.configService.get<string>(
      CONFIG.STRIPE_WEBHOOK_SECRET,
    );
    // Warn, never throw. Billing is one feature among many, and refusing to
    // boot without it would mean a distributor cannot open their till because
    // nobody has filled in a Stripe key. `getStripeClient()` still throws at
    // the point of use, so a billing call fails loudly while everything else
    // keeps working.
    if (!stripeSecretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set — billing is disabled. Every other feature is unaffected.',
      );

      return;
    }

    if (!stripeWebhookSecret) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET is not set — subscription webhooks cannot be verified and will be rejected.',
      );
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-10-29.clover',
    });
  }

  /**
   * Whether billing is usable, so a caller can offer an honest message
   * instead of a checkout button that throws.
   */
  isConfigured(): boolean {
    return Boolean(this.stripe);
  }

  getStripeClient(): Stripe {
    if (!this.stripe) {
      throw new Error(
        'Stripe client not initialized. Make sure STRIPE_SECRET_KEY is configured.',
      );
    }
    return this.stripe;
  }

  async getOrCreateStripeCustomer(user: User): Promise<Stripe.Customer> {
    const stripe = this.getStripeClient();

    if (user.stripeCustomerId) {
      try {
        return (await stripe.customers.retrieve(
          user.stripeCustomerId,
        )) as Stripe.Customer;
      } catch (error) {
        // Customer doesn't exist, create new one
      }
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        // add metadata to the customer
        userId: (user as any)._id?.toString() || user.email,
      },
    });

    return customer;
  }

  // --- Subscription billing ----------------------------------------------
  //
  // These exist here rather than in `modules/billing` because the Stripe SDK
  // belongs to this module (`architecture:check`'s provider-SDK rule). Billing
  // deals in plans and organizations; this deals in Stripe.

  /**
   * Opens a Checkout session for a subscription.
   *
   * The organization id is written into both `client_reference_id` (what a
   * human sees in the Stripe dashboard) and metadata on the session *and* the
   * subscription — the last of which is what later `customer.subscription.*`
   * events carry, and without it those events cannot be attributed to a tenant.
   */
  async createSubscriptionCheckout(
    request: CheckoutSessionRequest,
  ): Promise<{ url: string | null }> {
    const stripe = this.getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: request.priceId, quantity: 1 }],
      customer: request.customerId || undefined,
      customer_email: request.customerId ? undefined : request.customerEmail,
      client_reference_id: request.organizationId,
      metadata: {
        organizationId: request.organizationId,
        plan: request.plan,
      },
      subscription_data: {
        metadata: {
          organizationId: request.organizationId,
          plan: request.plan,
        },
      },
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
    });

    return { url: session.url };
  }

  async createBillingPortalSession(
    request: PortalSessionRequest,
  ): Promise<{ url: string }> {
    const stripe = this.getStripeClient();

    const session = await stripe.billingPortal.sessions.create({
      customer: request.customerId,
      return_url: request.returnUrl,
    });

    return { url: session.url };
  }

  /**
   * Verifies a webhook and translates it into this application's vocabulary.
   *
   * Returns null when the signature does not verify. The caller decides what
   * to do about that; this method's job is to refuse to interpret unverified
   * bytes, not to choose a status code.
   */
  verifySubscriptionEvent(
    rawBody: Buffer,
    signature: string,
    webhookSecret: string,
  ): StripeSubscriptionEvent | null {
    const stripe = this.getStripeClient();

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      return null;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        return {
          kind: STRIPE_EVENT_KIND.CHECKOUT_COMPLETED,
          organizationId:
            session.metadata?.organizationId ??
            session.client_reference_id ??
            undefined,
          plan: session.metadata?.plan,
          customerId: this.idOf(session.customer),
          subscriptionId: this.idOf(session.subscription),
          rawType: event.type,
        };
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;

        return {
          kind: STRIPE_EVENT_KIND.SUBSCRIPTION_CHANGED,
          organizationId: subscription.metadata.organizationId,
          plan: subscription.metadata.plan,
          customerId: this.idOf(subscription.customer),
          subscriptionId: subscription.id,
          active:
            subscription.status === 'active' ||
            subscription.status === 'trialing' ||
            subscription.status === 'past_due',
          renewsAt: this.renewalDate(subscription),
          rawType: event.type,
        };
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        return {
          kind: STRIPE_EVENT_KIND.SUBSCRIPTION_CANCELLED,
          organizationId: subscription.metadata.organizationId,
          customerId: this.idOf(subscription.customer),
          subscriptionId: subscription.id,
          active: false,
          rawType: event.type,
        };
      }

      default:
        return { kind: STRIPE_EVENT_KIND.IGNORED, rawType: event.type };
    }
  }

  /** Stripe returns either an id or an expanded object, depending on context. */
  private idOf(
    value: string | { id: string } | null | undefined,
  ): string | undefined {
    if (!value) return undefined;

    return typeof value === 'string' ? value : value.id;
  }

  /**
   * When the subscription next renews.
   *
   * Checked in two places because Stripe moved this field from the
   * subscription onto its items across API versions, and reading only the one
   * this SDK happens to type would silently return undefined on the other.
   */
  private renewalDate(subscription: Stripe.Subscription): Date | undefined {
    const candidate =
      (subscription as unknown as { current_period_end?: number })
        .current_period_end ??
      subscription.items?.data?.[0]?.current_period_end;

    return typeof candidate === 'number'
      ? new Date(candidate * 1000)
      : undefined;
  }
}
