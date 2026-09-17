import { useTranslation } from 'react-i18next';
import { Icon } from 'src/components/common/Icon';

/**
 * The product's argument, shown rather than described.
 *
 * A customer's WhatsApp message on one side, the priced and checked draft order
 * it becomes on the other. This replaced three boxes of prose that asserted the
 * same thing — and a claim about turning a sentence into an invoice is not
 * believable until someone sees the invoice.
 *
 * ## The figures are real arithmetic
 *
 * 2 cartons × 12 = 24 bottles at Rs 150 is Rs 3,600; 10 tubes at Rs 260 is
 * Rs 2,600; Rs 6,200 plus 18% GST is Rs 7,316. They are hard-coded here because
 * this is a marketing illustration rather than a live quote — but they are the
 * numbers this product would actually produce for that basket, at the seed
 * catalogue's own prices. A mock that did not add up would be the one thing a
 * distributor noticed immediately.
 */
export function OrderFlowDemo() {
  const { t } = useTranslation();

  return (
    <div className="lg:grid-cols-flow grid items-center gap-4">
      {/* --- The message --- */}
      <div className="border-border bg-surface-raised shadow-card rounded-2xl border p-5">
        <div className="flex items-center gap-3">
          <span className="bg-brand-500/15 text-brand-600 flex size-9 items-center justify-center rounded-full">
            <Icon name="chat" className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block truncate text-sm font-semibold">
              {t('LANDING_DEMO_CUSTOMER')}
            </span>
            <span className="text-foreground-subtle block text-xs">{t('LANDING_DEMO_TIME')}</span>
          </span>
        </div>

        <p className="bg-surface-muted text-foreground mt-4 rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
          {t('LANDING_DEMO_MESSAGE')}
        </p>
      </div>

      {/* --- The transformation --- */}
      {/* Points down when the cards stack, right when they sit side by side —
          the arrow has to agree with the layout it is explaining. */}
      <div aria-hidden="true" className="text-brand-500 flex items-center justify-center">
        <span className="bg-brand-500/10 flex size-10 rotate-90 items-center justify-center rounded-full lg:rotate-0">
          <Icon name="arrowRight" className="size-5" />
        </span>
      </div>

      {/* --- The order it became --- */}
      <div className="border-brand-500/40 bg-surface-raised shadow-card rounded-2xl border p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="text-foreground block truncate text-sm font-semibold">
              {t('LANDING_DEMO_ORDER_TITLE')}
            </span>
            <span className="text-brand-600 block text-xs font-medium">
              {t('LANDING_DEMO_ORDER_STATUS')}
            </span>
          </span>
          <span className="bg-brand-500/15 text-brand-600 flex size-9 shrink-0 items-center justify-center rounded-full">
            <Icon name="receipt" className="size-4.5" />
          </span>
        </div>

        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-foreground min-w-0 truncate">
              {t('LANDING_DEMO_LINE_1')}
              <span className="text-foreground-subtle"> · {t('LANDING_DEMO_LINE_1_QTY')}</span>
            </dt>
            <dd className="tabular text-foreground shrink-0">{t('LANDING_DEMO_LINE_1_AMOUNT')}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-foreground min-w-0 truncate">
              {t('LANDING_DEMO_LINE_2')}
              <span className="text-foreground-subtle"> · {t('LANDING_DEMO_LINE_2_QTY')}</span>
            </dt>
            <dd className="tabular text-foreground shrink-0">{t('LANDING_DEMO_LINE_2_AMOUNT')}</dd>
          </div>

          <div className="border-border mt-1 flex items-baseline justify-between gap-3 border-t pt-2">
            <dt className="text-foreground-muted">{t('LANDING_DEMO_TAX')}</dt>
            <dd className="tabular text-foreground-muted">{t('LANDING_DEMO_TAX_AMOUNT')}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-foreground font-semibold">{t('LANDING_DEMO_TOTAL')}</dt>
            <dd className="tabular text-foreground text-base font-semibold">
              {t('LANDING_DEMO_TOTAL_AMOUNT')}
            </dd>
          </div>
        </dl>

        <ul className="mt-4 flex flex-col gap-1.5">
          {[t('LANDING_DEMO_STOCK'), t('LANDING_DEMO_CREDIT')].map((line) => (
            <li key={line} className="text-foreground-muted flex items-center gap-2 text-xs">
              <Icon name="check" className="text-brand-500 size-3.5" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
