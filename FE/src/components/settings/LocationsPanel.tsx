import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel } from 'src/components/common/Panel';
import { Input } from 'src/components/common/Input';
import { Button } from 'src/components/common/Button';
import { Badge } from 'src/components/common/Badge';
import { useLocations } from 'src/hooks/common/useBusinessData';
import { useCreateLocation } from 'src/hooks/common/useBusinessMutations';
import { LOCATION_TYPE_LABEL } from 'src/constants/labels';

interface LocationsPanelProps {
  canEdit: boolean;
}

const LOCATION_TYPES = ['WAREHOUSE', 'SHOP', 'VAN'] as const;

/**
 * The places stock can sit.
 *
 * The rest of the app runs single-location on purpose (CONTEXT.md D5): stock
 * is stored per location in the ledger from day one, but every screen defaults
 * to the main one, so a shop with one storeroom never has to think about it.
 * This panel is where a business that grows a second location adds it — the
 * schema is already ready for it, only the UI was deliberately not.
 */
export function LocationsPanel({ canEdit }: LocationsPanelProps) {
  const { t } = useTranslation();
  const { data: locations } = useLocations();
  const createLocation = useCreateLocation();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<string>('WAREHOUSE');

  function submit(event: SyntheticEvent) {
    event.preventDefault();

    createLocation.mutate(
      { name, code: code || undefined, type },
      {
        onSuccess: () => {
          setName('');
          setCode('');
          setType('WAREHOUSE');
        },
      }
    );
  }

  return (
    <Panel title={t('SETTINGS_LOCATIONS')}>
      <p className="text-foreground-subtle text-sm">{t('SETTINGS_LOCATIONS_HINT')}</p>

      <ul className="mt-3 flex flex-col gap-2">
        {(locations ?? []).map((location) => {
          const typeKey = LOCATION_TYPE_LABEL[location.type];

          return (
            <li
              key={location._id}
              className="border-border flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
            >
              <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                {location.name}
              </span>
              {location.code ? (
                <span className="text-foreground-subtle font-mono text-xs">{location.code}</span>
              ) : null}
              <Badge tone="neutral">{typeKey ? t(typeKey) : location.type}</Badge>
              {location.isDefault ? (
                <Badge tone="brand">{t('SETTINGS_LOCATION_DEFAULT')}</Badge>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canEdit ? (
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Input
              label={t('SETTINGS_LOCATION_NAME')}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              required
            />
          </div>
          <div className="w-28">
            <Input
              label={t('SETTINGS_LOCATION_CODE')}
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
              }}
            />
          </div>
          <div className="flex w-36 flex-col gap-1">
            <label htmlFor="location-type" className="text-foreground text-sm font-medium">
              {t('SETTINGS_LOCATION_TYPE')}
            </label>
            <select
              id="location-type"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
              }}
              className="border-border bg-surface text-foreground rounded-md border px-3 py-2 text-sm"
            >
              {LOCATION_TYPES.map((option) => {
                const key = LOCATION_TYPE_LABEL[option];

                return (
                  <option key={option} value={option}>
                    {key ? t(key) : option}
                  </option>
                );
              })}
            </select>
          </div>
          <Button type="submit" disabled={createLocation.isPending}>
            {createLocation.isPending ? t('LOADING') : t('SETTINGS_LOCATION_ADD')}
          </Button>
        </form>
      ) : null}
    </Panel>
  );
}
