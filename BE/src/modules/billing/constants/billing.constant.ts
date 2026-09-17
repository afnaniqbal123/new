import { BILLING_PLAN } from 'src/modules/organization/constants/organization.constant';

/**
 * What each plan costs, in minor units of the billing currency.
 *
 * Listed here rather than read from Stripe so the pricing page renders
 * without a network call, and so a misconfigured Stripe account cannot make
 * the product look free. Stripe remains the authority on what was actually
 * charged; this is what the customer is *told* before they click.
 */
export interface PlanPricing {
  readonly plan: BILLING_PLAN;
  readonly name: string;
  readonly monthlyPrice: number;
  readonly currency: string;
  /** The Stripe Price id, from the dashboard. Absent means not purchasable. */
  readonly stripePriceEnvKey: string | null;
  readonly highlights: readonly string[];
}

export const PLAN_PRICING: readonly PlanPricing[] = [
  {
    plan: BILLING_PLAN.FREE,
    name: 'Free',
    monthlyPrice: 0,
    currency: 'USD',
    stripePriceEnvKey: null,
    highlights: [
      '1 location',
      '500 products',
      '2 users',
      '500 sales a month',
      'Inventory and invoicing',
    ],
  },
  {
    plan: BILLING_PLAN.STARTER,
    name: 'Starter',
    monthlyPrice: 900,
    currency: 'USD',
    stripePriceEnvKey: 'STRIPE_PRICE_STARTER',
    highlights: [
      '3 users',
      'Unlimited products and sales',
      'Customers and credit',
      'Reports',
      'Daily automations',
    ],
  },
  {
    plan: BILLING_PLAN.BUSINESS,
    name: 'Business',
    monthlyPrice: 2900,
    currency: 'USD',
    stripePriceEnvKey: 'STRIPE_PRICE_BUSINESS',
    highlights: [
      '10 users',
      'Multiple locations',
      'WhatsApp ordering',
      'AI Business Clerk',
      'Purchase management',
      'Advanced reports',
    ],
  },
  {
    plan: BILLING_PLAN.ENTERPRISE,
    name: 'Enterprise',
    monthlyPrice: 0,
    currency: 'USD',
    stripePriceEnvKey: null,
    highlights: [
      'Unlimited everything',
      'Priority support',
      'Custom integrations',
    ],
  },
];

/** The subject name for billing in authorization rules. */
export const BILLING_SUBJECT = 'Billing';
