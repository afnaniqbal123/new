/**
 * The automations this system runs.
 *
 * A closed set: each one is a specific, scheduled piece of work with an
 * owner, not a generic "run anything" hook. That keeps the queue auditable —
 * every job in it corresponds to a named behaviour someone can point at.
 */
export enum AUTOMATION_KIND {
  /** "Good morning. 7 products are low and 4 payments are overdue." */
  MORNING_DIGEST = 'MORNING_DIGEST',
  /** "Today's sales: PKR 4,320 across 18 invoices." */
  EVENING_SUMMARY = 'EVENING_SUMMARY',
  /** Chases customers whose invoices have gone past due. */
  PAYMENT_REMINDER = 'PAYMENT_REMINDER',
  /** Flags products at or below their reorder level. */
  LOW_STOCK_ALERT = 'LOW_STOCK_ALERT',
  /** "Ahmed hasn't bought anything in 32 days." */
  DORMANT_CUSTOMER = 'DORMANT_CUSTOMER',
  /** Rebuilds cached stock and balances from the ledgers. */
  RECONCILIATION = 'RECONCILIATION',
}

export enum AUTOMATION_STATUS {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  /** The organization's plan or settings do not permit it. */
  SKIPPED = 'SKIPPED',
}

/** How a digest or reminder reached its recipient. */
export enum DELIVERY_CHANNEL {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
}

/** The BullMQ queue name. One queue, discriminated by job kind. */
export const AUTOMATION_QUEUE = 'businessos-automation';

/** The subject name for automations in authorization rules. */
export const AUTOMATION_SUBJECT = 'Automation';

/** How many days without a purchase before a customer counts as dormant. */
export const DORMANT_AFTER_DAYS = 30;

/** How far past due before a payment reminder goes out. */
export const REMINDER_AFTER_DAYS_OVERDUE = 1;
