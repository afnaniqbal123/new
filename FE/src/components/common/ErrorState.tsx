import { useTranslation } from 'react-i18next';
import { Button } from 'src/components/common/Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

/** Standard error placeholder for a query's error state, with an optional retry. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="border-danger flex flex-col items-center gap-3 rounded-md border border-dashed py-8 text-center"
    >
      <p className="text-foreground text-sm">{message ?? t('ERROR')}</p>
      {onRetry ? (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          {t('BUTTON_RETRY')}
        </Button>
      ) : null}
    </div>
  );
}
