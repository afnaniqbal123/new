export enum BILLING_RESPONSE {
  PLANS_FETCHED = 'Plans fetched successfully',
  SUBSCRIPTION_FETCHED = 'Subscription fetched successfully',
  CHECKOUT_CREATED = 'Checkout session created successfully',
  PORTAL_CREATED = 'Billing portal session created successfully',
  PLAN_CHANGED = 'Plan updated successfully',
  CANCELLED = 'Subscription cancelled successfully',
  NOT_CONFIGURED = 'Billing is not configured on this deployment',
  PLAN_NOT_PURCHASABLE = 'That plan cannot be bought online — contact sales',
  NO_SUBSCRIPTION = 'This organization has no active subscription',
  WEBHOOK_INVALID = 'Webhook signature verification failed',
}
