import { useTranslation } from 'react-i18next';
import { Carousel } from 'src/components/common/Carousel';
import { Icon, type IconName } from 'src/components/common/Icon';
import type { TranslationKey } from 'src/i18n';

interface Stop {
  id: string;
  icon: IconName;
  metaKey: TranslationKey;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  /** A small, honest sample of what that screen shows. */
  figures: { labelKey: TranslationKey; value: string }[];
}

/**
 * The product walked through as a day, rather than listed as features.
 *
 * The figures on each slide are the ones the seeded demo business actually
 * produces, so anyone who signs in after reading this sees the same numbers
 * rather than discovering the marketing used rounder ones.
 */
const STOPS: Stop[] = [
  {
    id: 'morning',
    icon: 'dashboard',
    metaKey: 'LANDING_TOUR_1_META',
    titleKey: 'LANDING_TOUR_1_TITLE',
    bodyKey: 'LANDING_TOUR_1_BODY',
    figures: [
      { labelKey: 'DASHBOARD_RECEIVABLES', value: 'Rs 127,469' },
      { labelKey: 'DASHBOARD_LOW_STOCK', value: '5' },
      { labelKey: 'DASHBOARD_STOCK_VALUE', value: 'Rs 310,043' },
    ],
  },
  {
    id: 'counter',
    icon: 'cart',
    metaKey: 'LANDING_TOUR_2_META',
    titleKey: 'LANDING_TOUR_2_TITLE',
    bodyKey: 'LANDING_TOUR_2_BODY',
    figures: [
      { labelKey: 'POS_SUBTOTAL', value: 'Rs 6,200' },
      { labelKey: 'POS_TAX', value: 'Rs 1,116' },
      { labelKey: 'POS_TOTAL', value: 'Rs 7,316' },
    ],
  },
  {
    id: 'whatsapp',
    icon: 'chat',
    metaKey: 'LANDING_TOUR_3_META',
    titleKey: 'LANDING_TOUR_3_TITLE',
    bodyKey: 'LANDING_TOUR_3_BODY',
    figures: [
      { labelKey: 'LANDING_DEMO_ORDER_STATUS', value: 'KT-000099' },
      { labelKey: 'LANDING_DEMO_STOCK', value: '✓' },
      { labelKey: 'LANDING_DEMO_CREDIT', value: '✓' },
    ],
  },
  {
    id: 'evening',
    icon: 'chart',
    metaKey: 'LANDING_TOUR_4_META',
    titleKey: 'LANDING_TOUR_4_TITLE',
    bodyKey: 'LANDING_TOUR_4_BODY',
    figures: [
      { labelKey: 'REPORT_SALES_SUMMARY', value: 'Rs 163,120' },
      { labelKey: 'REPORT_PROFIT', value: 'Rs 50,972' },
      { labelKey: 'REPORT_RECEIVABLES_AGING', value: '5 buckets' },
    ],
  },
];

export function ProductTour() {
  const { t } = useTranslation();

  return (
    <Carousel
      label={t('LANDING_TOUR_TITLE')}
      autoplayMs={7000}
      slides={STOPS.map((stop) => ({
        id: stop.id,
        content: (
          <div className="border-border bg-surface-raised grid gap-8 rounded-2xl border p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-brand-600 flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
                <Icon name={stop.icon} className="size-4" />
                {t(stop.metaKey)}
              </span>
              <h3 className="text-foreground mt-4 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
                {t(stop.titleKey)}
              </h3>
              <p className="text-foreground-muted mt-3 text-sm sm:text-base">{t(stop.bodyKey)}</p>
            </div>

            <dl className="bg-surface-muted border-border flex flex-col gap-3 rounded-xl border p-5">
              {stop.figures.map((figure) => (
                <div
                  key={figure.labelKey}
                  className="flex items-baseline justify-between gap-4 text-sm"
                >
                  <dt className="text-foreground-muted min-w-0 truncate">{t(figure.labelKey)}</dt>
                  <dd className="tabular text-foreground shrink-0 font-semibold">{figure.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ),
      }))}
    />
  );
}
