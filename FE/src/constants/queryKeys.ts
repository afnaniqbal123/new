/**
 * Every TanStack Query key the app can produce, in one flat registry.
 *
 * Global rather than per-portal on purpose: it keeps every cache entry visible
 * in one place, so two features cannot silently collide on the same string.
 * A new query starts with a member here — never an inline literal, never a
 * per-feature key factory (AGENTS.md § Data & State).
 */
export enum QueryKey {
  // --- Organization -----------------------------------------------------
  ORGANIZATION = 'organization',
  LOCATIONS = 'locations',
  TEAM_MEMBERS = 'team-members',

  // --- Catalog ----------------------------------------------------------
  PRODUCTS = 'products',
  PRODUCT = 'product',
  PRODUCTS_LOW_STOCK = 'products-low-stock',
  CATEGORIES = 'categories',

  // --- Inventory --------------------------------------------------------
  STOCK_LEDGER = 'stock-ledger',
  STOCK_BY_LOCATION = 'stock-by-location',
  STOCK_VALUATION = 'stock-valuation',
  STOCK_EXPIRING = 'stock-expiring',
  STOCK_TRANSFERS = 'stock-transfers',

  // --- Customers --------------------------------------------------------
  CUSTOMERS = 'customers',
  CUSTOMER = 'customer',
  CUSTOMER_LEDGER = 'customer-ledger',
  CUSTOMERS_AGING = 'customers-aging',
  CUSTOMERS_OVERDUE = 'customers-overdue',

  // --- Sales ------------------------------------------------------------
  SALES = 'sales',
  SALE = 'sale',
  SALE_QUOTE = 'sale-quote',
  SALE_RETURNS = 'sale-returns',

  // --- Purchasing -------------------------------------------------------
  SUPPLIERS = 'suppliers',
  SUPPLIER = 'supplier',
  SUPPLIER_LEDGER = 'supplier-ledger',
  PURCHASE_ORDERS = 'purchase-orders',
  PURCHASE_ORDER = 'purchase-order',
  PURCHASE_SUGGESTIONS = 'purchase-suggestions',
  GOODS_RECEIPTS = 'goods-receipts',

  // --- Reports ----------------------------------------------------------
  DASHBOARD = 'dashboard',
  REPORT = 'report',
  REPORT_KINDS = 'report-kinds',

  // --- WhatsApp ---------------------------------------------------------
  CONVERSATIONS = 'conversations',
  CONVERSATION = 'conversation',
  CONVERSATION_MESSAGES = 'conversation-messages',
  WHATSAPP_BADGES = 'whatsapp-badges',
  DRAFT_ORDERS = 'draft-orders',
  DRAFT_ORDER = 'draft-order',

  // --- AI clerk ---------------------------------------------------------
  CLERK_STATUS = 'clerk-status',
  ASSISTANT_STATUS = 'assistant-status',

  // --- Automations ------------------------------------------------------
  AUTOMATIONS = 'automations',
  AUTOMATION_LATEST = 'automation-latest',

  // --- Billing ----------------------------------------------------------
  BILLING_PLANS = 'billing-plans',
  BILLING_SUBSCRIPTION = 'billing-subscription',
}
