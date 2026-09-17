/**
 * Currency a plan is priced in when the request does not say.
 *
 * Matches the default on the plan schema, so a plan created through the API
 * and one created by the seed script are priced the same way.
 */
export const DEFAULT_PLAN_CURRENCY = 'usd';

/**
 * Smallest recurring charge Stripe will accept, in the currency's minor unit.
 * Refused here so the caller gets a validation error rather than a Stripe one.
 */
export const MINIMUM_PLAN_AMOUNT = 50;
