import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeService } from 'src/modules/stripe/stripe.service';
import {
  STRIPE_EVENT_KIND,
  StripeSubscriptionEvent,
} from 'src/modules/stripe/types/subscription-event.type';
import { OrganizationService } from 'src/modules/organization/organization.service';
import {
  BILLING_PLAN,
  PLAN_LIMITS,
  PlanLimits,
} from 'src/modules/organization/constants/organization.constant';
import {
  PLAN_PRICING,
  PlanPricing,
} from 'src/modules/billing/constants/billing.constant';
import { BILLING_RESPONSE } from 'src/modules/billing/constants/api-response/billing.response';
import { CONFIG } from 'src/constants/config.constant';
import { SerializeHttpError } from 'src/utils/serializer';

/** A plan as the pricing page needs it: price, limits and whether it is buyable. */
export interface PlanOption extends PlanPricing {
  limits: PlanLimits;
  current: boolean;
  purchasable: boolean;
}

/**
 * SaaS subscription billing.
 *
 * ## Scope, precisely
 *
 * This bills the *distributor* for using BusinessOS. It does **not** process
 * the distributor's own customer payments — those settle in cash and bank
 * transfer, and card acquiring on their behalf is a different, licensed
 * product. CONTEXT.md D12.
 *
 * ## Why the webhook is the only thing that changes a plan
 *
 * A successful checkout redirect is not proof of payment: the URL is
 * guessable, and a user who closes the tab mid-payment still lands on it.
 * Only `handleWebhook` — verified against Stripe's signature — moves an
 * organization onto a paid plan. The redirect merely says "thanks, this may
 * take a moment".
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly organizationService: OrganizationService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return this.stripeService.isConfigured();
  }

  /**
   * The pricing table, annotated with which plan the caller is on.
   *
   * A plan is purchasable only when billing is configured *and* a Stripe
   * price id exists for it — so a deployment with no Stripe keys shows an
   * honest "contact us" rather than a button that fails.
   */
  async getPlans(organizationId: string): Promise<PlanOption[]> {
    const organization =
      await this.organizationService.findById(organizationId);

    return PLAN_PRICING.map((pricing) => ({
      ...pricing,
      limits: PLAN_LIMITS[pricing.plan],
      current: organization.plan === pricing.plan,
      purchasable: this.isConfigured() && Boolean(this.resolvePriceId(pricing)),
    }));
  }

  private resolvePriceId(pricing: PlanPricing): string | null {
    if (!pricing.stripePriceEnvKey) return null;

    // Price ids live in the environment rather than in code: they differ
    // between a Stripe test account and a live one, and hardcoding either
    // guarantees the wrong one ships.
    return this.config.get<string>(pricing.stripePriceEnvKey) ?? null;
  }

  /**
   * Starts a Stripe Checkout session for a plan.
   *
   * The organization id travels in `client_reference_id` and in metadata, so
   * the webhook can identify the tenant without trusting anything the browser
   * sends back.
   */
  async createCheckoutSession(
    organizationId: string,
    plan: BILLING_PLAN,
    userEmail: string,
  ): Promise<{ url: string }> {
    if (!this.isConfigured()) {
      return SerializeHttpError(
        null,
        HttpStatus.SERVICE_UNAVAILABLE,
        BILLING_RESPONSE.NOT_CONFIGURED,
      );
    }

    const pricing = PLAN_PRICING.find((candidate) => candidate.plan === plan);
    const priceId = pricing ? this.resolvePriceId(pricing) : null;

    if (!pricing || !priceId) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        BILLING_RESPONSE.PLAN_NOT_PURCHASABLE,
      );
    }

    const organization =
      await this.organizationService.findById(organizationId);
    const frontendUrl = this.config.get<string>(CONFIG.FRONTEND_URL) ?? '';

    const session = await this.stripeService.createSubscriptionCheckout({
      priceId,
      organizationId,
      plan,
      customerEmail: userEmail,
      customerId: organization.stripeCustomerId,
      successUrl: `${frontendUrl}/settings/billing?status=success`,
      cancelUrl: `${frontendUrl}/settings/billing?status=cancelled`,
    });

    if (!session.url) {
      return SerializeHttpError(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        BILLING_RESPONSE.NOT_CONFIGURED,
      );
    }

    return { url: session.url };
  }

  /**
   * Opens Stripe's own billing portal.
   *
   * Card updates, invoice history and cancellation all live there rather than
   * being rebuilt here — Stripe handles the PCI surface, and a hand-rolled
   * card form would be strictly worse in every respect.
   */
  async createPortalSession(organizationId: string): Promise<{ url: string }> {
    if (!this.isConfigured()) {
      return SerializeHttpError(
        null,
        HttpStatus.SERVICE_UNAVAILABLE,
        BILLING_RESPONSE.NOT_CONFIGURED,
      );
    }

    const organization =
      await this.organizationService.findById(organizationId);

    if (!organization.stripeCustomerId) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        BILLING_RESPONSE.NO_SUBSCRIPTION,
      );
    }

    const frontendUrl = this.config.get<string>(CONFIG.FRONTEND_URL) ?? '';

    const session = await this.stripeService.createBillingPortalSession({
      customerId: organization.stripeCustomerId,
      returnUrl: `${frontendUrl}/settings/billing`,
    });

    return { url: session.url };
  }

  async getSubscription(organizationId: string): Promise<{
    plan: BILLING_PLAN;
    limits: PlanLimits;
    renewsAt: Date | null;
    hasStripeSubscription: boolean;
    billingConfigured: boolean;
  }> {
    const organization =
      await this.organizationService.findById(organizationId);

    return {
      plan: organization.plan,
      limits: PLAN_LIMITS[organization.plan],
      renewsAt: organization.planRenewsAt || null,
      hasStripeSubscription: Boolean(organization.stripeSubscriptionId),
      billingConfigured: this.isConfigured(),
    };
  }

  /**
   * Applies a verified Stripe event.
   *
   * The **only** path that changes an organization's plan. Everything else —
   * the checkout redirect, the portal return — is presentation.
   *
   * Verification and translation happen in `StripeService`; what arrives here
   * is already this application's own vocabulary, with no SDK types in it.
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secret = this.config.get<string>(CONFIG.STRIPE_WEBHOOK_SECRET);

    if (!secret) {
      return SerializeHttpError(
        null,
        HttpStatus.SERVICE_UNAVAILABLE,
        BILLING_RESPONSE.NOT_CONFIGURED,
      );
    }

    const event = this.stripeService.verifySubscriptionEvent(
      rawBody,
      signature,
      secret,
    );

    if (!event) {
      // No detail in the message: a caller who failed signature verification
      // is not owed an explanation of why.
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        BILLING_RESPONSE.WEBHOOK_INVALID,
      );
    }

    switch (event.kind) {
      case STRIPE_EVENT_KIND.CHECKOUT_COMPLETED:
        await this.onCheckoutCompleted(event);
        break;

      case STRIPE_EVENT_KIND.SUBSCRIPTION_CHANGED:
        await this.onSubscriptionChanged(event);
        break;

      case STRIPE_EVENT_KIND.SUBSCRIPTION_CANCELLED:
        await this.onSubscriptionCancelled(event);
        break;

      case STRIPE_EVENT_KIND.IGNORED:
        this.logger.debug(`Ignoring Stripe event ${event.rawType}.`);
        break;
    }
  }

  private async onCheckoutCompleted(
    event: StripeSubscriptionEvent,
  ): Promise<void> {
    if (!event.organizationId || !event.plan) {
      this.logger.warn(
        'Checkout completed without organization metadata; ignoring.',
      );

      return;
    }

    await this.organizationService.applyPlan(event.organizationId, {
      plan: event.plan as BILLING_PLAN,
      stripeCustomerId: event.customerId,
      stripeSubscriptionId: event.subscriptionId,
    });

    this.logger.log(
      `Organization ${event.organizationId} moved to the ${event.plan} plan.`,
    );
  }

  private async onSubscriptionChanged(
    event: StripeSubscriptionEvent,
  ): Promise<void> {
    if (!event.organizationId) return;

    // An inactive subscription keeps its plan here rather than downgrading:
    // `active` already treats `past_due` as paying, and a hard downgrade
    // mid-retry would lock a business out of its own till over a bank blip.
    await this.organizationService.applyPlan(event.organizationId, {
      plan: event.active ? (event.plan as BILLING_PLAN) : undefined,
      stripeSubscriptionId: event.subscriptionId,
      renewsAt: event.renewsAt,
    });
  }

  private async onSubscriptionCancelled(
    event: StripeSubscriptionEvent,
  ): Promise<void> {
    if (!event.organizationId) return;

    // Back to FREE rather than suspended: a distributor who stops paying must
    // still be able to read their own ledgers and invoice history. Locking
    // them out of their records would be indefensible.
    await this.organizationService.applyPlan(event.organizationId, {
      plan: BILLING_PLAN.FREE,
      stripeSubscriptionId: '',
    });

    this.logger.log(
      `Organization ${event.organizationId} returned to the FREE plan.`,
    );
  }
}
