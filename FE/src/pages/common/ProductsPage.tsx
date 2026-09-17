import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { Badge } from 'src/components/common/Badge';
import { Button } from 'src/components/common/Button';
import { SearchInput } from 'src/components/common/SearchInput';
import { Pagination } from 'src/components/common/Pagination';
import { Seo } from 'src/components/common/Seo';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useOrganization, useProducts } from 'src/hooks/common/useBusinessData';
import { formatQuantity } from 'src/utils/money';
import type { Product } from 'src/schemas/common/business.schema';
import { AddProductModal } from 'src/components/catalog/AddProductModal';

const PAGE_SIZE = 25;

/**
 * The catalogue.
 *
 * Cost and margin columns render only when the API actually returned those
 * fields — it strips them for roles without margin access, so their absence
 * is the permission working rather than missing data. The table adapts its
 * columns instead of showing a blank column, which would read as a bug.
 */
export function ProductsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  const { data: organization } = useOrganization();
  const { data, isPending } = useProducts({
    search: search || undefined,
    lowStock: lowStockOnly || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const currency = organization?.currency ?? 'PKR';
  const rows = data?.items ?? [];
  // Cost is stripped per-role by the API, so one row is enough to know
  // whether this user may see it.
  const showsCost = rows.some((product) => product.averageCost !== undefined);

  const columns: DataTableColumn<Product>[] = [
    {
      id: 'name',
      header: t('PRODUCTS_NAME'),
      cell: (product) => (
        <div className="min-w-0">
          <p className="text-foreground truncate font-medium">{product.name}</p>
          <p className="text-foreground-subtle font-mono text-xs">{product.sku}</p>
        </div>
      ),
    },
    {
      id: 'price',
      header: t('PRODUCTS_PRICE'),
      cell: (product) => <Money amount={product.sellingPrice} currency={currency} size="sm" />,
    },
    ...(showsCost
      ? [
          {
            id: 'cost',
            header: t('PRODUCTS_COST'),
            cell: (product: Product) =>
              product.averageCost === undefined ? (
                '—'
              ) : (
                <Money amount={product.averageCost} currency={currency} size="sm" tone="muted" />
              ),
          },
        ]
      : []),
    {
      id: 'stock',
      header: t('PRODUCTS_STOCK'),
      cell: (product) => {
        if (!product.trackStock) return <Badge tone="neutral">—</Badge>;

        const low = product.stockOnHand <= product.reorderLevel;

        return (
          <span className="flex items-center gap-2">
            <span className="tabular">{formatQuantity(product.stockOnHand)}</span>
            {low ? (
              <Badge tone={product.stockOnHand <= 0 ? 'danger' : 'warning'}>
                {product.stockOnHand <= 0 ? t('POS_OUT_OF_STOCK') : t('DASHBOARD_LOW_STOCK')}
              </Badge>
            ) : null}
          </span>
        );
      },
    },
    {
      id: 'unit',
      header: t('PRODUCTS_UNIT'),
      cell: (product) => <span className="text-foreground-muted">{product.unit}</span>,
    },
  ];

  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('PRODUCTS_TITLE')} />
      <PageHeader
        title={t('PRODUCTS_TITLE')}
        actions={
          <Button
            type="button"
            onClick={() => {
              setIsAdding(true);
            }}
          >
            {t('PRODUCTS_ADD')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-60 flex-1">
          <SearchInput
            onChange={(value) => {
              setSearch(value);
              // A filter change must reset paging, or a search with three
              // results renders blank because the user was on page 4.
              setPage(1);
            }}
            delayMs={250}
            placeholder={t('POS_SEARCH_PLACEHOLDER')}
            label={t('SEARCH')}
          />
        </div>
        <label className="text-foreground-muted flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => {
              setLowStockOnly(event.target.checked);
              setPage(1);
            }}
            className="accent-brand-600"
          />
          {t('PRODUCTS_LOW_STOCK_ONLY')}
        </label>
      </div>

      <Panel flush>
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(product) => product._id}
          isLoading={isPending}
          emptyMessage={t('PRODUCTS_EMPTY')}
          emptyAction={
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsAdding(true);
              }}
            >
              {t('PRODUCTS_ADD')}
            </Button>
          }
          caption={t('PRODUCTS_TITLE')}
        />
      </Panel>

      {pageCount > 1 ? (
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
      ) : null}

      <AddProductModal open={isAdding} onOpenChange={setIsAdding} currency={currency} />
    </div>
  );
}
