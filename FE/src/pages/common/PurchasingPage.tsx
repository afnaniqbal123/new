import { useTranslation } from 'react-i18next';
import { PURCHASE_ORDER_TONE } from 'src/constants/labels';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { Badge } from 'src/components/common/Badge';
import { EmptyState } from 'src/components/common/EmptyState';
import { LoadingState } from 'src/components/common/LoadingState';
import { Seo } from 'src/components/common/Seo';
import {
  useOrganization,
  usePurchaseOrders,
  useReorderSuggestions,
} from 'src/hooks/common/useBusinessData';
import { formatQuantity } from 'src/utils/money';
import { refName } from 'src/schemas/common/business.schema';

/**
 * What to buy, and what is already on its way.
 *
 * The reorder suggestions sit above the orders because that is the order the
 * work actually happens in: a buyer opens this screen to decide what to order,
 * not to admire what they ordered last week. Each suggestion carries the last
 * price actually paid, so the decision needs no second lookup.
 */
export function PurchasingPage() {
  const { t } = useTranslation();
  const { data: organization } = useOrganization();
  const { data: suggestions, isPending: loadingSuggestions } = useReorderSuggestions();
  const { data: orders, isPending: loadingOrders } = usePurchaseOrders();

  const currency = organization?.currency ?? 'PKR';

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('PURCHASING_TITLE')} />
      <PageHeader title={t('PURCHASING_TITLE')} />

      <Panel title={t('PURCHASING_SUGGESTIONS')} flush>
        {loadingSuggestions ? (
          <LoadingState />
        ) : !suggestions || suggestions.length === 0 ? (
          <div className="p-4">
            <EmptyState title={t('PURCHASING_SUGGESTIONS_EMPTY')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('PURCHASING_SUGGESTIONS')}</caption>
              <thead className="border-border border-b">
                <tr className="text-foreground-muted text-left">
                  <th scope="col" className="px-4 py-2 font-medium">
                    {t('PRODUCTS_NAME')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {t('PRODUCTS_STOCK')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {t('PRODUCTS_REORDER_LEVEL')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {t('PURCHASING_SUGGESTED_QTY')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {t('PRODUCTS_COST')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {suggestions.map((item) => (
                  <tr key={item.product}>
                    <td className="px-4 py-2">
                      <span className="text-foreground block">{item.name}</span>
                      <span className="text-foreground-subtle font-mono text-xs">{item.sku}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {/*
                        Colour never carries this alone — the Badge's own text
                        ("Out of stock"/"Running low") is what a colour-blind
                        reader actually reads, same convention as ProductsPage.
                      */}
                      <span className="flex items-center justify-end gap-2">
                        <span
                          className={`tabular ${item.stockOnHand <= 0 ? 'text-danger' : 'text-warning'}`}
                        >
                          {formatQuantity(item.stockOnHand)}
                        </span>
                        <Badge tone={item.stockOnHand <= 0 ? 'danger' : 'warning'}>
                          {item.stockOnHand <= 0 ? t('POS_OUT_OF_STOCK') : t('DASHBOARD_LOW_STOCK')}
                        </Badge>
                      </span>
                    </td>
                    <td className="tabular text-foreground-muted px-4 py-2 text-right">
                      {formatQuantity(item.reorderLevel)}
                    </td>
                    <td className="tabular px-4 py-2 text-right font-medium">
                      {formatQuantity(item.suggestedQuantity)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Money
                        amount={item.lastPurchasePrice}
                        currency={currency}
                        size="sm"
                        hideCurrency
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={t('PURCHASING_ORDERS')} flush>
        {loadingOrders ? (
          <LoadingState />
        ) : !orders || orders.length === 0 ? (
          <div className="p-4">
            <EmptyState title={t('PURCHASING_EMPTY')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('PURCHASING_ORDERS')}</caption>
              <thead className="border-border border-b">
                <tr className="text-foreground-muted text-left">
                  <th scope="col" className="px-4 py-2 font-medium">
                    {t('PURCHASING_ORDER_NUMBER')}
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    {t('SUPPLIERS_TITLE')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {t('TOTAL')}
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    {t('SALES_STATUS')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td className="px-4 py-2 font-mono text-xs">{order.orderNumber}</td>
                    <td className="px-4 py-2">{order.supplierName ?? refName(order.supplier)}</td>
                    <td className="px-4 py-2 text-right">
                      <Money amount={order.grandTotal} currency={currency} size="sm" />
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={PURCHASE_ORDER_TONE[order.status] ?? 'neutral'}>
                        {order.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
