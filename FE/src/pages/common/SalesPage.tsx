import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SALE_SOURCE_LABEL, SALE_STATUS_LABEL, SALE_STATUS_TONE } from 'src/constants/labels';
import { Link } from 'react-router-dom';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { Badge } from 'src/components/common/Badge';
import { Button } from 'src/components/common/Button';
import { SearchInput } from 'src/components/common/SearchInput';
import { Pagination } from 'src/components/common/Pagination';
import { Seo } from 'src/components/common/Seo';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useOrganization, useSales } from 'src/hooks/common/useBusinessData';
import type { Sale } from 'src/schemas/common/business.schema';

const PAGE_SIZE = 25;

/** Every invoice the business has issued. */
export function SalesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data: organization } = useOrganization();
  const { data, isPending } = useSales({
    search: search || undefined,
    unpaid: unpaidOnly || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const currency = organization?.currency ?? 'PKR';
  const rows = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const columns: DataTableColumn<Sale>[] = [
    {
      id: 'invoice',
      header: t('SALES_INVOICE'),
      cell: (sale) => (
        <Link
          to={`/sales/${sale._id}`}
          className="text-brand-600 font-mono text-sm hover:underline"
        >
          {sale.invoiceNumber ?? '—'}
        </Link>
      ),
    },
    {
      id: 'date',
      header: t('SALES_DATE'),
      cell: (sale) => (
        <span className="text-foreground-muted tabular text-sm">
          {sale.completedAt ? new Date(sale.completedAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      id: 'customer',
      header: t('SALES_CUSTOMER'),
      cell: (sale) => (
        <span className="text-foreground truncate">{sale.customerName ?? t('POS_WALK_IN')}</span>
      ),
    },
    {
      id: 'total',
      header: t('SALES_TOTAL'),
      cell: (sale) => <Money amount={sale.grandTotal} currency={currency} size="sm" />,
    },
    {
      id: 'due',
      header: t('SALES_DUE'),
      cell: (sale) =>
        sale.dueTotal > 0 ? (
          <Money amount={sale.dueTotal} currency={currency} size="sm" tone="debt" />
        ) : (
          <Badge tone="success">{t('SALES_PAID')}</Badge>
        ),
    },
    {
      id: 'source',
      header: t('SALES_SOURCE'),
      cell: (sale) => (
        <Badge tone={sale.source === 'WHATSAPP' ? 'brand' : 'neutral'}>
          {t(SALE_SOURCE_LABEL[sale.source] ?? 'SOURCE_POS')}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: t('SALES_STATUS'),
      cell: (sale) => (
        <Badge tone={SALE_STATUS_TONE[sale.status] ?? 'neutral'}>
          {t(SALE_STATUS_LABEL[sale.status] ?? 'STATUS_COMPLETED')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('SALES_TITLE')} />
      <PageHeader title={t('SALES_TITLE')} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-60 flex-1">
          <SearchInput
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            delayMs={250}
            placeholder={t('SALES_INVOICE')}
            label={t('SEARCH')}
          />
        </div>
        <label className="text-foreground-muted flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unpaidOnly}
            onChange={(event) => {
              setUnpaidOnly(event.target.checked);
              setPage(1);
            }}
            className="accent-brand-600"
          />
          {t('SALES_UNPAID_ONLY')}
        </label>
      </div>

      <Panel flush>
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(sale) => sale._id}
          isLoading={isPending}
          emptyMessage={t('SALES_EMPTY')}
          emptyDescription={t('SALES_EMPTY_ACTION')}
          emptyAction={
            <Button type="button" size="sm" asChild>
              <Link to="/pos">{t('POS_TITLE')}</Link>
            </Button>
          }
          caption={t('SALES_TITLE')}
        />
      </Panel>

      {pageCount > 1 ? (
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
