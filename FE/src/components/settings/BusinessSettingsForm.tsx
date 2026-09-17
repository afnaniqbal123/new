import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel } from 'src/components/common/Panel';
import { Input } from 'src/components/common/Input';
import { Button } from 'src/components/common/Button';
import { useUpdateOrganization } from 'src/hooks/common/useBusinessMutations';
import type { Organization } from 'src/schemas/common/business.schema';

interface BusinessSettingsFormProps {
  organization: Organization;
  canEdit: boolean;
}

/**
 * Who the business is, as it appears on an invoice.
 *
 * Currency is shown but not editable. It is fixed when the business is created
 * because every stored amount is an integer in that currency's minor units
 * (CONTEXT.md D4) — changing the code would silently reinterpret every past
 * total rather than convert it, so it is a migration, not a setting.
 */
export function BusinessSettingsForm({ organization, canEdit }: BusinessSettingsFormProps) {
  const { t } = useTranslation();
  const update = useUpdateOrganization();

  const [name, setName] = useState(organization.name);
  const [legalName, setLegalName] = useState(organization.legalName ?? '');
  const [phone, setPhone] = useState(organization.phone ?? '');
  const [email, setEmail] = useState(organization.email ?? '');
  const [address, setAddress] = useState(organization.address ?? '');
  const [timezone, setTimezone] = useState(organization.timezone);

  function submit(event: SyntheticEvent) {
    event.preventDefault();

    update.mutate({
      name,
      legalName,
      phone,
      email,
      address,
      timezone,
    });
  }

  return (
    <Panel title={t('SETTINGS_BUSINESS')}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-foreground-subtle text-sm">{t('SETTINGS_BUSINESS_HINT')}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('SETTINGS_NAME')}
            value={name}
            disabled={!canEdit}
            onChange={(event) => {
              setName(event.target.value);
            }}
            required
          />
          <Input
            label={t('SETTINGS_LEGAL_NAME')}
            value={legalName}
            disabled={!canEdit}
            onChange={(event) => {
              setLegalName(event.target.value);
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('SETTINGS_PHONE')}
            value={phone}
            disabled={!canEdit}
            onChange={(event) => {
              setPhone(event.target.value);
            }}
            inputMode="tel"
          />
          <Input
            label={t('SETTINGS_EMAIL')}
            type="email"
            value={email}
            disabled={!canEdit}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        </div>

        <Input
          label={t('SETTINGS_ADDRESS')}
          value={address}
          disabled={!canEdit}
          onChange={(event) => {
            setAddress(event.target.value);
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('SETTINGS_TIMEZONE')}
            value={timezone}
            disabled={!canEdit}
            onChange={(event) => {
              setTimezone(event.target.value);
            }}
            hint={t('SETTINGS_TIMEZONE_HINT')}
          />
          <Input
            label={t('SETTINGS_CURRENCY')}
            value={organization.currency}
            readOnly
            disabled
            hint={t('SETTINGS_CURRENCY_LOCKED')}
          />
        </div>

        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? t('LOADING') : t('BUTTON_SAVE')}
            </Button>
          </div>
        ) : null}
      </form>
    </Panel>
  );
}
