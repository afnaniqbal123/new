import { useTranslation } from 'react-i18next';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Badge } from 'src/components/common/Badge';
import { Seo } from 'src/components/common/Seo';
import { LoadingState } from 'src/components/common/LoadingState';
import { BusinessSettingsForm } from 'src/components/settings/BusinessSettingsForm';
import { TaxSettingsForm } from 'src/components/settings/TaxSettingsForm';
import { InvoiceSettingsForm } from 'src/components/settings/InvoiceSettingsForm';
import { LocationsPanel } from 'src/components/settings/LocationsPanel';
import { useOrganization } from 'src/hooks/common/useBusinessData';
import { useAuthStore } from 'src/stores/authStore';
import { Role } from 'src/routes/roles';

/** Roles the API's `ORGANIZATION_SUBJECT` update permission actually grants. */
const EDITOR_ROLES: readonly string[] = [Role.OWNER, Role.ADMIN];

/**
 * Everything about how this business bills, taxes and counts things.
 *
 * Reachable by every role (`roles: 'all'`), but only an owner or admin may
 * change anything — the same boundary the API enforces on
 * `PATCH /organizations/current`. Everyone else gets the page read-only rather
 * than a 403: a cashier asking "what tax rate are we on?" is a legitimate
 * question, and hiding the answer would not make the setting any safer.
 *
 * Each section saves on its own. One giant form would mean a typo in the
 * invoice footer blocks a tax-rate correction, and the API takes a partial
 * patch anyway.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const { data: organization, isPending } = useOrganization();
  const role = useAuthStore((state) => state.user?.role);
  const canEdit = Boolean(role && EDITOR_ROLES.includes(role));

  if (isPending || !organization) {
    return <LoadingState />;
  }

  const whatsapp = organization.whatsapp;
  const connected = whatsapp.connected === true;

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('NAV_SETTINGS')} />
      <PageHeader title={t('NAV_SETTINGS')} description={t('SETTINGS_SUBTITLE')} />

      {canEdit ? null : <p className="text-foreground-muted text-sm">{t('SETTINGS_READONLY')}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <BusinessSettingsForm organization={organization} canEdit={canEdit} />
        <TaxSettingsForm organization={organization} canEdit={canEdit} />
        <InvoiceSettingsForm organization={organization} canEdit={canEdit} />

        <div className="flex flex-col gap-4">
          <LocationsPanel canEdit={canEdit} />

          <Panel title={t('SETTINGS_WHATSAPP')}>
            <div className="flex flex-col gap-2">
              <Badge tone={connected ? 'success' : 'neutral'}>
                {connected
                  ? t('SETTINGS_WHATSAPP_CONNECTED', {
                      number: whatsapp.displayPhoneNumber ?? '',
                    })
                  : t('SETTINGS_WHATSAPP_NOT_CONNECTED')}
              </Badge>
              <p className="text-foreground-muted text-sm">{t('SETTINGS_WHATSAPP_HINT')}</p>
              {connected ? null : (
                <p className="text-foreground-subtle text-sm">{t('SETTINGS_WHATSAPP_SETUP')}</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
