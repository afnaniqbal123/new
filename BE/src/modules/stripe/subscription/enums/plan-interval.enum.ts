/**
 * Billing intervals a subscription plan may be sold on.
 *
 * Stripe also accepts `day` and `week`. They are absent because the plan
 * schema documents the catalogue as monthly or yearly, and an interval the
 * rest of the system does not expect is easier to refuse at the edge than to
 * discover in a renewal.
 */
export enum PlanIntervalEnum {
  MONTH = 'month',
  YEAR = 'year',
}
