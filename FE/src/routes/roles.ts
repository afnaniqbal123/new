/**
 * The one place a role is registered. Everything else in the role system —
 * the route table and sidebar in `ProtectedRoutes.tsx` — is keyed off this
 * enum, so adding a role here is what makes it available to route for.
 *
 * These six mirror the backend's `USER_ROLES` exactly. They must: the role
 * arrives as a claim in the access token, and a value the frontend does not
 * recognise would fall through every route guard to "no access", which looks
 * to the user like a broken account rather than a mismatched enum.
 *
 * Each is a genuinely different job in a distribution business, not a tier —
 * see CONTEXT.md § D5.
 */
export enum Role {
  /** Created the business. Unrestricted, including billing. */
  OWNER = 'OWNER',
  /** Full operational control and user management. Not billing. */
  ADMIN = 'ADMIN',
  /** Runs operations: purchasing, stock, pricing, reports. */
  MANAGER = 'MANAGER',
  /** Sells. POS, invoices, customer payments. No cost or margin. */
  CASHIER = 'CASHIER',
  /** Money only: ledgers, payments, reconciliation, financial reports. */
  ACCOUNTANT = 'ACCOUNTANT',
  /** Read-only. */
  VIEWER = 'VIEWER',
}

/** Every role, in descending authority — the order settings screens list them. */
export const ROLES_IN_ORDER: readonly Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.CASHIER,
  Role.ACCOUNTANT,
  Role.VIEWER,
];

/**
 * Narrows an untrusted string — one read off a token claim or an API payload —
 * to a `Role`.
 *
 * An enum member is nominal, so a plain string is not assignable to it without
 * a boundary cast; doing that cast here, once, keeps it out of every call site.
 */
export function isRole(value: string): value is Role {
  return ROLES_IN_ORDER.includes(value as Role);
}

/**
 * Roles that may see cost and margin.
 *
 * Mirrors the backend's `PROFIT_REPORT_SUBJECT` policy so the UI can hide a
 * column rather than render an empty one. **This is presentation only** — the
 * API strips those fields regardless of what the client believes, and that is
 * the check that matters.
 */
export const ROLES_WITH_MARGIN: readonly Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.ACCOUNTANT,
];
