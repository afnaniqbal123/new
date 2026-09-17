import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { QueryKey } from 'src/constants/queryKeys';
import {
  businessService,
  type CustomerQuery,
  type ProductQuery,
  type SaleQuery,
  type StockLedgerQuery,
  type SupplierQuery,
} from 'src/services/common/businessService';
import type {
  AgingBucket,
  AutomationRun,
  Category,
  Conversation,
  Customer,
  CustomerLedgerEntry,
  Dashboard,
  DraftOrder,
  Location,
  Organization,
  PlanOption,
  Product,
  PurchaseOrder,
  ReorderSuggestion,
  ReportResult,
  Sale,
  StockLedgerEntry,
  Subscription,
  Supplier,
  TeamMember,
  WhatsAppMessage,
} from 'src/schemas/common/business.schema';

/**
 * Every read hook in the product.
 *
 * Each one is a thin TanStack Query wrapper over a `businessService` method:
 * the service owns the request and its validation, the hook owns only the
 * cache key, placeholder behaviour and staleness (AGENTS.md § Data & State).
 *
 * `keepPreviousData` is applied to every paginated or filtered list. Without
 * it a table blanks to a spinner on each keystroke of a search box, which
 * reads as the app breaking rather than working.
 */

const keepPrevious = <T>(previous: T | undefined): T | undefined => previous;

// --- Organization -------------------------------------------------------

export function useOrganization(): UseQueryResult<Organization> {
  return useQuery({
    queryKey: [QueryKey.ORGANIZATION],
    queryFn: () => businessService.getOrganization(),
    // Tax rates and currency change about once a year; refetching them on
    // every window focus is pure noise.
    staleTime: 5 * 60 * 1000,
  });
}

