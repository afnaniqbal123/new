import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Seo } from 'src/components/common/Seo';
import { Button } from 'src/components/common/Button';
import { Badge } from 'src/components/common/Badge';
import { Icon, type IconName } from 'src/components/common/Icon';
import { Logo } from 'src/components/common/Logo';
import { ThemeToggle } from 'src/components/common/ThemeToggle';
import { HeroScene } from 'src/components/landing/HeroScene';
import { OrderFlowDemo } from 'src/components/landing/OrderFlowDemo';
import { AssistantWidget } from 'src/components/landing/AssistantWidget';
import { ProductTour } from 'src/components/landing/ProductTour';
import type { TranslationKey } from 'src/i18n';

/**
 * The front door.
 *
 * ## What this page is arguing
 *
 * Not "we have features" — every POS has features. The argument is that the
 * *back office* is where a distributor's day actually goes, and that a
 * customer's WhatsApp message should become a priced, stock-checked,
 * credit-checked order without anyone retyping it.
 *
 * So the order is: the claim, then the claim *demonstrated* (`OrderFlowDemo` —
 * a real message and the real order it becomes), then why the numbers can be
 * trusted, then features, then price, then the objections people actually
 * raise. The feature grid is deliberately not first: it answers "how?", which
 * is only interesting once "why?" has landed.
 *
 * ## It owns its own chrome
 *
 * Header and footer are part of this page, not a shared shell. An earlier
 * version rendered inside the boilerplate's `AppLayout`, which produced two
 * stacked headers both showing the product name — the visible symptom of a
 * marketing page being treated as an app screen.
 *
 * ## Weight
 *
 * This whole page, three.js included, is its own lazy chunk that only
 * signed-out visitors load (see `HomeRedirectRoute`). The app's entry bundle is
 * unaffected by anything here (CONTEXT.md D15).
 */

const FEATURES: { icon: IconName; titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  { icon: 'cart', titleKey: 'LANDING_FEATURE_POS_TITLE', bodyKey: 'LANDING_FEATURE_POS_BODY' },
  {
    icon: 'layers',
    titleKey: 'LANDING_FEATURE_STOCK_TITLE',
    bodyKey: 'LANDING_FEATURE_STOCK_BODY',
  },
  {
    icon: 'users',
    titleKey: 'LANDING_FEATURE_CREDIT_TITLE',
    bodyKey: 'LANDING_FEATURE_CREDIT_BODY',
  },
  {
    icon: 'chat',
    titleKey: 'LANDING_FEATURE_WHATSAPP_TITLE',
    bodyKey: 'LANDING_FEATURE_WHATSAPP_BODY',
  },
  { icon: 'sparkles', titleKey: 'LANDING_FEATURE_AI_TITLE', bodyKey: 'LANDING_FEATURE_AI_BODY' },
  {
    icon: 'truck',
    titleKey: 'LANDING_FEATURE_PURCHASE_TITLE',
    bodyKey: 'LANDING_FEATURE_PURCHASE_BODY',
  },
];

const PROOF: { valueKey: TranslationKey; labelKey: TranslationKey }[] = [
  { valueKey: 'LANDING_PROOF_1_VALUE', labelKey: 'LANDING_PROOF_1_LABEL' },
  { valueKey: 'LANDING_PROOF_2_VALUE', labelKey: 'LANDING_PROOF_2_LABEL' },
  { valueKey: 'LANDING_PROOF_3_VALUE', labelKey: 'LANDING_PROOF_3_LABEL' },
  { valueKey: 'LANDING_PROOF_4_VALUE', labelKey: 'LANDING_PROOF_4_LABEL' },
];

const TRUST: { icon: IconName; key: TranslationKey }[] = [
  { icon: 'scale', key: 'LANDING_TRUST_1' },
  { icon: 'box', key: 'LANDING_TRUST_2' },
  { icon: 'shield', key: 'LANDING_TRUST_3' },
];

interface Plan {
  nameKey: TranslationKey;
  priceKey: TranslationKey;
  forKey: TranslationKey;
  featureKeys: TranslationKey[];
  highlighted: boolean;
  showsPeriod: boolean;
}

