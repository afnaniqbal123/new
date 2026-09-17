import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'src/stores/toastStore';
import i18n from 'src/i18n';
import { QueryKey } from 'src/constants/queryKeys';
import { businessService, type CreateSaleInput } from 'src/services/common/businessService';

/**
 * Every write the product performs.
 *
 * The rule each of these follows (AGENTS.md § Data & State): confirm with a
 * toast in `onSuccess`, then **return** the `invalidateQueries` promise from
 * that same callback, so the mutation stays pending until the refetch lands.
 * Without the return, a POS screen re-enables its Pay button while the totals
 * behind it are still the old ones.
 *
 * Which keys each one invalidates is deliberate rather than a blanket clear:
 * completing a sale changes stock, the customer's balance and the dashboard,
 * and saying so explicitly is what keeps those screens correct without
 * throwing away every cached page the user might navigate back to.
 */

/** The caches a completed sale invalidates. Listed once; used by three hooks. */
const SALE_EFFECTS = [
  QueryKey.SALES,
  QueryKey.DASHBOARD,
  QueryKey.PRODUCTS,
  QueryKey.PRODUCTS_LOW_STOCK,
  QueryKey.STOCK_LEDGER,
  QueryKey.CUSTOMERS,
  QueryKey.CUSTOMER,
  QueryKey.CUSTOMER_LEDGER,
  QueryKey.CUSTOMERS_AGING,
] as const;

function useInvalidator() {
  const queryClient = useQueryClient();

  return (keys: readonly QueryKey[]) =>
    Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

// --- Sales --------------------------------------------------------------

export function useCreateSale() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: CreateSaleInput) => businessService.createSale(input),
    onSuccess: (sale) => {
      toast.success(i18n.t('SALE_COMPLETED', { invoice: sale.invoiceNumber ?? '' }));

      return invalidate(SALE_EFFECTS);
    },
  });
}

export function useRecordSalePayment() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      method: string;
      amount: number;
      reference?: string;
    }) => businessService.recordSalePayment(id, input),
    onSuccess: () => {
      toast.success(i18n.t('PAYMENT_RECORDED'));

      return invalidate([...SALE_EFFECTS, QueryKey.SALE]);
    },
  });
}

export function useVoidSale() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      businessService.voidSale(id, reason),
    onSuccess: () => {
      toast.success(i18n.t('SALE_VOIDED'));

      return invalidate([...SALE_EFFECTS, QueryKey.SALE]);
    },
  });
}

export function useCreateSaleReturn() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: {
      sale: string;
      lines: { product: string; quantity: number }[];
      refundNow?: boolean;
      reason?: string;
    }) => businessService.createSaleReturn(input),
    onSuccess: () => {
      toast.success(i18n.t('RETURN_RECORDED'));

      return invalidate([...SALE_EFFECTS, QueryKey.SALE, QueryKey.SALE_RETURNS]);
    },
  });
}

// --- Catalog ------------------------------------------------------------

export function useCreateProduct() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) => businessService.createProduct(input),
    onSuccess: () => {
      toast.success(i18n.t('PRODUCT_CREATED'));

      return invalidate([QueryKey.PRODUCTS, QueryKey.PRODUCTS_LOW_STOCK]);
    },
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      businessService.updateProduct(id, input),
    onSuccess: () => {
      toast.success(i18n.t('PRODUCT_UPDATED'));

      return invalidate([QueryKey.PRODUCTS, QueryKey.PRODUCT, QueryKey.PRODUCTS_LOW_STOCK]);
    },
  });
}

export function useArchiveProduct() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (id: string) => businessService.archiveProduct(id),
    onSuccess: () => {
      toast.success(i18n.t('PRODUCT_ARCHIVED'));

      return invalidate([QueryKey.PRODUCTS, QueryKey.PRODUCTS_LOW_STOCK]);
    },
  });
}

export function useCreateCategory() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: { name: string; color?: string }) => businessService.createCategory(input),
    onSuccess: () => {
      toast.success(i18n.t('CATEGORY_CREATED'));

      return invalidate([QueryKey.CATEGORIES]);
    },
  });
}

