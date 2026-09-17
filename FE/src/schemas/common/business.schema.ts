import { z } from 'zod';

/**
 * The API's business-domain contracts, validated at the boundary.
 *
 * Two conventions run through all of it:
 *
 * 1. **Money is an integer.** Every amount here is minor units, exactly as the
 *    API sends it. There is no `z.number()` holding rupees anywhere, and
 *    adding one would reintroduce the float problem the backend removed.
 * 2. **Unknown fields pass through.** These schemas validate what the app
 *    reads, not everything the API sends. A backend that adds a field must
 *    not break a deployed frontend, so nothing here is `.strict()`.
 *
 * Types are derived with `z.infer` and imported from this file — never
 * hand-duplicated into `src/types/` (AGENTS.md § Data & State).
 */

/** The standard response envelope every endpoint returns. */
export const envelopeSchema = <T extends z.ZodType>(data: T) =>
  z.object({
    data,
    status: z.number(),
    message: z.string(),
  });

/** A paginated list, as the list endpoints return it. */
export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number(),
    page: z.number().optional(),
    limit: z.number().optional(),
  });

const objectId = z.string();

/**
 * A reference that may arrive as a bare id or as a populated object.
 *
 * Mongoose populates some references and not others depending on the
 * endpoint, and a schema that insisted on one shape would reject half the
 * API. This accepts both and is narrowed by `refId`/`refName` below.
 */
const reference = z.union([objectId, z.object({ _id: objectId }).loose(), z.null()]);

export type Reference = z.infer<typeof reference>;

/** The id of a reference, whether it arrived populated or not. */
export function refId(value: Reference | undefined): string | null {
  if (!value) return null;

  return typeof value === 'string' ? value : value._id;
}

/** The display name of a populated reference, when there is one. */
export function refName(value: Reference | undefined): string {
  if (!value || typeof value === 'string') return '';

  const populated = value as { name?: unknown; businessName?: unknown };

  if (typeof populated.businessName === 'string' && populated.businessName) {
    return populated.businessName;
  }

  return typeof populated.name === 'string' ? populated.name : '';
}

// --- Organization -------------------------------------------------------

export const taxSettingsSchema = z.object({
  registrationNumber: z.string().optional(),
  nationalTaxNumber: z.string().optional(),
  defaultRatePercent: z.number(),
  pricesIncludeTax: z.boolean(),
  furtherTaxPercent: z.number(),
  withholdingPercent: z.number(),
});

export const invoiceSettingsSchema = z.object({
  prefix: z.string(),
  nextNumber: z.number(),
  padding: z.number(),
  footerNote: z.string().optional(),
});

export const operationalSettingsSchema = z.object({
  allowNegativeStock: z.boolean(),
  automationsEnabled: z.boolean(),
  morningDigestHour: z.number(),
  eveningDigestHour: z.number(),
});

