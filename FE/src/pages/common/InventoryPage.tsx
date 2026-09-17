import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { Badge } from 'src/components/common/Badge';
import { Pagination } from 'src/components/common/Pagination';
import { Seo } from 'src/components/common/Seo';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useOrganization, useStockLedger } from 'src/hooks/common/useBusinessData';
import { formatQuantity } from 'src/utils/money';
import { refName, type StockLedgerEntry } from 'src/schemas/common/business.schema';

const PAGE_SIZE = 50;

/** Inbound reasons read as gains, outbound as losses. */
const INBOUND = new Set(['PURCHASE', 'SALE_RETURN', 'TRANSFER_IN', 'OPENING']);

/**
 * The stock ledger — every movement, never edited.
 *
 * This screen is the product's answer to phantom inventory. A stock number on
 * its own invites "that can't be right"; the same number with the twelve
 * movements that produced it ends the conversation. Corrections appear here
 * as new rows, which is why nothing on this page is editable.
 */
export function InventoryPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const { data: organization } = useOrganization();
  const { data, isPending } = useStockLedger({ page, limit: PAGE_SIZE });

  const currency = organization?.currency ?? 'PKR';
  const rows = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const columns: DataTableColumn<StockLedgerEntry>[] = [
    {
      id: 'date',
      header: t('DATE'),
      cell: (entry) => (
        <span className="text-foreground-muted tabular text-sm">
          {new Date(entry.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'product',
      header: t('PRODUCTS_NAME'),
      cell: (entry) => (
        <span className="text-foreground truncate">{refName(entry.product) || '—'}</span>
      ),
    },
    {
      id: 'reason',
      header: t('INVENTORY_MOVEMENT_REASON'),
      cell: (entry) => (
        <Badge tone={INBOUND.has(entry.reason) ? 'success' : 'neutral'}>{entry.reason}</Badge>
      ),
    },
    {
      id: 'quantity',
      header: t('INVENTORY_QUANTITY'),
      cell: (entry) => (
        <span
          className={`tabular font-medium ${entry.quantity > 0 ? 'text-success' : 'text-danger'}`}
        >
          {entry.quantity > 0 ? '+' : ''}
          {formatQuantity(entry.quantity)}
        </span>
      ),
    },
    {
      id: 'balance',
      header: t('INVENTORY_BALANCE'),
      cell: (entry) => <span className="tabular">{formatQuantity(entry.balanceAfter)}</span>,
    },
    {
      id: 'cost',
      header: t('PRODUCTS_COST'),
      cell: (entry) => <Money amount={entry.unitCost} currency={currency} size="sm" tone="muted" />,
    },
    {
      id: 'reference',
      header: t('INVENTORY_REFERENCE'),
      cell: (entry) => (
        <span className="text-foreground-subtle font-mono text-xs">
          {entry.referenceNumber ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('INVENTORY_TITLE')} />
      <PageHeader title={t('INVENTORY_TITLE')} description={t('INVENTORY_ADJUST_HELP')} />

      <Panel title={t('INVENTORY_LEDGER')} flush>
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(entry) => entry._id}
          isLoading={isPending}
          emptyMessage={t('INVENTORY_EMPTY')}
          caption={t('INVENTORY_LEDGER')}
        />
      </Panel>

      {pageCount > 1 ? (
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
