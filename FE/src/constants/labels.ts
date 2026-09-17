import type { TranslationKey } from 'src/i18n';
import type { BadgeTone } from 'src/components/common/Badge';

/**
 * Maps from the API's enum values to translation keys and badge tones.
 *
 * ## Why these exist rather than `t(\`STATUS_${value}\`)`
 *
 * Two reasons, and the second is the important one:
 *
 * 1. A template-literal key needs an `as 'STATUS_COMPLETED'` cast to satisfy
 *    i18next's typed `t()`, which asserts a lie — the value could be any of
 *    six things.
 * 2. `check:i18n` finds a key by scanning for it as a **quoted literal**. A
 *    key only ever built by interpolation is invisible to it and reports as
 *    orphaned — so the choice is between a dead-key false positive on every
 *    run, or the check being switched off. Writing the keys out restores it.
 *
 * Every map is `Partial<Record<string, …>>` on purpose: the value arrives from
 * the API, and a server that adds an enum member must render as a sensible
 * fallback rather than crashing a table.
 */

export const SALE_STATUS_LABEL: Partial<Record<string, TranslationKey>> = {
  COMPLETED: 'STATUS_COMPLETED',
  DRAFT: 'STATUS_DRAFT',
  VOID: 'STATUS_VOID',
};

export const SALE_STATUS_TONE: Partial<Record<string, BadgeTone>> = {
  COMPLETED: 'success',
  DRAFT: 'neutral',
  VOID: 'danger',
};

export const MEMBER_STATUS_LABEL: Partial<Record<string, TranslationKey>> = {
  ACTIVE: 'STATUS_ACTIVE',
  INACTIVE: 'STATUS_INACTIVE',
  PENDING: 'STATUS_PENDING',
};

export const SALE_SOURCE_LABEL: Partial<Record<string, TranslationKey>> = {
  POS: 'SOURCE_POS',
  WHATSAPP: 'SOURCE_WHATSAPP',
  API: 'SOURCE_API',
};

export const PAYMENT_METHOD_LABEL: Partial<Record<string, TranslationKey>> = {
  CASH: 'PAYMENT_CASH',
  BANK: 'PAYMENT_BANK',
  CARD: 'PAYMENT_CARD',
  CREDIT: 'PAYMENT_CREDIT',
  WALLET: 'PAYMENT_WALLET',
};

export const ROLE_LABEL: Partial<Record<string, TranslationKey>> = {
  OWNER: 'ROLE_OWNER',
  ADMIN: 'ROLE_ADMIN',
  MANAGER: 'ROLE_MANAGER',
  CASHIER: 'ROLE_CASHIER',
  ACCOUNTANT: 'ROLE_ACCOUNTANT',
  VIEWER: 'ROLE_VIEWER',
};

export const ROLE_HELP_LABEL: Partial<Record<string, TranslationKey>> = {
  OWNER: 'ROLE_OWNER_HELP',
  ADMIN: 'ROLE_ADMIN_HELP',
  MANAGER: 'ROLE_MANAGER_HELP',
  CASHIER: 'ROLE_CASHIER_HELP',
  ACCOUNTANT: 'ROLE_ACCOUNTANT_HELP',
  VIEWER: 'ROLE_VIEWER_HELP',
};

export const CONFIDENCE_LABEL: Partial<Record<string, TranslationKey>> = {
  EXACT: 'CONFIDENCE_EXACT',
  HIGH: 'CONFIDENCE_HIGH',
  MEDIUM: 'CONFIDENCE_MEDIUM',
  LOW: 'CONFIDENCE_LOW',
};

export const CONFIDENCE_TONE: Partial<Record<string, BadgeTone>> = {
  EXACT: 'success',
  HIGH: 'success',
  MEDIUM: 'warning',
  LOW: 'danger',
};

export const AGING_BUCKET_LABEL: Partial<Record<string, TranslationKey>> = {
  CURRENT: 'AGING_CURRENT',
  D1_30: 'AGING_D1_30',
  D31_60: 'AGING_D31_60',
  D61_90: 'AGING_D61_90',
  D90_PLUS: 'AGING_D90_PLUS',
};

export const PURCHASE_ORDER_TONE: Partial<Record<string, BadgeTone>> = {
  DRAFT: 'neutral',
  SENT: 'info',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

export const REPORT_LABEL: Partial<Record<string, TranslationKey>> = {
  SALES_SUMMARY: 'REPORT_SALES_SUMMARY',
  SALES_BY_DAY: 'REPORT_SALES_BY_DAY',
  TOP_PRODUCTS: 'REPORT_TOP_PRODUCTS',
  TOP_CUSTOMERS: 'REPORT_TOP_CUSTOMERS',
  PROFIT: 'REPORT_PROFIT',
  RECEIVABLES_AGING: 'REPORT_RECEIVABLES_AGING',
  PAYABLES: 'REPORT_PAYABLES',
  LOW_STOCK: 'REPORT_LOW_STOCK',
  STOCK_VALUATION: 'REPORT_STOCK_VALUATION',
  DEAD_STOCK: 'REPORT_DEAD_STOCK',
  EXPIRING_STOCK: 'REPORT_EXPIRING_STOCK',
  PURCHASES_SUMMARY: 'REPORT_PURCHASES_SUMMARY',
  CASH_POSITION: 'REPORT_CASH_POSITION',
};

export const PERIOD_LABEL: Partial<Record<string, TranslationKey>> = {
  TODAY: 'PERIOD_TODAY',
  YESTERDAY: 'PERIOD_YESTERDAY',
  THIS_WEEK: 'PERIOD_THIS_WEEK',
  LAST_7_DAYS: 'PERIOD_LAST_7_DAYS',
  THIS_MONTH: 'PERIOD_THIS_MONTH',
  LAST_MONTH: 'PERIOD_LAST_MONTH',
  LAST_30_DAYS: 'PERIOD_LAST_30_DAYS',
  THIS_YEAR: 'PERIOD_THIS_YEAR',
  CUSTOM: 'PERIOD_CUSTOM',
};

export const AUTOMATION_LABEL: Partial<Record<string, TranslationKey>> = {
  MORNING_DIGEST: 'AUTOMATION_MORNING_DIGEST',
  EVENING_SUMMARY: 'AUTOMATION_EVENING_SUMMARY',
  PAYMENT_REMINDER: 'AUTOMATION_PAYMENT_REMINDER',
  LOW_STOCK_ALERT: 'AUTOMATION_LOW_STOCK_ALERT',
  DORMANT_CUSTOMER: 'AUTOMATION_DORMANT_CUSTOMER',
  RECONCILIATION: 'AUTOMATION_RECONCILIATION',
};

export const LOCATION_TYPE_LABEL: Partial<Record<string, TranslationKey>> = {
  WAREHOUSE: 'LOCATION_TYPE_WAREHOUSE',
  SHOP: 'LOCATION_TYPE_SHOP',
  VAN: 'LOCATION_TYPE_VAN',
};