const PLANS: Plan[] = [
  {
    nameKey: 'LANDING_PLAN_FREE',
    priceKey: 'LANDING_PLAN_FREE_PRICE',
    forKey: 'LANDING_PLAN_FREE_FOR',
    featureKeys: ['LANDING_PLAN_F1', 'LANDING_PLAN_F2', 'LANDING_PLAN_F3'],
    highlighted: false,
    showsPeriod: false,
  },
  {
    nameKey: 'LANDING_PLAN_STARTER',
    priceKey: 'LANDING_PLAN_STARTER_PRICE',
    forKey: 'LANDING_PLAN_STARTER_FOR',
    featureKeys: ['LANDING_PLAN_S1', 'LANDING_PLAN_S2', 'LANDING_PLAN_S3'],
    highlighted: false,
    showsPeriod: true,
  },
  {
    nameKey: 'LANDING_PLAN_BUSINESS',
    priceKey: 'LANDING_PLAN_BUSINESS_PRICE',
    forKey: 'LANDING_PLAN_BUSINESS_FOR',
    featureKeys: ['LANDING_PLAN_B1', 'LANDING_PLAN_B2', 'LANDING_PLAN_B3'],
    highlighted: true,
    showsPeriod: true,
  },
];

const FAQ: { questionKey: TranslationKey; answerKey: TranslationKey }[] = [
  { questionKey: 'LANDING_FAQ_1_Q', answerKey: 'LANDING_FAQ_1_A' },
  { questionKey: 'LANDING_FAQ_2_Q', answerKey: 'LANDING_FAQ_2_A' },
  { questionKey: 'LANDING_FAQ_3_Q', answerKey: 'LANDING_FAQ_3_A' },
  { questionKey: 'LANDING_FAQ_4_Q', answerKey: 'LANDING_FAQ_4_A' },
  { questionKey: 'LANDING_FAQ_5_Q', answerKey: 'LANDING_FAQ_5_A' },
];