// --- Inventory ----------------------------------------------------------

export function useAdjustStock() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: {
      location?: string;
      reason: string;
      lines: { product: string; quantity: number; unitCost?: number }[];
      note?: string;
    }) => businessService.adjustStock(input),
    onSuccess: () => {
      toast.success(i18n.t('STOCK_ADJUSTED'));

      return invalidate([
        QueryKey.STOCK_LEDGER,
        QueryKey.PRODUCTS,
        QueryKey.PRODUCT,
        QueryKey.PRODUCTS_LOW_STOCK,
        QueryKey.STOCK_VALUATION,
        QueryKey.DASHBOARD,
      ]);
    },
  });
}

// --- Customers ----------------------------------------------------------

export function useCreateCustomer() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) => businessService.createCustomer(input),
    onSuccess: () => {
      toast.success(i18n.t('CUSTOMER_CREATED'));

      return invalidate([QueryKey.CUSTOMERS]);
    },
  });
}

export function useUpdateCustomer() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      businessService.updateCustomer(id, input),
    onSuccess: () => {
      toast.success(i18n.t('CUSTOMER_UPDATED'));

      return invalidate([QueryKey.CUSTOMERS, QueryKey.CUSTOMER]);
    },
  });
}

// --- Purchasing ---------------------------------------------------------

export function useCreateSupplier() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) => businessService.createSupplier(input),
    onSuccess: () => {
      toast.success(i18n.t('SUPPLIER_CREATED'));

      return invalidate([QueryKey.SUPPLIERS]);
    },
  });
}

export function usePaySupplier() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; amount: number; reference?: string }) =>
      businessService.paySupplier(id, input),
    onSuccess: () => {
      toast.success(i18n.t('SUPPLIER_PAID'));

      return invalidate([
        QueryKey.SUPPLIERS,
        QueryKey.SUPPLIER,
        QueryKey.SUPPLIER_LEDGER,
        QueryKey.DASHBOARD,
      ]);
    },
  });
}

export function useCreatePurchaseOrder() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: {
      supplier: string;
      lines: { product: string; quantity: number; unitCost?: number }[];
      expectedAt?: string;
      note?: string;
    }) => businessService.createPurchaseOrder(input),
    onSuccess: (order) => {
      toast.success(i18n.t('ORDER_CREATED', { number: order.orderNumber }));

      return invalidate([QueryKey.PURCHASE_ORDERS]);
    },
  });
}

export function useReceiveGoods() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: {
      purchaseOrder?: string;
      supplier?: string;
      lines: {
        product: string;
        quantity: number;
        unitCost: number;
        batchNo?: string;
      }[];
      supplierInvoiceNumber?: string;
    }) => businessService.receiveGoods(input),
    onSuccess: () => {
      toast.success(i18n.t('GOODS_RECEIVED'));

      // Receiving goods moves stock *and* weighted-average cost *and* the
      // payable — the widest blast radius of any write in the product.
      return invalidate([
        QueryKey.PURCHASE_ORDERS,
        QueryKey.GOODS_RECEIPTS,
        QueryKey.PRODUCTS,
        QueryKey.PRODUCT,
        QueryKey.PRODUCTS_LOW_STOCK,
        QueryKey.STOCK_LEDGER,
        QueryKey.STOCK_VALUATION,
        QueryKey.SUPPLIERS,
        QueryKey.SUPPLIER_LEDGER,
        QueryKey.DASHBOARD,
      ]);
    },
  });
}

// --- WhatsApp -----------------------------------------------------------

export function useSendWhatsAppMessage() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      businessService.sendWhatsAppMessage(id, text),
    onSuccess: () => invalidate([QueryKey.CONVERSATION_MESSAGES, QueryKey.CONVERSATIONS]),
  });
}

export function useSimulateInbound() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: { phone: string; text: string; contactName?: string }) =>
      businessService.simulateInbound(input),
    onSuccess: () => {
      toast.success(i18n.t('MESSAGE_SIMULATED'));

      return invalidate([
        QueryKey.CONVERSATIONS,
        QueryKey.CONVERSATION_MESSAGES,
        QueryKey.DRAFT_ORDERS,
        QueryKey.WHATSAPP_BADGES,
      ]);
    },
  });
}

