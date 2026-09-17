import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PERIOD_LABEL, REPORT_LABEL } from 'src/constants/labels';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { Button } from 'src/components/common/Button';
import { EmptyState } from 'src/components/common/EmptyState';
import { LoadingState } from 'src/components/common/LoadingState';
import { Seo } from 'src/components/common/Seo';
import { useReport, useReportKinds } from 'src/hooks/common/useBusinessData';

const PERIODS = [
  'TODAY',
  'THIS_WEEK',
  'THIS_MONTH',
  'LAST_MONTH',
  'LAST_30_DAYS',
  'THIS_YEAR',
] as const;

/**
 * Every report, driven entirely by what the API offers.
 *
 * The report list comes from `GET /reports/kinds`, which is already filtered
 * to what this role may run — so a cashier is never shown a Profit option
 * that would 403. Hardcoding the list here would put that filtering in two
 * places and let them drift.
 */
export function ReportsPage() {
  const { t } = useTranslation();
  const { data: kinds } = useReportKinds();
  const [kind, setKind] = useState<string | undefined>(undefined);
  const [period, setPeriod] = useState<string>('THIS_MONTH');

  const activeKind = kind ?? kinds?.[0];
  const { data: report, isFetching } = useReport(activeKind, period);

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('REPORTS_TITLE')} />
      <PageHeader title={t('REPORTS_TITLE')} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(kinds ?? []).map((candidate) => (
            <Button
              key={candidate}
              type="button"
              size="sm"
              variant={candidate === activeKind ? 'primary' : 'secondary'}
              onClick={() => {
                setKind(candidate);
              }}
            >
              {t(REPORT_LABEL[candidate] ?? 'REPORTS_TITLE')}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((candidate) => (
            <Button
              key={candidate}
              type="button"
              size="sm"
              variant={candidate === period ? 'primary' : 'ghost'}
              onClick={() => {
                setPeriod(candidate);
              }}
            >
              {t(PERIOD_LABEL[candidate] ?? 'PERIOD_TODAY')}
            </Button>
          ))}
        </div>
      </div>

      {isFetching && !report ? (
        <LoadingState />
      ) : !report ? (
        <EmptyState title={t('REPORTS_EMPTY')} />
      ) : (
        <>
          <Panel title={report.period.label}>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(report.summary).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1">
                  <dt className="text-foreground-muted text-xs font-medium tracking-wide uppercase">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </dt>
                  <dd>
                    {/*
                      Counts and percentages are plain numbers; everything else
                      is money. Deciding by key name rather than by a per-report
                      schema keeps a new report from needing UI work — the
                      trade-off is this heuristic, which is why the names are
                      consistent on the server side.
                    */}
                    {/count|orders|products|customers|days|percent|batches|suppliers|receipts|transactions/i.test(
                      key
                    ) ? (
                      <span className="tabular text-foreground text-xl font-semibold">{value}</span>
                    ) : (
                      <Money amount={value} currency={report.currency} size="lg" />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          {report.rows.length > 0 ? (
            <Panel flush>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{report.kind}</caption>
                  <thead className="border-border border-b">
                    <tr className="text-foreground-muted text-left">
                      {Object.keys(report.rows[0] ?? {}).map((column) => (
                        <th key={column} scope="col" className="px-4 py-2 font-medium">
                          {column.replace(/([A-Z])/g, ' $1')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {report.rows.map((row) => (
                      <tr key={rowKey(row)}>
                        {Object.entries(row).map(([column, value]) => (
                          <td key={column} className="tabular px-4 py-2">
                            {typeof value === 'number' &&
                            /amount|revenue|value|price|total|profit|cost|outstanding|payable/i.test(
                              column
                            ) ? (
                              <Money
                                amount={value}
                                currency={report.currency}
                                size="sm"
                                hideCurrency
                              />
                            ) : (
                              formatCell(value)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * A stable key for a report row.
 *
 * Report rows carry no id — they are aggregation output — so identity comes
 * from the values themselves. An array index would be wrong the moment the
 * period changes and React reuses a row's DOM for different data.
 */
function rowKey(row: Record<string, unknown>): string {
  return Object.values(row)
    .map((value) => formatCell(value))
    .join('|');
}

/**
 * Renders one cell's value.
 *
 * `String()` on an object produces "[object Object]", which is how a report
 * ends up displaying nonsense for a field that turned out to be nested. This
 * narrows to the primitives a cell can legitimately hold and shows a dash for
 * anything else.
 */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Date) return value.toLocaleDateString();

  return '—';
}
