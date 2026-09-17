import { useTranslation } from 'react-i18next';
import { SALE_SOURCE_LABEL, SALE_STATUS_LABEL } from 'src/constants/labels';
import { useParams } from 'react-router-dom';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { Badge } from 'src/components/common/Badge';
import { Button } from 'src/components/common/Button';
import { LoadingState } from 'src/components/common/LoadingState';
import { ErrorState } from 'src/components/common/ErrorState';
import { Seo } from 'src/components/common/Seo';
import { useOrganization, useSale } from 'src/hooks/common/useBusinessData';
import { formatQuantity } from 'src/utils/money';
import { refName } from 'src/schemas/common/business.schema';

/**
 * One invoice, in full.
 *
 * Doubles as the printable document: `window.print()` on the real DOM rather
 * than a generated PDF. A browser's own print pipeline handles paper size,
 * margins and the user's printer correctly, and a PDF library would add
 * hundreds of kilobytes to produce something worse.
 */
export function SaleDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: organization } = useOrganization();
  const { data: sale, isPending, isError, refetch } = useSale(id);

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const currency = organization?.currency ?? 'PKR';

  return (
    <div className="flex flex-col gap-4">
      <Seo title={sale.invoiceNumber ?? t('SALES_INVOICE')} />
      <PageHeader
        backTo="/sales"
        backLabel={t('BACK_TO_SALES')}
        title={sale.invoiceNumber ?? t('SALES_INVOICE')}
        description={sale.completedAt ? new Date(sale.completedAt).toLocaleString() : undefined}
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              window.print();
            }}
          >
            {t('SALES_PRINT')}
          </Button>
        }
      />

      <div className="lg:grid-cols-detail grid gap-4">
        <Panel title={t('SALES_LINE_ITEMS')} flush>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('SALES_INVOICE')}</caption>
              <thead className="border-border border-b">
                <tr className="text-foreground-muted text-left">
                  <th scope="col" className="px-4 py-2 font-medium">
                    {t('PRODUCTS_NAME')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {t('POS_QUANTITY')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {t('PRODUCTS_PRICE')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {t('TOTAL')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {sale.lines.map((line, index) => (
                  <tr key={`${line.name}-${String(index)}`}>
                    <td className="px-4 py-2">
                      <span className="text-foreground block">{line.name}</span>
                      {line.sku ? (
                        <span className="text-foreground-subtle font-mono text-xs">{line.sku}</span>
                      ) : null}
                    </td>
                    <td className="tabular px-4 py-2 text-right">
                      {formatQuantity(line.quantity)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Money amount={line.unitPrice} currency={currency} size="sm" hideCurrency />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Money amount={line.lineTotal} currency={currency} size="sm" hideCurrency />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title={t('SALES_CUSTOMER')}>
            <p className="text-foreground font-medium">
              {sale.customerName ?? (refName(sale.customer) || t('POS_WALK_IN'))}
            </p>
            <p className="text-foreground-muted mt-1 text-sm">
              {t('SALES_SOURCE')}: {t(SALE_SOURCE_LABEL[sale.source] ?? 'SOURCE_POS')}
            </p>
          </Panel>

          <Panel title={t('TOTAL')}>
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-muted">{t('POS_SUBTOTAL')}</dt>
                <dd>
                  <Money amount={sale.subtotal} currency={currency} size="sm" />
                </dd>
              </div>
              {sale.discountTotal > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">{t('POS_DISCOUNT')}</dt>
                  <dd>
                    <Money
                      amount={-sale.discountTotal}
                      currency={currency}
                      size="sm"
                      tone="positive"
                    />
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-foreground-muted">{t('POS_TAX')}</dt>
                <dd>
                  <Money
                    amount={sale.taxTotal + sale.additionalTaxTotal}
                    currency={currency}
                    size="sm"
                  />
                </dd>
              </div>
              <div className="border-border mt-1 flex items-baseline justify-between border-t pt-2">
                <dt className="text-foreground font-semibold">{t('POS_TOTAL')}</dt>
                <dd>
                  <Money amount={sale.grandTotal} currency={currency} size="lg" />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-muted">{t('SALES_PAID')}</dt>
                <dd>
                  <Money amount={sale.paidTotal} currency={currency} size="sm" />
                </dd>
              </div>
              {sale.dueTotal > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">{t('SALES_DUE')}</dt>
                  <dd>
                    <Money amount={sale.dueTotal} currency={currency} size="sm" tone="debt" />
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-3">
              <Badge tone={sale.status === 'VOID' ? 'danger' : 'success'}>
                {t(SALE_STATUS_LABEL[sale.status] ?? 'STATUS_COMPLETED')}
              </Badge>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
