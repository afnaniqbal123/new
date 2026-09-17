/**
 * Stripe events, normalised into shapes that carry no SDK types.
 *
 * The `stripe` package is owned by `modules/stripe` — `architecture:check`'s
 * provider-SDK rule stops any other module importing it, and rightly: a
 * `Stripe.Subscription` in a billing signature means every consumer is pinned
 * to whatever version of the SDK this project happens to have, and a major
 * bump becomes a change across unrelated modules.
 *
 * So the Stripe module translates. These types are the vocabulary billing
 * actually needs, which is considerably smaller than Stripe's.
 */

export enum STRIPE_EVENT_KIND {
  CHECKOUT_COMPLETED = 'CHECKOUT_COMPLETED',
  SUBSCRIPTION_CHANGED = 'SUBSCRIPTION_CHANGED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  /** A real, verified event this application does not act on. */
  IGNORED = 'IGNORED',
}

/**
 * What a verified Stripe event means to BusinessOS.
 *
 * `organizationId` and `plan` come from the metadata the checkout session was
 * created with — never from anything the browser sent back — which is what
 * makes the webhook the trustworthy path.
 */
export interface StripeSubscriptionEvent {
  kind: STRIPE_EVENT_KIND;
  organizationId?: string;
  /** The plan name as it was stamped into metadata at checkout. */
  plan?: string;
  customerId?: string;
  subscriptionId?: string;
  /**
   * Whether the subscription is currently paying.
   *
   * `past_due` and `unpaid` deliberately read as active: Stripe retries for
   * days, and downgrading a business mid-retry would lock them out of their
   * own till over a bank blip.
   */
  active?: boolean;
  renewsAt?: Date;
  /** The raw Stripe type, for logging. Never branched on outside this module. */
  rawType: string;
}

export interface CheckoutSessionRequest {
  priceId: string;
  organizationId: string;
  plan: string;
  customerEmail?: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PortalSessionRequest {
  customerId: string;
  returnUrl: string;
}
