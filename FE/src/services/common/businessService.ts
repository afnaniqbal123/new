import { apiClient } from 'src/services/api-client';
import { CommonRouteFor, CommonRoutes } from 'src/constants/common';
import {
  agingBucketSchema,
  automationRunSchema,
  categorySchema,
  clerkAnswerSchema,
  conversationSchema,
  customerLedgerEntrySchema,
  customerSchema,
  dashboardSchema,
  draftOrderSchema,
  locationSchema,
  organizationSchema,
  paginatedSchema,
  planOptionSchema,
  productSchema,
  purchaseOrderSchema,
  reorderSuggestionSchema,
  reportResultSchema,
  saleQuoteSchema,
  saleSchema,
  stockLedgerEntrySchema,
  subscriptionSchema,
  supplierSchema,
  teamMemberSchema,
  whatsappMessageSchema,
  type AgingBucket,
  type AutomationRun,
  type Category,
  type ClerkAnswer,
  type Conversation,
  type Customer,
  type CustomerLedgerEntry,
  type Dashboard,
  type DraftOrder,
  type Location,
  type Organization,
  type PlanOption,
  type Product,
  type PurchaseOrder,
  type ReorderSuggestion,
  type ReportResult,
  type Sale,
  type SaleQuote,
  type StockLedgerEntry,
  type Subscription,
  type Supplier,
  type TeamMember,
  type WhatsAppMessage,
} from 'src/schemas/common/business.schema';
import { z } from 'zod';

/**
 * Every HTTP call the product makes, in one place.
 *
 * Two rules this file exists to enforce (AGENTS.md § Data & State):
 *
 * - **A hook never calls `apiClient`.** Its `queryFn`/`mutationFn` calls a
 *   method here, which owns the request *and* the Zod validation.
 * - **Every response is parsed at the boundary.** A backend that changes
 *   shape fails here, with a message naming the field — rather than three
 *   components deep as `undefined is not an object`.
 *
 * Each method unwraps the `{ data, status, message }` envelope and returns
 * only `data`, so no call site deals with the envelope.
 */

/**
 * The envelope's own shape, with its payload left unvalidated.
 *
 * Validated in two steps rather than one composed schema: composing
 * `envelopeSchema(payload)` produces a generic whose inferred type TypeScript
 * cannot narrow back to the payload's, so every call site would need a cast.
 * Checking the wrapper, then the payload, gives the same guarantee with a type
 * that actually flows.
 */
const envelopeShape = z.object({
  data: z.unknown(),
  status: z.number(),
  message: z.string(),
});

/** Unwraps the response envelope and validates its payload. */
async function unwrap<T extends z.ZodType>(
  promise: Promise<{ data: unknown }>,
  schema: T
): Promise<z.infer<T>> {
  const response = await promise;
  const envelope = envelopeShape.parse(response.data);

  return schema.parse(envelope.data);
}

/** Query params, with undefined entries dropped so they never reach the URL. */
function params(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== '')
  );
}

/**
 * Every optional field is `| undefined` explicitly.
 *
 * `exactOptionalPropertyTypes` is on in this repo, which distinguishes "the
 * key is absent" from "the key is present and undefined". Callers build these
 * objects with `value || undefined`, so the second case is the common one and
 * the type has to admit it.
 */