export function useLocations(): UseQueryResult<Location[]> {
  return useQuery({
    queryKey: [QueryKey.LOCATIONS],
    queryFn: () => businessService.getLocations(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeam(): UseQueryResult<TeamMember[]> {
  return useQuery({
    queryKey: [QueryKey.TEAM_MEMBERS],
    queryFn: () => businessService.getTeam(),
  });
}

// --- Catalog ------------------------------------------------------------

export function useProducts(
  query: ProductQuery = {}
): UseQueryResult<{ items: Product[]; total: number }> {
  return useQuery({
    // Every variable read inside queryFn is in the key — treat it like a
    // dependency array, or a filter change silently serves stale rows.
    queryKey: [QueryKey.PRODUCTS, query],
    queryFn: () => businessService.getProducts(query),
    placeholderData: keepPrevious,
  });
}

export function useProduct(id: string | undefined): UseQueryResult<Product> {
  return useQuery({
    queryKey: [QueryKey.PRODUCT, id],
    queryFn: () => businessService.getProduct(id as string),
    enabled: Boolean(id),
  });
}

export function useLowStock(): UseQueryResult<Product[]> {
  return useQuery({
    queryKey: [QueryKey.PRODUCTS_LOW_STOCK],
    queryFn: () => businessService.getLowStock(),
  });
}

export function useCategories(): UseQueryResult<Category[]> {
  return useQuery({
    queryKey: [QueryKey.CATEGORIES],
    queryFn: () => businessService.getCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

// --- Inventory ----------------------------------------------------------

export function useStockLedger(
  query: StockLedgerQuery = {}
): UseQueryResult<{ items: StockLedgerEntry[]; total: number }> {
  return useQuery({
    queryKey: [QueryKey.STOCK_LEDGER, query],
    queryFn: () => businessService.getStockLedger(query),
    placeholderData: keepPrevious,
  });
}

// --- Customers ----------------------------------------------------------

export function useCustomers(
  query: CustomerQuery = {}
): UseQueryResult<{ items: Customer[]; total: number }> {
  return useQuery({
    queryKey: [QueryKey.CUSTOMERS, query],
    queryFn: () => businessService.getCustomers(query),
    placeholderData: keepPrevious,
  });
}

export function useCustomer(id: string | undefined): UseQueryResult<Customer> {
  return useQuery({
    queryKey: [QueryKey.CUSTOMER, id],
    queryFn: () => businessService.getCustomer(id as string),
    enabled: Boolean(id),
  });
}

export function useCustomerLedger(
  id: string | undefined,
  page = 1
): UseQueryResult<{ items: CustomerLedgerEntry[]; total: number }> {
  return useQuery({
    queryKey: [QueryKey.CUSTOMER_LEDGER, id, page],
    queryFn: () => businessService.getCustomerLedger(id as string, page),
    enabled: Boolean(id),
    placeholderData: keepPrevious,
  });
}

export function useAging(): UseQueryResult<AgingBucket[]> {
  return useQuery({
    queryKey: [QueryKey.CUSTOMERS_AGING],
    queryFn: () => businessService.getAging(),
  });
}

// --- Sales --------------------------------------------------------------

export function useSales(query: SaleQuery = {}): UseQueryResult<{ items: Sale[]; total: number }> {
  return useQuery({
    queryKey: [QueryKey.SALES, query],
    queryFn: () => businessService.getSales(query),
    placeholderData: keepPrevious,
  });
}

export function useSale(id: string | undefined): UseQueryResult<Sale> {
  return useQuery({
    queryKey: [QueryKey.SALE, id],
    queryFn: () => businessService.getSale(id as string),
    enabled: Boolean(id),
  });
}

// --- Purchasing ---------------------------------------------------------

export function useSuppliers(
  query: SupplierQuery = {}
): UseQueryResult<{ items: Supplier[]; total: number }> {
  return useQuery({
    queryKey: [QueryKey.SUPPLIERS, query],
    queryFn: () => businessService.getSuppliers(query),
    placeholderData: keepPrevious,
  });
}

export function useSupplier(id: string | undefined): UseQueryResult<Supplier> {
  return useQuery({
    queryKey: [QueryKey.SUPPLIER, id],
    queryFn: () => businessService.getSupplier(id as string),
    enabled: Boolean(id),
  });
}

export function usePurchaseOrders(status?: string): UseQueryResult<PurchaseOrder[]> {
  return useQuery({
    queryKey: [QueryKey.PURCHASE_ORDERS, status],
    queryFn: () => businessService.getPurchaseOrders(status),
  });
}

export function useReorderSuggestions(): UseQueryResult<ReorderSuggestion[]> {
  return useQuery({
    queryKey: [QueryKey.PURCHASE_SUGGESTIONS],
    queryFn: () => businessService.getReorderSuggestions(),
  });
}

// --- Reports ------------------------------------------------------------

export function useDashboard(): UseQueryResult<Dashboard> {
  return useQuery({
    queryKey: [QueryKey.DASHBOARD],
    queryFn: () => businessService.getDashboard(),
    // A shop's dashboard should feel live without hammering the API: a minute
    // is short enough that a sale made at the counter shows up while someone
    // is still looking at the screen.
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useReport(
  kind: string | undefined,
  period?: string,
  range?: { from?: string; to?: string }
): UseQueryResult<ReportResult> {
  return useQuery({
    queryKey: [QueryKey.REPORT, kind, period, range],
    queryFn: () => businessService.runReport(kind as string, period, range),
    enabled: Boolean(kind),
    placeholderData: keepPrevious,
  });
}

export function useReportKinds(): UseQueryResult<string[]> {
  return useQuery({
    queryKey: [QueryKey.REPORT_KINDS],
    queryFn: () => businessService.getReportKinds(),
    staleTime: 10 * 60 * 1000,
  });
}

// --- WhatsApp -----------------------------------------------------------

export function useConversations(status?: string): UseQueryResult<Conversation[]> {
  return useQuery({
    queryKey: [QueryKey.CONVERSATIONS, status],
    queryFn: () => businessService.getConversations(status),
    // An inbox that only updates on reload is not an inbox.
    refetchInterval: 20 * 1000,
  });
}

export function useConversationMessages(id: string | undefined): UseQueryResult<WhatsAppMessage[]> {
  return useQuery({
    queryKey: [QueryKey.CONVERSATION_MESSAGES, id],
    queryFn: () => businessService.getConversationMessages(id as string),
    enabled: Boolean(id),
    refetchInterval: 15 * 1000,
  });
}

export function useWhatsAppBadges(): UseQueryResult<{
  unread: number;
  pendingDrafts: number;
}> {
  return useQuery({
    queryKey: [QueryKey.WHATSAPP_BADGES],
    queryFn: () => businessService.getBadges(),
    refetchInterval: 30 * 1000,
  });
}

export function useDraftOrders(status?: string): UseQueryResult<DraftOrder[]> {
  return useQuery({
    queryKey: [QueryKey.DRAFT_ORDERS, status],
    queryFn: () => businessService.getDraftOrders(status),
    refetchInterval: 30 * 1000,
  });
}

// --- AI clerk -----------------------------------------------------------

export function useClerkStatus(): UseQueryResult<{ configured: boolean }> {
  return useQuery({
    queryKey: [QueryKey.CLERK_STATUS],
    queryFn: () => businessService.getClerkStatus(),
    staleTime: 10 * 60 * 1000,
  });
}

// --- Automations --------------------------------------------------------

export function useAutomationRuns(): UseQueryResult<AutomationRun[]> {
  return useQuery({
    queryKey: [QueryKey.AUTOMATIONS],
    queryFn: () => businessService.getAutomationRuns(),
  });
}

// --- Billing ------------------------------------------------------------

export function usePlans(): UseQueryResult<PlanOption[]> {
  return useQuery({
    queryKey: [QueryKey.BILLING_PLANS],
    queryFn: () => businessService.getPlans(),
  });
}

export function useSubscription(): UseQueryResult<Subscription> {
  return useQuery({
    queryKey: [QueryKey.BILLING_SUBSCRIPTION],
    queryFn: () => businessService.getSubscription(),
  });
}
