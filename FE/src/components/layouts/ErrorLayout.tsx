import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Route-level error boundary shell used by the data router's errorElement. */
export function ErrorLayout() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const { t } = useTranslation();

  return (
    <div className="bg-surface text-foreground flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">
        {isNotFound ? t('NOT_FOUND_TITLE') : t('ERROR_BOUNDARY_TITLE')}
      </h1>
      <p className="text-foreground-muted">{isNotFound ? t('NOT_FOUND_BODY') : t('ERROR')}</p>
      <Link to="/" className="text-brand-600 text-sm font-medium underline">
        {t('BACK_TO_HOME')}
      </Link>
    </div>
  );
}