const NAV: { href: string; key: TranslationKey }[] = [
  { href: '#how', key: 'LANDING_NAV_HOW' },
  { href: '#features', key: 'LANDING_NAV_FEATURES' },
  { href: '#pricing', key: 'LANDING_NAV_PRICING' },
  { href: '#faq', key: 'LANDING_NAV_FAQ' },
];

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="bg-surface text-foreground min-h-screen">
      <Seo title={t('APP_NAME')} />

      {/* --- Header ------------------------------------------------------ */}
      <header className="border-border/60 bg-surface/80 sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />

          <nav aria-label={t('LABEL_PRIMARY_NAV')} className="hidden md:block">
            <ul className="flex items-center gap-6">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-foreground-muted hover:text-foreground text-sm font-medium transition-colors"
                  >
                    {t(item.key)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">{t('LANDING_SIGN_IN')}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup">{t('LANDING_CTA_PRIMARY')}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Every section between the header and the footer lives in one `main`.
          The landing page used to inherit this landmark from the app shell it
          was wrapped in; owning its own chrome means owning this too, and
          without it axe reports the whole page as content outside any
          landmark. */}
      <main aria-label={t('LABEL_MAIN')}>
        {/* --- Hero ------------------------------------------------------ */}
        <section className="relative isolate overflow-hidden">
          {/* Ambient glow behind the scene. A token-coloured radial wash, so it
            follows the theme instead of being a baked-in image. */}
          <div
            aria-hidden="true"
            className="from-brand-500/18 size-glow pointer-events-none absolute -top-24 -right-24 -z-10 rounded-full bg-radial to-transparent blur-3xl"
          />
          <HeroScene />

          <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
            <div className="max-w-2xl">
              <Badge tone="brand">{t('LANDING_TRUST_TITLE')}</Badge>

              <h1 className="animate-fade-up text-foreground mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                {t('LANDING_HERO_TITLE')}
                <span className="text-brand-500"> — {t('LANDING_HERO_HIGHLIGHT')}</span>
              </h1>

              <p className="animate-fade-up text-foreground-muted mt-6 max-w-xl text-lg">
                {t('LANDING_HERO_SUB')}
              </p>

              <div className="animate-fade-up mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" asChild>
                  <Link to="/signup">
                    {t('LANDING_CTA_PRIMARY')}
                    <Icon name="arrowRight" className="size-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <a href="#how">{t('LANDING_CTA_SECONDARY')}</a>
                </Button>
              </div>

              <p className="text-foreground-subtle mt-5 flex items-center gap-2 text-sm">
                <Icon name="check" className="text-brand-500 size-4" />
                {t('LANDING_HERO_NOTE')}
              </p>
            </div>
          </div>
        </section>

        {/* --- Proof band -------------------------------------------------- */}
        <section className="border-border/60 bg-surface-muted border-y">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
            {PROOF.map((item) => (
              <div key={item.valueKey}>
                <p className="text-foreground text-xl font-semibold tracking-tight">
                  {t(item.valueKey)}
                </p>
                <p className="text-foreground-muted mt-1 text-sm">{t(item.labelKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- How it works, demonstrated ---------------------------------- */}
        <section id="how" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="max-w-2xl">
              <h2 className="text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {t('LANDING_HOW_TITLE')}
              </h2>
              <p className="text-foreground-muted mt-3">{t('LANDING_HOW_SUB')}</p>
            </div>

            <div className="mt-10">
              <OrderFlowDemo />
            </div>

            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {(
                [
                  {
                    icon: 'chat',
                    titleKey: 'LANDING_STEP_1_TITLE',
                    bodyKey: 'LANDING_STEP_1_BODY',
                  },
                  {
                    icon: 'bolt',
                    titleKey: 'LANDING_STEP_2_TITLE',
                    bodyKey: 'LANDING_STEP_2_BODY',
                  },
                  {
                    icon: 'check',
                    titleKey: 'LANDING_STEP_3_TITLE',
                    bodyKey: 'LANDING_STEP_3_BODY',
                  },
                ] as const
              ).map((step, index) => (
                <li
                  key={step.titleKey}
                  className="border-border bg-surface-raised rounded-xl border p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="bg-brand-500/12 text-brand-600 flex size-9 items-center justify-center rounded-lg">
                      <Icon name={step.icon} className="size-4.5" />
                    </span>
                    <span className="text-foreground-subtle text-xs font-semibold tracking-widest">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-foreground mt-4 text-base font-semibold">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-foreground-muted mt-2 text-sm">{t(step.bodyKey)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* --- Why the numbers can be trusted ------------------------------ */}
        <section className="border-border/60 bg-surface-muted border-y">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('LANDING_TRUST_TITLE')}
            </h2>
            <ul className="mt-8 grid gap-6 md:grid-cols-3">
              {TRUST.map((item) => (
                <li key={item.key} className="flex gap-3">
                  <span className="bg-brand-500/12 text-brand-600 flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon name={item.icon} className="size-4.5" />
                  </span>
                  <p className="text-foreground-muted text-sm">{t(item.key)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* --- The product, walked through as a day ---------------------- */}
        <section className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="max-w-2xl">
              <h2 className="text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {t('LANDING_TOUR_TITLE')}
              </h2>
              <p className="text-foreground-muted mt-3">{t('LANDING_TOUR_SUB')}</p>
            </div>

            <div className="mt-10">
              <ProductTour />
            </div>
          </div>
        </section>

        {/* --- Features -------------------------------------------------- */}
        <section id="features" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="max-w-2xl">
              <h2 className="text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {t('LANDING_FEATURES_TITLE')}
              </h2>
              <p className="text-foreground-muted mt-3">{t('LANDING_FEATURES_SUB')}</p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <article
                  key={feature.titleKey}
                  className="border-border bg-surface-raised hover:border-brand-400 group rounded-xl border p-5 transition-colors"
                >
                  <span className="bg-brand-500/12 text-brand-600 group-hover:bg-brand-500 group-hover:text-foreground-inverted flex size-10 items-center justify-center rounded-lg transition-colors">
                    <Icon name={feature.icon} />
                  </span>
                  <h3 className="text-foreground mt-4 text-base font-semibold">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-foreground-muted mt-2 text-sm">{t(feature.bodyKey)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* --- Pricing ----------------------------------------------------- */}
        <section id="pricing" className="border-border/60 bg-surface-muted scroll-mt-20 border-y">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="max-w-2xl">
              <h2 className="text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {t('LANDING_PRICING_TITLE')}
              </h2>
              <p className="text-foreground-muted mt-3">{t('LANDING_PRICING_SUB')}</p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <article
                  key={plan.nameKey}
                  className={`bg-surface-raised relative flex flex-col rounded-2xl border p-6 ${
                    plan.highlighted ? 'border-brand-500 shadow-card' : 'border-border'
                  }`}
                >
                  {plan.highlighted ? (
                    <span className="absolute -top-3 left-6">
                      <Badge tone="brand">{t('LANDING_PLAN_POPULAR')}</Badge>
                    </span>
                  ) : null}

                  <h3 className="text-foreground text-base font-semibold">{t(plan.nameKey)}</h3>
                  <p className="text-foreground-subtle mt-1 text-sm">{t(plan.forKey)}</p>

                  <p className="mt-5 flex items-baseline gap-1">
                    <span className="text-foreground text-3xl font-semibold tracking-tight">
                      {t(plan.priceKey)}
                    </span>
                    {plan.showsPeriod ? (
                      <span className="text-foreground-subtle text-sm">
                        {t('LANDING_PLAN_PER_MONTH')}
                      </span>
                    ) : null}
                  </p>

                  <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                    {plan.featureKeys.map((key) => (
                      <li key={key} className="text-foreground-muted flex gap-2.5 text-sm">
                        <Icon name="check" className="text-brand-500 mt-0.5 size-4" />
                        {t(key)}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="mt-6 w-full"
                    variant={plan.highlighted ? 'primary' : 'secondary'}
                    asChild
                  >
                    <Link to="/signup">{t('LANDING_CTA_PRIMARY')}</Link>
                  </Button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* --- FAQ --------------------------------------------------------- */}
        <section id="faq" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-4 py-20">
            <h2 className="text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {t('LANDING_FAQ_TITLE')}
            </h2>

            {/* Not a <dl>: a description list may only contain dt/dd/div, so a
              <details> inside one is invalid markup. <details> itself is the
              right element here — keyboard- and screen-reader-correct with no
              JavaScript and no accordion library. */}
            <div className="mt-8 flex flex-col gap-3">
              {FAQ.map((item) => (
                <details
                  key={item.questionKey}
                  className="border-border bg-surface-raised group rounded-xl border p-5"
                >
                  <summary className="text-foreground flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
                    {t(item.questionKey)}
                    <Icon
                      name="arrowRight"
                      className="text-foreground-subtle size-4 shrink-0 transition-transform group-open:rotate-90"
                    />
                  </summary>
                  <p className="text-foreground-muted mt-3 text-sm">{t(item.answerKey)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* --- Closing call to action -------------------------------------- */}
        <section className="border-border/60 border-t">
          <div className="relative mx-auto max-w-6xl overflow-hidden px-4 py-20 text-center">
            <div
              aria-hidden="true"
              className="from-brand-500/15 pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-radial to-transparent blur-3xl"
            />
            <h2 className="text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {t('LANDING_CTA_TITLE')}
            </h2>
            <p className="text-foreground-muted mx-auto mt-3 max-w-xl">{t('LANDING_CTA_SUB')}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/signup">
                  {t('LANDING_CTA_PRIMARY')}
                  <Icon name="arrowRight" className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/login">{t('LANDING_SIGN_IN')}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* --- Footer ------------------------------------------------------ */}
      <footer className="border-border/60 bg-surface-muted border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="text-foreground-subtle mt-3 max-w-sm text-sm">
              {t('LANDING_FOOTER_RIGHTS')}
            </p>
          </div>

          <nav aria-label={t('LANDING_FOOTER_PRODUCT')}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-foreground-muted hover:text-foreground text-sm transition-colors"
                  >
                    {t(item.key)}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  to="/login"
                  className="text-foreground-muted hover:text-foreground text-sm transition-colors"
                >
                  {t('LANDING_SIGN_IN')}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>

      {/* Floats over everything. Answers about the product only — it has no
          account and no access to anyone's figures. */}
      <AssistantWidget />
    </div>
  );
}
