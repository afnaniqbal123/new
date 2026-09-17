import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from 'src/components/common/ThemeToggle';
import { Icon, type IconName } from 'src/components/common/Icon';
import { Logo } from 'src/components/common/Logo';
import type { TranslationKey } from 'src/i18n';

const PITCH: { icon: IconName; titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  { icon: 'chat', titleKey: 'AUTH_PITCH_1_TITLE', bodyKey: 'AUTH_PITCH_1_BODY' },
  { icon: 'layers', titleKey: 'AUTH_PITCH_2_TITLE', bodyKey: 'AUTH_PITCH_2_BODY' },
  { icon: 'shield', titleKey: 'AUTH_PITCH_3_TITLE', bodyKey: 'AUTH_PITCH_3_BODY' },
];

/**
 * The shell every signed-out screen sits in.
 *
 * ## Why it is a split rather than a centred card
 *
 * The previous version was a 24rem box floating in an empty viewport — the
 * shape a framework gives you before anyone has designed anything, and it read
 * that way. Signing in is the moment a visitor decides whether this product is
 * serious, so the left half carries the argument (what it does, why the
 * numbers hold) while the right half does the job.
 *
 * The brand panel is **display-only and hidden below `lg`**: on a phone it
 * would push the actual form below the fold, which is the opposite of useful.
 *
 * ## Weight
 *
 * Deliberately CSS-only — no canvas, no images. These routes are lazy-loaded
 * but they are also the first thing a returning user hits every morning, so
 * the panel is a gradient and a grid built from a repeating linear-gradient,
 * costing nothing over the wire.
 */
export function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="bg-surface text-foreground grid min-h-screen lg:grid-cols-2">
      {/* --- Brand panel (lg and up) --- */}
      <aside className="bg-brand-950 relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="bg-grid-faint pointer-events-none absolute inset-0 opacity-40"
        />
        <div
          aria-hidden="true"
          className="from-brand-500/25 size-glow pointer-events-none absolute -top-32 -right-32 rounded-full bg-radial to-transparent blur-3xl"
        />
        <div
          aria-hidden="true"
          className="from-accent-500/15 size-glow pointer-events-none absolute -bottom-40 -left-24 rounded-full bg-radial to-transparent blur-3xl"
        />

        <Link to="/" className="relative flex items-center gap-2.5">
          <Logo showName={false} />
          <span className="text-lg font-semibold tracking-tight text-white">{t('APP_NAME')}</span>
        </Link>

        <div className="relative max-w-md">
          {/* Deliberately a <p>, not a heading: this panel is decoration
              beside the form, and a heading here would sit before the page's
              own <h1> in the document order. */}
          <p className="text-3xl font-semibold tracking-tight text-balance text-white">
            {t('AUTH_PANEL_TITLE')}
          </p>
          <ul className="mt-10 flex flex-col gap-6">
            {PITCH.map((item) => (
              <li key={item.titleKey} className="flex gap-4">
                <span className="bg-brand-500/15 text-brand-300 flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon name={item.icon} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{t(item.titleKey)}</span>
                  <span className="text-brand-100/70 mt-1 block text-sm">{t(item.bodyKey)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-brand-100/50 relative text-xs">{t('LANDING_FOOTER_RIGHTS')}</p>
      </aside>

      {/* --- Form side --- */}
      <div className="relative flex flex-col px-4 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="lg:invisible">
            <Logo markClassName="size-8" />
          </Link>
          <ThemeToggle />
        </div>

        <main
          aria-label={t('LABEL_MAIN')}
          className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
