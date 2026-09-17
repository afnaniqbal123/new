import { useTranslation } from 'react-i18next';

interface LoadingStateProps {
  label?: string;
}

/** Standard loading placeholder for a query's pending state. */
export function LoadingState({ label }: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="text-foreground-muted flex items-center justify-center gap-2 py-8 text-sm"
    >
      <span
        aria-hidden="true"
        className="border-border border-t-brand-600 h-4 w-4 animate-spin rounded-full border-2"
      />
      {label ?? t('LOADING')}
    </div>
  );
}
