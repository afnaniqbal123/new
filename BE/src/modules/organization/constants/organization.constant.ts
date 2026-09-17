export enum ORGANIZATION_STATUS {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

/**
 * What kind of place stock sits in.
 *
 * A van matters as its own kind because mobile stock is normal in
 * distribution and reconciles differently from a fixed location.
 */
export enum LOCATION_TYPE {
  WAREHOUSE = 'WAREHOUSE',
  SHOP = 'SHOP',
  VAN = 'VAN',
}

/**
 * SaaS plans. Limits are enforced server-side by `PlanLimitGuard`; the numbers
 * live in `PLAN_LIMITS` below so the guard and the pricing page cannot drift.
 */
export enum BILLING_PLAN {
  FREE = 'FREE',
  STARTER = 'STARTER',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
}

/**
 * What each plan actually permits.
 *
 * `null` means unlimited. These are checked on write, not on display — a plan
 * limit that only greys out a button is not a limit, it is a suggestion.
 */
export interface PlanLimits {
  readonly users: number | null;
  readonly products: number | null;
  readonly locations: number | null;
  /** Sales per calendar month. */
  readonly salesPerMonth: number | null;
  readonly whatsapp: boolean;
  readonly aiClerk: boolean;
  readonly automations: boolean;
}

export const PLAN_LIMITS: Readonly<Record<BILLING_PLAN, PlanLimits>> = {
  [BILLING_PLAN.FREE]: {
    users: 2,
    products: 500,
    locations: 1,
    salesPerMonth: 500,
    whatsapp: false,
    aiClerk: false,
    automations: false,
  },
  [BILLING_PLAN.STARTER]: {
    users: 3,
    products: null,
    locations: 1,
    salesPerMonth: null,
    whatsapp: false,
    aiClerk: false,
    automations: true,
  },
  [BILLING_PLAN.BUSINESS]: {
    users: 10,
    products: null,
    locations: null,
    salesPerMonth: null,
    whatsapp: true,
    aiClerk: true,
    automations: true,
  },
  [BILLING_PLAN.ENTERPRISE]: {
    users: null,
    products: null,
    locations: null,
    salesPerMonth: null,
    whatsapp: true,
    aiClerk: true,
    automations: true,
  },
};

/** The subject name for organization records in authorization rules. */
export const ORGANIZATION_SUBJECT = 'Organization';

/** The subject name for location records in authorization rules. */
export const LOCATION_SUBJECT = 'Location';
