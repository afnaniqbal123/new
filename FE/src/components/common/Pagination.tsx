import { useTranslation } from 'react-i18next';
import { Button } from 'src/components/common/Button';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

/** Generic prev/next pager — `ExampleWidget` (src/components/example/) uses this directly; use it for new features too instead of hand-rolling the same prev/next block again. */
export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('LABEL_PAGINATION')} className="flex items-center justify-between gap-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        // min-h/min-w keep the tap target at an accessible ≥44px even though
        // the visible label is compact — a small button text still needs a
        // full-size hit area on a touch screen.
        className="min-h-11 min-w-11"
        disabled={page <= 1}
        onClick={() => {
          onPageChange(page - 1);
        }}
      >
        {t('BUTTON_PREVIOUS')}
      </Button>
      <span aria-live="polite" className="text-foreground-muted tabular text-sm">
        {page} / {pageCount}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-h-11 min-w-11"
        disabled={page >= pageCount}
        onClick={() => {
          onPageChange(page + 1);
        }}
      >
        {t('BUTTON_NEXT')}
      </Button>
    </nav>
  );
}
