import { useTranslation } from 'react-i18next';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { Badge } from 'src/components/common/Badge';
import { Button } from 'src/components/common/Button';
import { LoadingState } from 'src/components/common/LoadingState';
import { Seo } from 'src/components/common/Seo';
import { usePlans, useSubscription } from 'src/hooks/common/useBusinessData';
import { useOpenBillingPortal, useStartCheckout } from 'src/hooks/common/useBusinessMutations';

/**
 * The plan, and how to change it.
 *
 * A plan is only offered as purchasable when the API says it is — which
 * requires both Stripe keys and a configured price id. A deployment without
 * them shows "contact sales" rather than a button that fails, because a
 * checkout button that 503s is worse than no button.
 */
export function BillingPage() {
  const { t } = useTranslation();
  const { data: subscription, isPending } = useSubscription();
  const { data: plans } = usePlans();
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal();

  if (isPending) return <LoadingState />;

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('BILLING_TITLE')} />
      <PageHeader
        title={t('BILLING_TITLE')}
        actions={
          subscription?.hasStripeSubscription ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                portal.mutate();
              }}
              disabled={portal.isPending}
            >
              {t('BILLING_MANAGE')}
            </Button>
          ) : null
        }
      />

      {subscription && !subscription.billingConfigured ? (
        <Panel>
          <p className="text-foreground-muted text-sm">{t('BILLING_NOT_CONFIGURED')}</p>
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(plans ?? []).map((plan) => (
          <Panel key={plan.plan} className={plan.current ? 'border-brand-500' : undefined}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-foreground text-lg font-semibold">{plan.name}</h2>
              {plan.current ? <Badge tone="brand">{t('BILLING_CURRENT')}</Badge> : null}
            </div>

            <p className="mt-2">
              {plan.monthlyPrice === 0 ? (
                <span className="text-foreground text-2xl font-semibold">{t('BILLING_FREE')}</span>
              ) : (
                <>
                  <Money amount={plan.monthlyPrice} currency={plan.currency} size="xl" />
                  <span className="text-foreground-muted text-sm">{t('BILLING_PER_MONTH')}</span>
                </>
              )}
            </p>

            <ul className="text-foreground-muted mt-3 flex flex-col gap-1 text-sm">
              {plan.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-2">
                  <span aria-hidden="true" className="text-brand-500">
                    ✓
                  </span>
                  {highlight}
                </li>
              ))}
            </ul>

            {!plan.current ? (
              <div className="mt-4">
                {plan.purchasable ? (
                  <Button
                    type="button"
                    onClick={() => {
                      checkout.mutate(plan.plan);
                    }}
                    disabled={checkout.isPending}
                    className="w-full"
                  >
                    {t('BILLING_UPGRADE')}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" className="w-full" asChild>
                    <a href="mailto:sales@businessos.test">{t('BILLING_CONTACT_SALES')}</a>
                  </Button>
                )}
              </div>
            ) : null}
          </Panel>
        ))}
      </div>
    </div>
  );
}
