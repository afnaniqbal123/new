import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel } from 'src/components/common/Panel';
import { Input } from 'src/components/common/Input';
import { Button } from 'src/components/common/Button';
import { SettingsToggle } from 'src/components/settings/SettingsToggle';
import { useUpdateOrganization } from 'src/hooks/common/useBusinessMutations';
import type { Organization } from 'src/schemas/common/business.schema';

interface InvoiceSettingsFormProps {
  organization: Organization;
  canEdit: boolean;
}

const MIN_PADDING = 1;
const MAX_PADDING = 12;

/**
 * Invoice numbering and the operational switches that sit next to it.
 *
 * The "next invoice will be" line is a preview built from the same three
 * inputs the server uses, so a change to the prefix or the digit count can be
 * seen before it is saved rather than discovered on the next sale. The counter
 * itself (`nextNumber`) is read-only everywhere — it is allocated by the
 * server, last, as the first irreversible step of completing a sale, and a
 * client that could rewind it could issue two invoices with one number.
 */
export function InvoiceSettingsForm({ organization, canEdit }: InvoiceSettingsFormProps) {
  const { t } = useTranslation();
  const update = useUpdateOrganization();

  const [prefix, setPrefix] = useState(organization.invoice.prefix);
  const [padding, setPadding] = useState(String(organization.invoice.padding));
  const [footerNote, setFooterNote] = useState(organization.invoice.footerNote ?? '');
  const [allowNegativeStock, setAllowNegativeStock] = useState(
    organization.settings.allowNegativeStock
  );
  const [automationsEnabled, setAutomationsEnabled] = useState(
    organization.settings.automationsEnabled
  );
  const [morningDigestHour, setMorningDigestHour] = useState(
    String(organization.settings.morningDigestHour)
  );
  const [eveningDigestHour, setEveningDigestHour] = useState(
    String(organization.settings.eveningDigestHour)
  );

  const digits = Math.min(MAX_PADDING, Math.max(MIN_PADDING, Number(padding) || MIN_PADDING));
  const preview = `${prefix}-${String(organization.invoice.nextNumber).padStart(digits, '0')}`;

  function submit(event: SyntheticEvent) {
    event.preventDefault();

    update.mutate({
      invoice: { prefix, padding: digits, footerNote },
      settings: {
        allowNegativeStock,
        automationsEnabled,
        morningDigestHour: Number(morningDigestHour) || 0,
        eveningDigestHour: Number(eveningDigestHour) || 0,
      },
    });
  }

  return (
    <Panel title={t('SETTINGS_INVOICE')}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-foreground-subtle text-sm">{t('SETTINGS_INVOICE_HINT')}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('SETTINGS_INVOICE_PREFIX')}
            value={prefix}
            disabled={!canEdit}
            onChange={(event) => {
              setPrefix(event.target.value);
            }}
          />
          <Input
            label={t('SETTINGS_INVOICE_PADDING')}
            value={padding}
            disabled={!canEdit}
            onChange={(event) => {
              setPadding(event.target.value);
            }}
            inputMode="numeric"
          />
        </div>

        <p className="text-foreground-muted text-sm">
          {t('SETTINGS_INVOICE_NEXT')} <span className="text-foreground font-mono">{preview}</span>
        </p>

        <Input
          label={t('SETTINGS_INVOICE_FOOTER')}
          value={footerNote}
          disabled={!canEdit}
          onChange={(event) => {
            setFooterNote(event.target.value);
          }}
        />

        <h3 className="text-foreground mt-2 text-sm font-semibold">{t('SETTINGS_OPERATIONS')}</h3>

        <SettingsToggle
          label={t('SETTINGS_NEGATIVE_STOCK')}
          hint={t('SETTINGS_NEGATIVE_STOCK_HINT')}
          checked={allowNegativeStock}
          disabled={!canEdit}
          onChange={setAllowNegativeStock}
        />
        <SettingsToggle
          label={t('SETTINGS_AUTOMATIONS')}
          hint={t('SETTINGS_AUTOMATIONS_HINT')}
          checked={automationsEnabled}
          disabled={!canEdit}
          onChange={setAutomationsEnabled}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('SETTINGS_MORNING_HOUR')}
            value={morningDigestHour}
            disabled={!canEdit || !automationsEnabled}
            onChange={(event) => {
              setMorningDigestHour(event.target.value);
            }}
            inputMode="numeric"
          />
          <Input
            label={t('SETTINGS_EVENING_HOUR')}
            value={eveningDigestHour}
            disabled={!canEdit || !automationsEnabled}
            onChange={(event) => {
              setEveningDigestHour(event.target.value);
            }}
            inputMode="numeric"
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
