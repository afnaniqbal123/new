import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { SearchInput } from 'src/components/common/SearchInput';
import { Seo } from 'src/components/common/Seo';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useOrganization, useSuppliers } from 'src/hooks/common/useBusinessData';
import type { Supplier } from 'src/schemas/common/business.schema';

/** Who you buy from, and what you owe them. */
export function SuppliersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const { data: organization } = useOrganization();
  const { data, isPending } = useSuppliers({ search: search || undefined });

  const currency = organization?.currency ?? 'PKR';
  const rows = data?.items ?? [];

  const columns: DataTableColumn<Supplier>[] = [
    {
      id: 'name',
      header: t('CUSTOMERS_NAME'),
      cell: (supplier) => (
        <div className="min-w-0">
          <p className="text-foreground truncate font-medium">{supplier.name}</p>
          {supplier.contactPerson ? (
            <p className="text-foreground-subtle truncate text-xs">{supplier.contactPerson}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'phone',
      header: t('CUSTOMERS_PHONE'),
      cell: (supplier) => (
        <span className="text-foreground-muted tabular">{supplier.phone ?? '—'}</span>
      ),
    },
    {
      id: 'payable',
      header: t('SUPPLIERS_PAYABLE'),
      cell: (supplier) => (
        <Money
          amount={supplier.payable}
          currency={currency}
          size="sm"
          tone={supplier.payable > 0 ? 'debt' : 'muted'}
        />
      ),
    },
    {
      id: 'terms',
      header: t('CUSTOMERS_TERMS'),
      cell: (supplier) => (
        <span className="text-foreground-muted">
          {t('CUSTOMERS_TERMS_DAYS', { count: supplier.paymentTermDays })}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('SUPPLIERS_TITLE')} />
      <PageHeader title={t('SUPPLIERS_TITLE')} />

      <SearchInput onChange={setSearch} delayMs={250} label={t('SEARCH')} />

      <Panel flush>
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(supplier) => supplier._id}
          isLoading={isPending}
          emptyMessage={t('SUPPLIERS_EMPTY')}
          caption={t('SUPPLIERS_TITLE')}
        />
      </Panel>
    </div>
  );
}
