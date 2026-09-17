import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingState } from 'src/components/common/LoadingState';
import { EmptyState } from 'src/components/common/EmptyState';

export interface DataTableColumn<TRow> {
  id: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
}

interface DataTableProps<TRow> {
  columns: readonly DataTableColumn<TRow>[];
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  /** One line of context shown under the empty-state title. */
  emptyDescription?: ReactNode;
  /** A next action shown under the empty-state message (e.g. "Add product"). */
  emptyAction?: ReactNode;
  caption: string;
}

/** Generic typed table with built-in loading/empty states — compose columns per feature. */
export function DataTable<TRow>({
  columns,
  rows,
  getRowId,
  isLoading,
  emptyMessage,
  emptyDescription,
  emptyAction,
  caption,
}: DataTableProps<TRow>) {
  const { t } = useTranslation();
  if (isLoading) return <LoadingState />;
  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyMessage ?? t('EMPTY_RESULTS')}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    // Tables never break page layout on a narrow screen — they scroll within
    // this wrapper instead of forcing the whole page wider.
    <div className="overflow-x-auto">
      <table className="border-border w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-border border-b">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className="text-foreground-muted px-3 py-2 text-left font-medium"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)} className="border-border border-b last:border-0">
              {columns.map((column) => (
                <td key={column.id} className="text-foreground px-3 py-2">
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