export interface ProductQuery {
  search?: string | undefined;
  category?: string | undefined;
  status?: string | undefined;
  lowStock?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface CustomerQuery {
  search?: string | undefined;
  withBalance?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface SupplierQuery {
  search?: string | undefined;
  withBalance?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface StockLedgerQuery {
  product?: string | undefined;
  location?: string | undefined;
  reason?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface SaleQuery {
  status?: string | undefined;
  source?: string | undefined;
  customer?: string | undefined;
  unpaid?: boolean | undefined;
  search?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface SaleLineInput {
  product: string;
  quantity: number;
  unitPrice?: number | undefined;
  discount?: number | undefined;
  discountType?: 'AMOUNT' | 'PERCENT' | undefined;
}

export interface CreateSaleInput {
  customer?: string | undefined;
  location?: string | undefined;
  lines: SaleLineInput[];
  payments?: { method: string; amount: number; reference?: string | undefined }[] | undefined;
  discount?: number | undefined;
  discountType?: 'AMOUNT' | 'PERCENT' | undefined;
  note?: string | undefined;
}

export const businessService = {
  // --- Organization -----------------------------------------------------

  async getOrganization(): Promise<Organization> {
    return unwrap(apiClient.get(CommonRoutes.ORGANIZATION_CURRENT), organizationSchema);
  },

  async createOrganization(input: {
    name: string;
    country?: string;
    currency?: string;
    timezone?: string;
    phone?: string;
    address?: string;
  }): Promise<Organization> {
    return unwrap(apiClient.post(CommonRoutes.ORGANIZATIONS, input), organizationSchema);
  },

  async updateOrganization(input: Record<string, unknown>): Promise<Organization> {
    return unwrap(apiClient.patch(CommonRoutes.ORGANIZATION_CURRENT, input), organizationSchema);
  },

  async getLocations(): Promise<Location[]> {
    return unwrap(apiClient.get(CommonRoutes.ORGANIZATION_LOCATIONS), z.array(locationSchema));
  },

  async createLocation(input: Record<string, unknown>): Promise<Location> {
    return unwrap(apiClient.post(CommonRoutes.ORGANIZATION_LOCATIONS, input), locationSchema);
  },

  async getTeam(): Promise<TeamMember[]> {
    return unwrap(apiClient.get(CommonRoutes.ORGANIZATION_MEMBERS), z.array(teamMemberSchema));
  },

  async inviteMember(input: {
    name: string;
    email: string;
    phone: string;
    role: string;
  }): Promise<TeamMember> {
    return unwrap(apiClient.post(CommonRoutes.ORGANIZATION_MEMBERS, input), teamMemberSchema);
  },

  async updateMember(
    id: string,
    input: { role?: string; isActive?: boolean }
  ): Promise<TeamMember> {
    return unwrap(apiClient.patch(CommonRouteFor.member(id), input), teamMemberSchema);
  },

  async removeMember(id: string): Promise<TeamMember> {
    return unwrap(apiClient.delete(CommonRouteFor.member(id)), teamMemberSchema);
  },

  // --- Catalog ----------------------------------------------------------

  async getProducts(query: ProductQuery = {}): Promise<{ items: Product[]; total: number }> {
    return unwrap(
      apiClient.get(CommonRoutes.PRODUCTS, { params: params({ ...query }) }),
      paginatedSchema(productSchema)
    );
  },

  async getProduct(id: string): Promise<Product> {
    return unwrap(apiClient.get(CommonRouteFor.product(id)), productSchema);
  },

  async getProductByBarcode(barcode: string): Promise<Product> {
    return unwrap(apiClient.get(CommonRouteFor.productByBarcode(barcode)), productSchema);
  },

  async createProduct(input: Record<string, unknown>): Promise<Product> {
    return unwrap(apiClient.post(CommonRoutes.PRODUCTS, input), productSchema);
  },

  async updateProduct(id: string, input: Record<string, unknown>): Promise<Product> {
    return unwrap(apiClient.patch(CommonRouteFor.product(id), input), productSchema);
  },

  async archiveProduct(id: string): Promise<Product> {
    return unwrap(apiClient.delete(CommonRouteFor.product(id)), productSchema);
  },

  async getLowStock(): Promise<Product[]> {
    return unwrap(apiClient.get(CommonRoutes.PRODUCTS_LOW_STOCK), z.array(productSchema));
  },

  async getCategories(): Promise<Category[]> {
    return unwrap(apiClient.get(CommonRoutes.CATEGORIES), z.array(categorySchema));
  },

  async createCategory(input: { name: string; color?: string }): Promise<Category> {
    return unwrap(apiClient.post(CommonRoutes.CATEGORIES, input), categorySchema);
  },

  async deleteCategory(id: string): Promise<Category> {
    return unwrap(apiClient.delete(CommonRouteFor.category(id)), categorySchema);
  },

  // --- Inventory --------------------------------------------------------

  async getStockLedger(
    query: StockLedgerQuery = {}
  ): Promise<{ items: StockLedgerEntry[]; total: number }> {
    return unwrap(
      apiClient.get(CommonRoutes.STOCK_LEDGER, { params: params({ ...query }) }),
      paginatedSchema(stockLedgerEntrySchema)
    );
  },

  async adjustStock(input: {
    location?: string;
    reason: string;
    lines: { product: string; quantity: number; unitCost?: number }[];
    note?: string;
  }): Promise<unknown> {
    return unwrap(apiClient.post(CommonRoutes.STOCK_ADJUSTMENTS, input), z.unknown());
  },

  async getStockValuation(): Promise<{ value: number }> {
    return unwrap(apiClient.get(CommonRoutes.STOCK_VALUATION), z.object({ value: z.number() }));
  },

  // --- Customers --------------------------------------------------------

  async getCustomers(query: CustomerQuery = {}): Promise<{ items: Customer[]; total: number }> {
    return unwrap(
      apiClient.get(CommonRoutes.CUSTOMERS, { params: params({ ...query }) }),
      paginatedSchema(customerSchema)
    );
  },

  async getCustomer(id: string): Promise<Customer> {
    return unwrap(apiClient.get(CommonRouteFor.customer(id)), customerSchema);
  },

  async createCustomer(input: Record<string, unknown>): Promise<Customer> {
    return unwrap(apiClient.post(CommonRoutes.CUSTOMERS, input), customerSchema);
  },

  async updateCustomer(id: string, input: Record<string, unknown>): Promise<Customer> {
    return unwrap(apiClient.patch(CommonRouteFor.customer(id), input), customerSchema);
  },

  async getCustomerLedger(
    id: string,
    page = 1
  ): Promise<{ items: CustomerLedgerEntry[]; total: number }> {
    return unwrap(
      apiClient.get(CommonRouteFor.customerLedger(id), { params: { page } }),
      paginatedSchema(customerLedgerEntrySchema)
    );
  },

  async getAging(): Promise<AgingBucket[]> {
    return unwrap(apiClient.get(CommonRoutes.CUSTOMERS_AGING), z.array(agingBucketSchema));
  },

  async getOverdueCustomers(): Promise<Customer[]> {
    return unwrap(apiClient.get(CommonRoutes.CUSTOMERS_OVERDUE), z.array(customerSchema));
  },

  // --- Sales ------------------------------------------------------------

  /**
   * Prices a basket without saving it.
   *
   * Called on every POS basket change, so the cashier sees the same total the
   * server will charge — computed by the server, never by the client.
   */
  async quoteSale(input: CreateSaleInput): Promise<SaleQuote> {
    return unwrap(apiClient.post(CommonRoutes.SALES_QUOTE, input), saleQuoteSchema);
  },

  async createSale(input: CreateSaleInput): Promise<Sale> {
    return unwrap(apiClient.post(CommonRoutes.SALES, input), saleSchema);
  },

  async getSales(query: SaleQuery = {}): Promise<{ items: Sale[]; total: number }> {
    return unwrap(
      apiClient.get(CommonRoutes.SALES, { params: params({ ...query }) }),
      paginatedSchema(saleSchema)
    );
  },

  async getSale(id: string): Promise<Sale> {
    return unwrap(apiClient.get(CommonRouteFor.sale(id)), saleSchema);
  },

  async recordSalePayment(
    id: string,
    input: { method: string; amount: number; reference?: string }
  ): Promise<Sale> {
    return unwrap(apiClient.post(CommonRouteFor.salePayments(id), input), saleSchema);
  },

  async voidSale(id: string, reason: string): Promise<Sale> {
    return unwrap(apiClient.post(CommonRouteFor.saleVoid(id), { reason }), saleSchema);
  },

  async createSaleReturn(input: {
    sale: string;
    lines: { product: string; quantity: number }[];
    refundNow?: boolean;
    reason?: string;
  }): Promise<unknown> {
    return unwrap(apiClient.post(CommonRoutes.SALE_RETURNS, input), z.unknown());
  },

  // --- Purchasing -------------------------------------------------------

  async getSuppliers(query: SupplierQuery = {}): Promise<{ items: Supplier[]; total: number }> {
    return unwrap(
      apiClient.get(CommonRoutes.SUPPLIERS, { params: params({ ...query }) }),
      paginatedSchema(supplierSchema)
    );
  },

  async getSupplier(id: string): Promise<Supplier> {
    return unwrap(apiClient.get(CommonRouteFor.supplier(id)), supplierSchema);
  },

  async createSupplier(input: Record<string, unknown>): Promise<Supplier> {
    return unwrap(apiClient.post(CommonRoutes.SUPPLIERS, input), supplierSchema);
  },

  async updateSupplier(id: string, input: Record<string, unknown>): Promise<Supplier> {
    return unwrap(apiClient.patch(CommonRouteFor.supplier(id), input), supplierSchema);
  },

  async paySupplier(
    id: string,
    input: { amount: number; reference?: string; note?: string }
  ): Promise<unknown> {
    return unwrap(apiClient.post(CommonRouteFor.supplierPayments(id), input), z.unknown());
  },

  async getPurchaseOrders(status?: string): Promise<PurchaseOrder[]> {
    return unwrap(
      apiClient.get(CommonRoutes.PURCHASE_ORDERS, {
        params: params({ status }),
      }),
      z.array(purchaseOrderSchema)
    );
  },

  async createPurchaseOrder(input: {
    supplier: string;
    lines: { product: string; quantity: number; unitCost?: number }[];
    expectedAt?: string;
    note?: string;
  }): Promise<PurchaseOrder> {
    return unwrap(apiClient.post(CommonRoutes.PURCHASE_ORDERS, input), purchaseOrderSchema);
  },

  async sendPurchaseOrder(id: string): Promise<PurchaseOrder> {
    return unwrap(apiClient.post(CommonRouteFor.purchaseOrderSend(id)), purchaseOrderSchema);
  },

  async getReorderSuggestions(): Promise<ReorderSuggestion[]> {
    return unwrap(
      apiClient.get(CommonRoutes.PURCHASE_SUGGESTIONS),
      z.array(reorderSuggestionSchema)
    );
  },

  async receiveGoods(input: {
    purchaseOrder?: string;
    supplier?: string;
    lines: {
      product: string;
      quantity: number;
      unitCost: number;
      batchNo?: string;
      expiry?: string;
    }[];
    supplierInvoiceNumber?: string;
  }): Promise<unknown> {
    return unwrap(apiClient.post(CommonRoutes.GOODS_RECEIPTS, input), z.unknown());
  },

  // --- Reports ----------------------------------------------------------

  async getDashboard(): Promise<Dashboard> {
    return unwrap(apiClient.get(CommonRoutes.DASHBOARD), dashboardSchema);
  },

  async runReport(
    kind: string,
    period?: string,
    range?: { from?: string; to?: string }
  ): Promise<ReportResult> {
    return unwrap(
      apiClient.get(CommonRoutes.REPORT_RUN, {
        params: params({ kind, period, ...range }),
      }),
      reportResultSchema
    );
  },

  async getReportKinds(): Promise<string[]> {
    return unwrap(apiClient.get(CommonRoutes.REPORT_KINDS), z.array(z.string()));
  },

  // --- WhatsApp ---------------------------------------------------------

  async getConversations(status?: string): Promise<Conversation[]> {
    return unwrap(
      apiClient.get(CommonRoutes.CONVERSATIONS, { params: params({ status }) }),
      z.array(conversationSchema)
    );
  },

  async getConversationMessages(id: string): Promise<WhatsAppMessage[]> {
    return unwrap(
      apiClient.get(CommonRouteFor.conversationMessages(id)),
      z.array(whatsappMessageSchema)
    );
  },

  async sendWhatsAppMessage(id: string, text: string): Promise<WhatsAppMessage> {
    return unwrap(
      apiClient.post(CommonRouteFor.conversationMessages(id), { text }),
      whatsappMessageSchema
    );
  },

  async markConversationRead(id: string): Promise<Conversation> {
    return unwrap(apiClient.post(CommonRouteFor.conversationRead(id)), conversationSchema);
  },

  async linkConversationCustomer(id: string, customer: string): Promise<Conversation> {
    return unwrap(
      apiClient.post(CommonRouteFor.conversationLinkCustomer(id), { customer }),
      conversationSchema
    );
  },

  /**
   * Injects an inbound message as though WhatsApp had delivered it.
   *
   * The demo and development path — no Meta credentials required. It runs the
   * real ingestion pipeline server-side, so what it proves is real.
   */
  async simulateInbound(input: {
    phone: string;
    text: string;
    contactName?: string;
  }): Promise<unknown> {
    return unwrap(apiClient.post(CommonRoutes.WHATSAPP_SIMULATE, input), z.unknown());
  },

  async getBadges(): Promise<{ unread: number; pendingDrafts: number }> {
    return unwrap(
      apiClient.get(CommonRoutes.WHATSAPP_BADGES),
      z.object({ unread: z.number(), pendingDrafts: z.number() })
    );
  },

  async getDraftOrders(status?: string): Promise<DraftOrder[]> {
    return unwrap(
      apiClient.get(CommonRoutes.DRAFT_ORDERS, { params: params({ status }) }),
      z.array(draftOrderSchema)
    );
  },

  async confirmDraftOrder(
    id: string,
    input: {
      lines?: { product: string; quantity: number; unitPrice?: number }[];
      customer?: string;
      payments?: { method: string; amount: number }[];
    }
  ): Promise<unknown> {
    return unwrap(apiClient.post(CommonRouteFor.draftConfirm(id), input), z.unknown());
  },

  async rejectDraftOrder(id: string, reason?: string): Promise<DraftOrder> {
    return unwrap(apiClient.post(CommonRouteFor.draftReject(id), { reason }), draftOrderSchema);
  },

  // --- AI clerk ---------------------------------------------------------

  async getClerkStatus(): Promise<{ configured: boolean }> {
    return unwrap(apiClient.get(CommonRoutes.CLERK_STATUS), z.object({ configured: z.boolean() }));
  },

  async askClerk(question: string): Promise<ClerkAnswer> {
    return unwrap(apiClient.post(CommonRoutes.CLERK_ASK, { question }), clerkAnswerSchema);
  },

  // --- Automations ------------------------------------------------------

  async getAutomationRuns(): Promise<AutomationRun[]> {
    return unwrap(apiClient.get(CommonRoutes.AUTOMATIONS), z.array(automationRunSchema));
  },

  async triggerAutomation(kind: string): Promise<unknown> {
    return unwrap(apiClient.post(CommonRoutes.AUTOMATION_TRIGGER, { kind }), z.unknown());
  },

  // --- Billing ----------------------------------------------------------

  async getPlans(): Promise<PlanOption[]> {
    return unwrap(apiClient.get(CommonRoutes.BILLING_PLANS), z.array(planOptionSchema));
  },

  async getSubscription(): Promise<Subscription> {
    return unwrap(apiClient.get(CommonRoutes.BILLING_SUBSCRIPTION), subscriptionSchema);
  },

  async startCheckout(plan: string): Promise<{ url: string }> {
    return unwrap(
      apiClient.post(CommonRoutes.BILLING_CHECKOUT, { plan }),
      z.object({ url: z.string() })
    );
  },

  async openBillingPortal(): Promise<{ url: string }> {
    return unwrap(apiClient.post(CommonRoutes.BILLING_PORTAL), z.object({ url: z.string() }));
  },
};