export const organizationSchema = z.object({
  _id: objectId,
  name: z.string(),
  legalName: z.string().optional(),
  slug: z.string(),
  country: z.string(),
  currency: z.string(),
  timezone: z.string(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  logo: z.string().optional(),
  status: z.string(),
  plan: z.string(),
  planRenewsAt: z.string().nullish(),
  tax: taxSettingsSchema,
  invoice: invoiceSettingsSchema,
  settings: operationalSettingsSchema,
  whatsapp: z
    .object({
      connected: z.boolean(),
      phoneNumberId: z.string().optional(),
      displayPhoneNumber: z.string().optional(),
      autoDraftOrders: z.boolean(),
    })
    .partial()
    .loose(),
});

export type Organization = z.infer<typeof organizationSchema>;

export const locationSchema = z.object({
  _id: objectId,
  name: z.string(),
  code: z.string().optional(),
  type: z.string(),
  address: z.string().optional(),
  phone: z.string().optional(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export type Location = z.infer<typeof locationSchema>;

export const teamMemberSchema = z.object({
  _id: objectId,
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  role: z.string(),
  status: z.string(),
  avatar: z.string().optional(),
});

export type TeamMember = z.infer<typeof teamMemberSchema>;

// --- Catalog ------------------------------------------------------------

export const categorySchema = z.object({
  _id: objectId,
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  isActive: z.boolean(),
});

export type Category = z.infer<typeof categorySchema>;

/**
 * A product.
 *
 * `averageCost`, `lastPurchasePrice` and `minimumPrice` are **optional** —
 * deliberately. The API strips them for roles that may not see margin, so a
 * schema requiring them would make the product list fail to parse for a
 * cashier. Their absence is the permission working, not a malformed payload.
 */
export const productSchema = z.object({
  _id: objectId,
  name: z.string(),
  sku: z.string(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  category: reference.optional(),
  unit: z.string(),
  packSize: z.number(),
  sellingPrice: z.number(),
  minimumPrice: z.number().optional(),
  averageCost: z.number().optional(),
  lastPurchasePrice: z.number().optional(),
  taxTreatment: z.string(),
  taxRatePercent: z.number().nullable(),
  stockOnHand: z.number(),
  reorderLevel: z.number(),
  reorderQuantity: z.number(),
  trackStock: z.boolean(),
  trackBatches: z.boolean(),
  status: z.string(),
  image: z.string().optional(),
  preferredSupplier: reference.optional(),
});

export type Product = z.infer<typeof productSchema>;

// --- Customers ----------------------------------------------------------

export const customerSchema = z.object({
  _id: objectId,
  name: z.string(),
  businessName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  taxRegistrationNumber: z.string().optional(),
  creditLimit: z.number(),
  outstanding: z.number(),
  paymentTermDays: z.number(),
  discountPercent: z.number(),
  whatsappOptIn: z.boolean(),
  isActive: z.boolean(),
  note: z.string().optional(),
  lastPurchaseAt: z.string().nullish(),
});

export type Customer = z.infer<typeof customerSchema>;

export const customerLedgerEntrySchema = z.object({
  _id: objectId,
  type: z.string(),
  amount: z.number(),
  balanceAfter: z.number(),
  referenceNumber: z.string().optional(),
  dueDate: z.string().nullish(),
  note: z.string().optional(),
  createdAt: z.string(),
});

export type CustomerLedgerEntry = z.infer<typeof customerLedgerEntrySchema>;

export const agingBucketSchema = z.object({
  bucket: z.string(),
  amount: z.number(),
  customers: z.number(),
});

export type AgingBucket = z.infer<typeof agingBucketSchema>;

// --- Sales --------------------------------------------------------------

export const saleLineSchema = z.object({
  product: reference,
  name: z.string(),
  sku: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  discountAmount: z.number(),
  taxableAmount: z.number(),
  taxRatePercent: z.number(),
  taxAmount: z.number(),
  additionalTaxAmount: z.number(),
  lineTotal: z.number(),
  unitCost: z.number().optional(),
  batchNo: z.string().optional(),
});

export type SaleLine = z.infer<typeof saleLineSchema>;

export const salePaymentSchema = z.object({
  method: z.string(),
  amount: z.number(),
  reference: z.string().optional(),
  receivedAt: z.string().optional(),
});

export const saleSchema = z.object({
  _id: objectId,
  invoiceNumber: z.string().optional(),
  customer: reference.optional(),
  customerName: z.string().optional(),
  location: reference.optional(),
  lines: z.array(saleLineSchema),
  subtotal: z.number(),
  discountTotal: z.number(),
  taxTotal: z.number(),
  additionalTaxTotal: z.number(),
  grandTotal: z.number(),
  paidTotal: z.number(),
  dueTotal: z.number(),
  costTotal: z.number().optional(),
  payments: z.array(salePaymentSchema),
  saleType: z.string(),
  status: z.string(),
  source: z.string(),
  dueDate: z.string().nullish(),
  completedAt: z.string().nullish(),
  soldBy: reference.optional(),
  note: z.string().optional(),
  createdAt: z.string().optional(),
});

export type Sale = z.infer<typeof saleSchema>;

/** What `POST /sales/quote` returns — a priced basket, saved nowhere. */
export const saleQuoteSchema = z.object({
  lines: z.array(saleLineSchema),
  subtotal: z.number(),
  discountTotal: z.number(),
  taxTotal: z.number(),
  additionalTaxTotal: z.number(),
  grandTotal: z.number(),
  costTotal: z.number().optional(),
  taxLabel: z.string(),
  additionalTaxLabel: z.string().optional(),
});

export type SaleQuote = z.infer<typeof saleQuoteSchema>;

// --- Inventory ----------------------------------------------------------

export const stockLedgerEntrySchema = z.object({
  _id: objectId,
  product: reference,
  location: reference,
  quantity: z.number(),
  unitCost: z.number(),
  balanceAfter: z.number(),
  reason: z.string(),
  referenceNumber: z.string().optional(),
  batchNo: z.string().optional(),
  expiry: z.string().nullish(),
  note: z.string().optional(),
  performedBy: reference.optional(),
  createdAt: z.string(),
});

export type StockLedgerEntry = z.infer<typeof stockLedgerEntrySchema>;

// --- Purchasing ---------------------------------------------------------

export const supplierSchema = z.object({
  _id: objectId,
  name: z.string(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  taxRegistrationNumber: z.string().optional(),
  payable: z.number(),
  paymentTermDays: z.number(),
  isActive: z.boolean(),
  note: z.string().optional(),
});

export type Supplier = z.infer<typeof supplierSchema>;

export const purchaseOrderSchema = z.object({
  _id: objectId,
  orderNumber: z.string(),
  supplier: reference,
  supplierName: z.string().optional(),
  location: reference.optional(),
  lines: z.array(
    z.object({
      product: reference,
      name: z.string(),
      sku: z.string().optional(),
      quantity: z.number(),
      unitCost: z.number(),
      receivedQuantity: z.number(),
      lineTotal: z.number(),
    })
  ),
  subtotal: z.number(),
  taxTotal: z.number(),
  grandTotal: z.number(),
  status: z.string(),
  expectedAt: z.string().nullish(),
  createdAt: z.string().optional(),
});

export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;

export const reorderSuggestionSchema = z.object({
  product: objectId,
  name: z.string(),
  sku: z.string(),
  stockOnHand: z.number(),
  reorderLevel: z.number(),
  suggestedQuantity: z.number(),
  lastPurchasePrice: z.number(),
  preferredSupplier: z.string().nullable(),
});

export type ReorderSuggestion = z.infer<typeof reorderSuggestionSchema>;

// --- Reports ------------------------------------------------------------

export const dashboardSchema = z.object({
  today: z.object({
    revenue: z.number(),
    count: z.number(),
    // Absent for roles without margin access — the permission working.
    profit: z.number().optional(),
    collected: z.number().optional(),
  }),
  month: z.object({
    revenue: z.number(),
    count: z.number(),
    profit: z.number().optional(),
  }),
  receivables: z.number(),
  payables: z.number(),
  stockValue: z.number().optional(),
  lowStockCount: z.number(),
  currency: z.string(),
  lowStock: z.array(
    z.object({
      id: objectId,
      name: z.string(),
      sku: z.string(),
      stockOnHand: z.number(),
      reorderLevel: z.number(),
    })
  ),
  recentSales: z.array(saleSchema.partial().loose()),
  salesByDay: z.array(
    z.object({
      date: z.string(),
      revenue: z.number(),
      cost: z.number().optional(),
      count: z.number(),
    })
  ),
});

export type Dashboard = z.infer<typeof dashboardSchema>;

export const reportResultSchema = z.object({
  kind: z.string(),
  period: z.object({ from: z.string(), to: z.string(), label: z.string() }),
  currency: z.string(),
  summary: z.record(z.string(), z.number()),
  rows: z.array(z.record(z.string(), z.unknown())),
});

export type ReportResult = z.infer<typeof reportResultSchema>;

// --- WhatsApp -----------------------------------------------------------

export const conversationSchema = z.object({
  _id: objectId,
  phone: z.string(),
  contactName: z.string().optional(),
  customer: reference.optional(),
  status: z.string(),
  lastMessagePreview: z.string().optional(),
  lastMessageAt: z.string().nullish(),
  lastInboundAt: z.string().nullish(),
  unreadCount: z.number(),
  pendingDraft: reference.optional(),
});

export type Conversation = z.infer<typeof conversationSchema>;

export const whatsappMessageSchema = z.object({
  _id: objectId,
  direction: z.string(),
  type: z.string(),
  text: z.string().optional(),
  status: z.string(),
  simulated: z.boolean().optional(),
  failureReason: z.string().optional(),
  createdAt: z.string(),
});

export type WhatsAppMessage = z.infer<typeof whatsappMessageSchema>;

export const draftOrderSchema = z.object({
  _id: objectId,
  conversation: reference,
  customer: reference.optional(),
  lines: z.array(
    z.object({
      requestedText: z.string(),
      product: reference.optional(),
      productName: z.string().optional(),
      sku: z.string().optional(),
      quantity: z.number(),
      requestedUnit: z.string().optional(),
      confidence: z.string(),
      alternatives: z.array(reference).optional(),
    })
  ),
  unmatched: z.array(z.string()),
  summary: z.string().optional(),
  status: z.string(),
  aiModel: z.string().optional(),
  createdAt: z.string().optional(),
});

export type DraftOrder = z.infer<typeof draftOrderSchema>;

// --- AI clerk -----------------------------------------------------------

export const clerkAnswerSchema = z.object({
  answerable: z.boolean(),
  question: z.string(),
  reportKind: z.string().nullable(),
  period: z.string().nullable(),
  reasoning: z.string(),
  report: reportResultSchema.nullable(),
  narrative: z.string(),
});

export type ClerkAnswer = z.infer<typeof clerkAnswerSchema>;

// --- Billing ------------------------------------------------------------

export const planOptionSchema = z.object({
  plan: z.string(),
  name: z.string(),
  monthlyPrice: z.number(),
  currency: z.string(),
  highlights: z.array(z.string()),
  current: z.boolean(),
  purchasable: z.boolean(),
  limits: z.object({
    users: z.number().nullable(),
    products: z.number().nullable(),
    locations: z.number().nullable(),
    salesPerMonth: z.number().nullable(),
    whatsapp: z.boolean(),
    aiClerk: z.boolean(),
    automations: z.boolean(),
  }),
});

export type PlanOption = z.infer<typeof planOptionSchema>;

export const subscriptionSchema = z.object({
  plan: z.string(),
  renewsAt: z.string().nullable(),
  hasStripeSubscription: z.boolean(),
  billingConfigured: z.boolean(),
  limits: planOptionSchema.shape.limits,
});

export type Subscription = z.infer<typeof subscriptionSchema>;

// --- Automations --------------------------------------------------------

export const automationRunSchema = z.object({
  _id: objectId,
  kind: z.string(),
  status: z.string(),
  localDate: z.string(),
  summary: z.string().optional(),
  itemsAffected: z.number(),
  error: z.string().optional(),
  completedAt: z.string().nullish(),
  createdAt: z.string().optional(),
});

export type AutomationRun = z.infer<typeof automationRunSchema>;