export function useLinkConversationCustomer() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: ({ id, customer }: { id: string; customer: string }) =>
      businessService.linkConversationCustomer(id, customer),
    onSuccess: () => {
      toast.success(i18n.t('CUSTOMER_LINKED'));

      return invalidate([QueryKey.CONVERSATIONS, QueryKey.CONVERSATION, QueryKey.DRAFT_ORDERS]);
    },
  });
}

export function useConfirmDraftOrder() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      lines?: { product: string; quantity: number; unitPrice?: number }[];
      customer?: string;
      payments?: { method: string; amount: number }[];
    }) => businessService.confirmDraftOrder(id, input),
    onSuccess: () => {
      toast.success(i18n.t('DRAFT_CONFIRMED'));

      // Confirming a draft *is* a sale, so it invalidates everything a sale
      // does, plus the WhatsApp surfaces it came from.
      return invalidate([
        ...SALE_EFFECTS,
        QueryKey.DRAFT_ORDERS,
        QueryKey.CONVERSATIONS,
        QueryKey.WHATSAPP_BADGES,
      ]);
    },
  });
}

export function useRejectDraftOrder() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      businessService.rejectDraftOrder(id, reason),
    onSuccess: () => {
      toast.success(i18n.t('DRAFT_REJECTED'));

      return invalidate([QueryKey.DRAFT_ORDERS, QueryKey.CONVERSATIONS, QueryKey.WHATSAPP_BADGES]);
    },
  });
}

// --- Organization -------------------------------------------------------

export function useUpdateOrganization() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) => businessService.updateOrganization(input),
    onSuccess: () => {
      toast.success(i18n.t('SETTINGS_SAVED'));

      // Tax and currency settings change how every future total is computed,
      // so the dashboard and any open quote must not keep the old basis.
      return invalidate([QueryKey.ORGANIZATION, QueryKey.DASHBOARD]);
    },
  });
}

export function useInviteMember() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: { name: string; email: string; phone: string; role: string }) =>
      businessService.inviteMember(input),
    onSuccess: () => {
      toast.success(i18n.t('MEMBER_INVITED'));

      return invalidate([QueryKey.TEAM_MEMBERS]);
    },
  });
}

export function useUpdateMember() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; role?: string; isActive?: boolean }) =>
      businessService.updateMember(id, input),
    onSuccess: () => {
      toast.success(i18n.t('MEMBER_UPDATED'));

      return invalidate([QueryKey.TEAM_MEMBERS]);
    },
  });
}

export function useCreateLocation() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) => businessService.createLocation(input),
    onSuccess: () => {
      toast.success(i18n.t('LOCATION_CREATED'));

      return invalidate([QueryKey.LOCATIONS]);
    },
  });
}

// --- Automations --------------------------------------------------------

export function useTriggerAutomation() {
  const invalidate = useInvalidator();

  return useMutation({
    mutationFn: (kind: string) => businessService.triggerAutomation(kind),
    onSuccess: () => {
      toast.success(i18n.t('AUTOMATION_TRIGGERED'));

      return invalidate([QueryKey.AUTOMATIONS]);
    },
  });
}

// --- AI clerk -----------------------------------------------------------

/**
 * Asking the clerk a question.
 *
 * A mutation rather than a query, deliberately: it is an action the user
 * takes, it should not be cached against a key, and it must not re-run on a
 * window focus. Nothing is invalidated — asking a question changes nothing.
 */
export function useAskClerk() {
  return useMutation({
    mutationFn: (question: string) => businessService.askClerk(question),
  });
}

// --- Billing ------------------------------------------------------------

export function useStartCheckout() {
  return useMutation({
    mutationFn: (plan: string) => businessService.startCheckout(plan),
    onSuccess: (session) => {
      // A full navigation, not a router push: Stripe Checkout is a different
      // origin and cannot be rendered inside the app.
      window.location.assign(session.url);
    },
  });
}

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: () => businessService.openBillingPortal(),
    onSuccess: (session) => {
      window.location.assign(session.url);
    },
  });
}
