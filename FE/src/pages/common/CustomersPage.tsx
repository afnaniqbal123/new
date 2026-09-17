import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AGING_BUCKET_LABEL } from 'src/constants/labels';
import { Link } from 'react-router-dom';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { Badge } from 'src/components/common/Badge';
import { SearchInput } from 'src/components/common/SearchInput';
import { Pagination } from 'src/components/common/Pagination';
import { Seo } from 'src/components/common/Seo';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useAging, useCustomers, useOrganization } from 'src/hooks/common/useBusinessData';
import type { Customer } from 'src/schemas/common/business.schema';

const PAGE_SIZE = 25;

/**
 * Who buys from you, and who owes you.
 *
 * The aging strip sits above the list deliberately: "who should I chase
 * today?" is the question this screen is usually opened to answer, and a
 * total at the top answers it before any scrolling.
 */
export function CustomersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [owingOnly, setOwingOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data: organization } = useOrganization();
  const { data: aging } = useAging();
  const { data, isPending } = useCustomers({
    search: search || undefined,
    withBalance: owingOnly || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const currency = organization?.currency ?? 'PKR';
  const rows = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const columns: DataTableColumn<Customer>[] = [
    {
      id: 'name',
      header: t('CUSTOMERS_NAME'),
      cell: (customer) => (
        <Link to={`/customers/${customer._id}`} className="block min-w-0">
          <span className="text-brand-600 block truncate font-medium hover:underline">
            {customer.businessName || customer.name}
          </span>
          {customer.businessName ? (
            <span className="text-foreground-subtle block truncate text-xs">{customer.name}</span>
          ) : null}
        </Link>
      ),
    },
    {
      id: 'phone',
      header: t('CUSTOMERS_PHONE'),
      cell: (customer) => (
        <span className="text-foreground-muted tabular">{customer.phone ?? '—'}</span>
      ),
    },
    {
      id: 'outstanding',
      header: t('CUSTOMERS_OUTSTANDING'),
      cell: (customer) => (
        <Money
          amount={customer.outstanding}
          currency={currency}
          size="sm"
          tone={customer.outstanding > 0 ? 'debt' : 'muted'}
        />
      ),
    },
    {
      id: 'limit',
      header: t('CUSTOMERS_CREDIT_LIMIT'),
      cell: (customer) =>
        customer.creditLimit === 0 ? (
          <Badge tone="neutral">{t('PAYMENT_CASH')}</Badge>
        ) : (
          <Money amount={customer.creditLimit} currency={currency} size="sm" tone="muted" />
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('CUSTOMERS_TITLE')} />
      <PageHeader title={t('CUSTOMERS_TITLE')} />

      {aging && aging.length > 0 ? (
        <Panel title={t('CUSTOMERS_AGING')}>
          <dl className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {aging.map((bucket) => (
              <div key={bucket.bucket} className="flex flex-col gap-1">
                <dt className="text-foreground-muted text-xs font-medium">
                  {t(AGING_BUCKET_LABEL[bucket.bucket] ?? 'AGING_CURRENT')}
                </dt>
                <dd>
                  <Money
                    amount={bucket.amount}
                    currency={currency}
                    tone={bucket.bucket !== 'CURRENT' && bucket.amount > 0 ? 'debt' : 'muted'}
                  />
                </dd>
                <dd className="text-foreground-subtle text-xs">
                  {t('SHOWING_COUNT', { count: bucket.customers, total: bucket.customers })}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-60 flex-1">
          <SearchInput
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            delayMs={250}
            placeholder={t('SEARCH')}
            label={t('SEARCH')}
          />
        </div>
        <label className="text-foreground-muted flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={owingOnly}
            onChange={(event) => {
              setOwingOnly(event.target.checked);
              setPage(1);
            }}
            className="accent-brand-600"
          />
          {t('CUSTOMERS_WITH_BALANCE')}
        </label>
      </div>

      <Panel flush>
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(customer) => customer._id}
          isLoading={isPending}
          emptyMessage={t('CUSTOMERS_EMPTY')}
          caption={t('CUSTOMERS_TITLE')}
        />
      </Panel>

      {pageCount > 1 ? (
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
