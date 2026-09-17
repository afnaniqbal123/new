import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from 'src/components/common/Button';
import { Seo } from 'src/components/common/Seo';

/**
 * 403 — reached via `RoleGuards`'s wrong-role redirect.
 *
 * Self-contained rather than wrapped in a layout: it is reachable both signed
 * in and signed out, and the two shells this app has (the marketing page's own
 * header, and the signed-in sidebar) would each be wrong for one of those
 * cases.
 */
export function ForbiddenPage() {
  const { t } = useTranslation();

  return (
    <main className="bg-surface text-foreground flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Seo title={t('FORBIDDEN_TITLE')} />
      <p className="text-brand-600 text-sm font-semibold tracking-widest uppercase">
        {t('FORBIDDEN_CODE')}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{t('FORBIDDEN_TITLE')}</h1>
      <p className="text-foreground-muted max-w-prose">{t('FORBIDDEN_BODY')}</p>
      <Button asChild>
        <Link to="/">{t('BACK_TO_HOME')}</Link>
      </Button>
    </main>
  );
}
