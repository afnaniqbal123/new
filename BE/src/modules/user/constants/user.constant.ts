/**
 * Who a user is inside their Organization.
 *
 * These six are the whole vocabulary — every permission question in the system
 * resolves against one of them, in a policy file, and nowhere else. They are
 * ordered by descending authority, which is also the order the policies read.
 *
 * `MANAGER`, `CASHIER` and `ACCOUNTANT` are genuinely different jobs in a
 * distribution business, not tiers of one: a cashier rings up sales but may
 * not see margin; an accountant reconciles ledgers but may not touch stock.
 * Collapsing them into a single "member" role is what forces per-controller
 * role checks later. See CONTEXT.md § D5.
 */
export enum USER_ROLES {
  /** Created the Organization. Unrestricted, including billing and deletion. */
  OWNER = 'OWNER',
  /** Full operational control; may manage users. Not billing. */
  ADMIN = 'ADMIN',
  /** Runs day-to-day operations: purchasing, stock, pricing, reports. */
  MANAGER = 'MANAGER',
  /** Sells. POS, invoices, customer payments. No cost or margin visibility. */
  CASHIER = 'CASHIER',
  /** Money only: ledgers, payments, reconciliation, financial reports. */
  ACCOUNTANT = 'ACCOUNTANT',
  /** Read-only across the Organization. */
  VIEWER = 'VIEWER',
}

/**
 * Roles that confer ownership of an Organization.
 *
 * A named set rather than an inline `role === OWNER` comparison, so that "what
 * counts as an owner?" has exactly one answer. If co-ownership ever gains a
 * second role, every owner-count check follows from editing this line.
 *
 * Used by the invariant that an Organization must always retain at least one
 * active owner — see `UserService.assertOrganizationKeepsAnOwner`.
 */
export const OWNERSHIP_ROLES: readonly USER_ROLES[] = [USER_ROLES.OWNER];

export enum USER_STATUS {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  UNAPPROVED = 'UNAPPROVED',
}

export const NOT_ALLOWED_USERS = [
  USER_STATUS.INACTIVE,
  USER_STATUS.UNAPPROVED,
  USER_STATUS.PENDING,
];
