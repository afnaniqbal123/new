/**
 * API routes reachable by every signed-in role.
 *
 * One enum per portal/concern, never one per feature (AGENTS.md § Constant
 * Registries). Every path is absolute and host-free — the host comes from
 * `VITE_API_BASE_URL` — and matches the backend controller's route exactly.
 *
 * Routes that take an id are functions rather than template strings assembled
 * at the call site: an id interpolated by hand is an id someone eventually
 * forgets to encode.
 */
export enum CommonRoutes {
  // --- Organization -----------------------------------------------------
  ORGANIZATIONS = '/organizations',
  ORGANIZATION_CURRENT = '/organizations/current',
  ORGANIZATION_LOCATIONS = '/organizations/locations',
  ORGANIZATION_MEMBERS = '/organizations/members',

  // --- Catalog ----------------------------------------------------------
  PRODUCTS = '/catalog/products',
  PRODUCTS_LOW_STOCK = '/catalog/products/low-stock',
  CATEGORIES = '/catalog/categories',

  // --- Inventory --------------------------------------------------------
  STOCK_LEDGER = '/inventory/ledger',
  STOCK_BY_LOCATION = '/inventory/stock-by-location',
  STOCK_VALUATION = '/inventory/valuation',
  STOCK_EXPIRING = '/inventory/expiring',
  STOCK_ADJUSTMENTS = '/inventory/adjustments',
  STOCK_TRANSFERS = '/inventory/transfers',

  // --- Customers --------------------------------------------------------
  CUSTOMERS = '/customers',
  CUSTOMERS_AGING = '/customers/aging',
  CUSTOMERS_OVERDUE = '/customers/overdue',

  // --- Sales ------------------------------------------------------------
  SALES = '/sales',
  SALES_QUOTE = '/sales/quote',
  SALE_RETURNS = '/sales/returns',

  // --- Purchasing -------------------------------------------------------
  SUPPLIERS = '/purchasing/suppliers',
  PURCHASE_ORDERS = '/purchasing/orders',
  PURCHASE_SUGGESTIONS = '/purchasing/orders/suggestions',
  GOODS_RECEIPTS = '/purchasing/receipts',

  // --- Reports ----------------------------------------------------------
  DASHBOARD = '/reports/dashboard',
  REPORT_RUN = '/reports/run',
  REPORT_KINDS = '/reports/kinds',

  // --- WhatsApp ---------------------------------------------------------
  CONVERSATIONS = '/whatsapp/conversations',
  WHATSAPP_BADGES = '/whatsapp/badges',
  WHATSAPP_SIMULATE = '/whatsapp/simulate',
  DRAFT_ORDERS = '/whatsapp/drafts',

  // --- AI clerk ---------------------------------------------------------
  CLERK_ASK = '/clerk/ask',
  CLERK_STATUS = '/clerk/status',

  // The marketing-page assistant. Unauthenticated by design and answers only
  // from a fixed knowledge base about the product — see the backend's
  // `PublicAssistantController` for why that is what makes it safe to expose.
  ASSISTANT_ASK = '/assistant/ask',
  ASSISTANT_STATUS = '/assistant/status',
  CLERK_PARSE_ORDER = '/clerk/parse-order',

  // --- Automations ------------------------------------------------------
  AUTOMATIONS = '/automations',
  AUTOMATION_TRIGGER = '/automations/trigger',
  AUTOMATION_LATEST = '/automations/latest',

  // --- Billing ----------------------------------------------------------
  BILLING_PLANS = '/billing/plans',
  BILLING_SUBSCRIPTION = '/billing/subscription',
  BILLING_CHECKOUT = '/billing/checkout',
  BILLING_PORTAL = '/billing/portal',

  // --- Notifications ----------------------------------------------------
  NOTIFICATIONS = '/notifications',
}

/**
 * Routes that need an id.
 *
 * Functions rather than templates built at the call site: `encodeURIComponent`
 * applied in one place is `encodeURIComponent` that cannot be forgotten, and
 * a renamed path is a single edit.
 */
export const CommonRouteFor = {
  product: (id: string) => `${CommonRoutes.PRODUCTS}/${encodeURIComponent(id)}`,
  productByBarcode: (barcode: string) =>
    `${CommonRoutes.PRODUCTS}/barcode/${encodeURIComponent(barcode)}`,
  category: (id: string) => `${CommonRoutes.CATEGORIES}/${encodeURIComponent(id)}`,
  customer: (id: string) => `${CommonRoutes.CUSTOMERS}/${encodeURIComponent(id)}`,
  customerLedger: (id: string) => `${CommonRoutes.CUSTOMERS}/${encodeURIComponent(id)}/ledger`,
  sale: (id: string) => `${CommonRoutes.SALES}/${encodeURIComponent(id)}`,
  salePayments: (id: string) => `${CommonRoutes.SALES}/${encodeURIComponent(id)}/payments`,
  saleVoid: (id: string) => `${CommonRoutes.SALES}/${encodeURIComponent(id)}/void`,
  supplier: (id: string) => `${CommonRoutes.SUPPLIERS}/${encodeURIComponent(id)}`,
  supplierLedger: (id: string) => `${CommonRoutes.SUPPLIERS}/${encodeURIComponent(id)}/ledger`,
  supplierPayments: (id: string) => `${CommonRoutes.SUPPLIERS}/${encodeURIComponent(id)}/payments`,
  purchaseOrder: (id: string) => `${CommonRoutes.PURCHASE_ORDERS}/${encodeURIComponent(id)}`,
  purchaseOrderSend: (id: string) =>
    `${CommonRoutes.PURCHASE_ORDERS}/${encodeURIComponent(id)}/send`,
  location: (id: string) => `${CommonRoutes.ORGANIZATION_LOCATIONS}/${encodeURIComponent(id)}`,
  member: (id: string) => `${CommonRoutes.ORGANIZATION_MEMBERS}/${encodeURIComponent(id)}`,
  conversation: (id: string) => `${CommonRoutes.CONVERSATIONS}/${encodeURIComponent(id)}`,
  conversationMessages: (id: string) =>
    `${CommonRoutes.CONVERSATIONS}/${encodeURIComponent(id)}/messages`,
  conversationRead: (id: string) => `${CommonRoutes.CONVERSATIONS}/${encodeURIComponent(id)}/read`,
  conversationLinkCustomer: (id: string) =>
    `${CommonRoutes.CONVERSATIONS}/${encodeURIComponent(id)}/link-customer`,
  draftConfirm: (id: string) => `${CommonRoutes.DRAFT_ORDERS}/${encodeURIComponent(id)}/confirm`,
  draftReject: (id: string) => `${CommonRoutes.DRAFT_ORDERS}/${encodeURIComponent(id)}/reject`,
  transferDispatch: (id: string) =>
    `${CommonRoutes.STOCK_TRANSFERS}/${encodeURIComponent(id)}/dispatch`,
  transferReceive: (id: string) =>
    `${CommonRoutes.STOCK_TRANSFERS}/${encodeURIComponent(id)}/receive`,
} as const;
