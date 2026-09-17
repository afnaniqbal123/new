import { useTranslation } from 'react-i18next';
import { EmptyState } from 'src/components/common/EmptyState';
import { PageHeader } from 'src/components/common/PageHeader';
import { Seo } from 'src/components/common/Seo';

/**
 * Common route — reachable by every role (`roles: 'all'` in
 * `src/routes/ProtectedRoutes.tsx`'s `COMMON_PROTECTED_ROUTES`), one shared
 * page rather than a copy per role.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('NAV_PROFILE')} />
      <PageHeader title={t('NAV_PROFILE')} />
      <EmptyState title={t('PROFILE_EMPTY_TITLE')} description={t('PROFILE_EMPTY_BODY')} />
    </div>
  );
}
