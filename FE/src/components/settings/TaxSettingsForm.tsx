import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel } from 'src/components/common/Panel';
import { Input } from 'src/components/common/Input';
import { Button } from 'src/components/common/Button';
import { SettingsToggle } from 'src/components/settings/SettingsToggle';
import { useUpdateOrganization } from 'src/hooks/common/useBusinessMutations';
import type { Organization } from 'src/schemas/common/business.schema';

interface TaxSettingsFormProps {
  organization: Organization;
  canEdit: boolean;
}

/**
 * The tax basis every future sale is priced under.
 *
 * Rates are whole percentages, which is what the API accepts (`@IsInt()` on
 * `TaxSettingsDto`) and what a tax authority actually publishes. They are held
 * as strings while typing for the same reason prices are — see
 * `components/catalog/AddProductModal.tsx` — and converted once on submit.
 *
 * Nothing here touches an invoice that has already been issued: the rate is
 * copied onto a sale when it completes, so a change from 17% to 18% never
 * silently restates last month's books.
 */
export function TaxSettingsForm({ organization, canEdit }: TaxSettingsFormProps) {
  const { t } = useTranslation();
  const update = useUpdateOrganization();

  const [registrationNumber, setRegistrationNumber] = useState(
    organization.tax.registrationNumber ?? ''
  );
  const [nationalTaxNumber, setNationalTaxNumber] = useState(
    organization.tax.nationalTaxNumber ?? ''
  );
  const [defaultRatePercent, setDefaultRatePercent] = useState(
    String(organization.tax.defaultRatePercent)
  );
  const [furtherTaxPercent, setFurtherTaxPercent] = useState(
    String(organization.tax.furtherTaxPercent)
  );
  const [withholdingPercent, setWithholdingPercent] = useState(
    String(organization.tax.withholdingPercent)
  );
  const [pricesIncludeTax, setPricesIncludeTax] = useState(organization.tax.pricesIncludeTax);

  function submit(event: SyntheticEvent) {
    event.preventDefault();

    update.mutate({
      tax: {
        registrationNumber,
        nationalTaxNumber,
        defaultRatePercent: Number(defaultRatePercent) || 0,
        furtherTaxPercent: Number(furtherTaxPercent) || 0,
        withholdingPercent: Number(withholdingPercent) || 0,
        pricesIncludeTax,
      },
    });
  }

  return (
    <Panel title={t('SETTINGS_TAX')}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-foreground-subtle text-sm">{t('SETTINGS_TAX_HINT')}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('SETTINGS_TAX_REGISTRATION')}
            value={registrationNumber}
            disabled={!canEdit}
            onChange={(event) => {
              setRegistrationNumber(event.target.value);
            }}
          />
          <Input
            label={t('SETTINGS_TAX_NTN')}
            value={nationalTaxNumber}
            disabled={!canEdit}
            onChange={(event) => {
              setNationalTaxNumber(event.target.value);
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label={t('SETTINGS_TAX_RATE')}
            value={defaultRatePercent}
            disabled={!canEdit}
            onChange={(event) => {
              setDefaultRatePercent(event.target.value);
            }}
            inputMode="numeric"
          />
          <Input
            label={t('SETTINGS_TAX_FURTHER')}
            value={furtherTaxPercent}
            disabled={!canEdit}
            onChange={(event) => {
              setFurtherTaxPercent(event.target.value);
            }}
            inputMode="numeric"
            hint={t('SETTINGS_TAX_FURTHER_HINT')}
          />
          <Input
            label={t('SETTINGS_TAX_WITHHOLDING')}
            value={withholdingPercent}
            disabled={!canEdit}
            onChange={(event) => {
              setWithholdingPercent(event.target.value);
            }}
            inputMode="numeric"
          />
        </div>

        <SettingsToggle
          label={t('SETTINGS_TAX_INCLUSIVE')}
          hint={t('SETTINGS_TAX_INCLUSIVE_HINT')}
          checked={pricesIncludeTax}
          disabled={!canEdit}
          onChange={setPricesIncludeTax}
        />

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
