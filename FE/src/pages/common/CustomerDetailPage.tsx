import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { StatTile } from 'src/components/common/StatTile';
import { Badge } from 'src/components/common/Badge';
import { LoadingState } from 'src/components/common/LoadingState';
import { ErrorState } from 'src/components/common/ErrorState';
import { EmptyState } from 'src/components/common/EmptyState';
import { Seo } from 'src/components/common/Seo';
import { useCustomer, useCustomerLedger, useOrganization } from 'src/hooks/common/useBusinessData';

/**
 * One customer: what they owe, and why.
 *
 * The ledger below the tiles is the point of the screen. A balance on its own
 * invites an argument; a balance with every invoice and payment that produced
 * it ends one — which is exactly what the append-only customer ledger exists
 * to make possible.
 */
export function CustomerDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: organization } = useOrganization();
  const { data: customer, isPending, isError, refetch } = useCustomer(id);
  const { data: ledger } = useCustomerLedger(id);

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const currency = organization?.currency ?? 'PKR';
  const available = customer.creditLimit - customer.outstanding;

  return (
    <div className="flex flex-col gap-4">
      <Seo title={customer.businessName || customer.name} />
      <PageHeader
        backTo="/customers"
        backLabel={t('BACK_TO_CUSTOMERS')}
        title={customer.businessName || customer.name}
        description={customer.phone}
        actions={
          customer.taxRegistrationNumber ? (
            <Badge tone="info">{customer.taxRegistrationNumber}</Badge>
          ) : (
            <Badge tone="warning">{t('CUSTOMERS_UNREGISTERED_HINT')}</Badge>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t('CUSTOMERS_OUTSTANDING')}
          value={
            <Money
              amount={customer.outstanding}
              currency={currency}
              size="xl"
              tone={customer.outstanding > 0 ? 'debt' : 'default'}
            />
          }
        />
        <StatTile
          label={t('CUSTOMERS_CREDIT_LIMIT')}
          value={<Money amount={customer.creditLimit} currency={currency} size="xl" />}
        />
        <StatTile
          label={t('POS_CREDIT_AVAILABLE')}
          value={
            <Money
              amount={available}
              currency={currency}
              size="xl"
              tone={available < 0 ? 'negative' : 'positive'}
            />
          }
          emphasis={available < 0 ? 'danger' : 'none'}
        />
        <StatTile
          label={t('CUSTOMERS_TERMS')}
          value={
            <span className="tabular text-foreground text-3xl font-semibold">
              {customer.paymentTermDays}
            </span>
          }
          hint={t('CUSTOMERS_TERMS_DAYS', { count: customer.paymentTermDays })}
        />
      </div>

      <Panel title={t('CUSTOMERS_LEDGER')} flush>
        {!ledger || ledger.items.length === 0 ? (
          <div className="p-4">
            <EmptyState title={t('EMPTY_RESULTS')} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">{t('CUSTOMERS_LEDGER')}</caption>
            <thead className="border-border border-b">
              <tr className="text-foreground-muted text-left">
                <th scope="col" className="px-4 py-2 font-medium">
                  {t('DATE')}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t('INVENTORY_REFERENCE')}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {t('AMOUNT')}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {t('BALANCE')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {ledger.items.map((entry) => (
                <tr key={entry._id}>
                  <td className="text-foreground-muted tabular px-4 py-2">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">{entry.referenceNumber ?? '—'}</span>
                    <span className="text-foreground-subtle ml-2 text-xs">{entry.type}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Money
                      amount={entry.amount}
                      currency={currency}
                      size="sm"
                      showSign
                      tone={entry.amount > 0 ? 'debt' : 'positive'}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Money amount={entry.balanceAfter} currency={currency} size="sm" hideCurrency />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
