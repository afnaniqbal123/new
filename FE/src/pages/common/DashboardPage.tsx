import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { StatTile } from 'src/components/common/StatTile';
import { Money } from 'src/components/common/Money';
import { Badge } from 'src/components/common/Badge';
import { LoadingState } from 'src/components/common/LoadingState';
import { ErrorState } from 'src/components/common/ErrorState';
import { EmptyState } from 'src/components/common/EmptyState';
import { useDashboard } from 'src/hooks/common/useBusinessData';
import { useAuthStore } from 'src/stores/authStore';
import { Seo } from 'src/components/common/Seo';
import { formatMoney } from 'src/utils/money';

/**
 * The screen a shop owner opens first thing in the morning.
 *
 * Everything on it answers one of three questions: *did we sell?*, *who owes
 * money?*, *what needs doing today?* Anything that answers none of those was
 * deliberately left off — this is a ten-second glance, not a report.
 *
 * Profit figures are absent for roles that may not see margin. The API strips
 * them (that is the enforcement); this page simply does not render a tile for
 * a figure it was not given, so a cashier sees a complete-looking dashboard
 * rather than a grid with holes in it.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const name = useAuthStore((state) => state.user?.name ?? '');
  const { data, isPending, isError, refetch } = useDashboard();

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const currency = data.currency;
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t('DASHBOARD_GREETING', { name })
      : hour < 17
        ? t('DASHBOARD_GREETING_AFTERNOON', { name })
        : t('DASHBOARD_GREETING_EVENING', { name });

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('DASHBOARD_TITLE')} />
      <PageHeader title={greeting} description={t('APP_TAGLINE')} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t('DASHBOARD_TODAY_SALES')}
          value={<Money amount={data.today.revenue} currency={currency} size="xl" />}
          hint={t('DASHBOARD_TODAY_ORDERS', { count: data.today.count })}
        />
        <StatTile
          label={t('DASHBOARD_RECEIVABLES')}
          value={
            <Money
              amount={data.receivables}
              currency={currency}
              size="xl"
              tone={data.receivables > 0 ? 'debt' : 'default'}
            />
          }
          emphasis={data.receivables > 0 ? 'warning' : 'none'}
        />
        <StatTile
          label={t('DASHBOARD_PAYABLES')}
          value={<Money amount={data.payables} currency={currency} size="xl" />}
        />
        <StatTile
          label={t('DASHBOARD_LOW_STOCK')}
          value={
            <span className="tabular text-foreground text-3xl font-semibold tracking-tight">
              {data.lowStockCount}
            </span>
          }
          hint={t('DASHBOARD_LOW_STOCK_COUNT', { count: data.lowStockCount })}
          emphasis={data.lowStockCount > 0 ? 'warning' : 'none'}
        />
      </div>

      {/*
        The margin row renders only when the API actually sent margin. For a
        cashier these keys are absent, and rendering a zero would be worse
        than rendering nothing — it would be a wrong number.
      */}
      {data.month.profit !== undefined || data.stockValue !== undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            label={t('DASHBOARD_MONTH_SALES')}
            value={<Money amount={data.month.revenue} currency={currency} size="lg" />}
            hint={t('DASHBOARD_MONTH_ORDERS', { count: data.month.count })}
          />
          {data.month.profit !== undefined ? (
            <StatTile
              label={t('DASHBOARD_PROFIT')}
              value={
                <Money amount={data.month.profit} currency={currency} size="lg" tone="positive" />
              }
            />
          ) : null}
          {data.stockValue !== undefined ? (
            <StatTile
              label={t('DASHBOARD_STOCK_VALUE')}
              value={<Money amount={data.stockValue} currency={currency} size="lg" />}
            />
          ) : null}
        </div>
      ) : null}

      <Panel title={t('DASHBOARD_TREND')}>
        {data.salesByDay.length === 0 ? (
          <EmptyState title={t('DASHBOARD_NO_SALES_YET')} />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesByDay} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  {/*
                    Every colour here is a @theme token passed as a CSS custom
                    property, so the chart follows light/dark mode without a
                    second palette — AGENTS.md § Charting.
                  */}
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--color-foreground-subtle)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  // Only the day-of-month: thirty full ISO dates on one axis is
                  // unreadable at any width a phone has.
                  tickFormatter={(value: string) => value.slice(8)}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-foreground-subtle)' }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(value: number) => formatMoney(value, currency, { compact: true })}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-foreground)',
                    fontSize: 12,
                  }}
                  // Recharts types a tooltip value as its own ValueType
                  // union, so the number is narrowed here rather than the
                  // signature being widened at the call site.
                  formatter={(value) =>
                    typeof value === 'number' ? formatMoney(value, currency) : String(value)
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-brand-500)"
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t('DASHBOARD_LOW_STOCK')}
          action={
            <Link
              to="/products?lowStock=true"
              className="text-brand-600 text-sm font-medium hover:underline"
            >
              {t('VIEW_ALL')}
            </Link>
          }
        >
          {data.lowStock.length === 0 ? (
            <EmptyState title={t('PURCHASING_SUGGESTIONS_EMPTY')} />
          ) : (
            <ul className="divide-border divide-y">
              {data.lowStock.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">{product.name}</p>
                    <p className="text-foreground-subtle font-mono text-xs">{product.sku}</p>
                  </div>
                  <Badge tone={product.stockOnHand <= 0 ? 'danger' : 'warning'}>
                    {product.stockOnHand} / {product.reorderLevel}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={t('DASHBOARD_RECENT_SALES')}
          action={
            <Link to="/sales" className="text-brand-600 text-sm font-medium hover:underline">
              {t('VIEW_ALL')}
            </Link>
          }
        >
          {data.recentSales.length === 0 ? (
            <EmptyState title={t('DASHBOARD_NO_SALES_YET')} />
          ) : (
            <ul className="divide-border divide-y">
              {data.recentSales.map((sale) => (
                <li key={String(sale._id)} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-foreground truncate font-mono text-sm">
                      {sale.invoiceNumber ?? '—'}
                    </p>
                    <p className="text-foreground-subtle truncate text-xs">
                      {sale.customerName ?? t('POS_WALK_IN')}
                    </p>
                  </div>
                  <Money amount={sale.grandTotal ?? 0} currency={currency} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
