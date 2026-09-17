import { useTranslation } from 'react-i18next';
import { Icon } from 'src/components/common/Icon';
import { ENV } from 'src/constants/env';
import { ROLE_LABEL } from 'src/constants/labels';
import { Role } from 'src/routes/roles';

interface DemoAccountsProps {
  /** Fills the sign-in form with the chosen account. */
  onPick: (credentials: { email: string; password: string }) => void;
}

/**
 * One-click sign-in for the seeded demo team.
 *
 * ## Why this exists
 *
 * The single most convincing thing about this product is that the same screen
 * shows a different product to each role — a cashier has no margin anywhere in
 * their payload. Demonstrating that means signing in and out six times, and
 * anything that makes a reviewer retype an address six times gets checked
 * once and not again.
 *
 * ## Why it cannot reach production
 *
 * It renders only under `import.meta.env.DEV`, which Vite replaces with the
 * literal `false` in a production build — so the whole component, and the
 * addresses in it, are removed by dead-code elimination rather than merely
 * hidden. It fills the form instead of submitting, so the password is still
 * something a person consciously sends.
 *
 * The accounts themselves only exist if `BE/pnpm seed:demo` has been run, and
 * the emails match that script's own `TEAM` list.
 */
const DEMO_PASSWORD = 'BusinessOS!2026';

const ROLES: readonly Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.CASHIER,
  Role.ACCOUNTANT,
  Role.VIEWER,
];

/**
 * Built from `VITE_DEMO_EMAIL_PATTERN`, because a seed pointed at a real
 * mailbox spells these differently — see that variable's note in
 * `src/constants/env.ts`.
 */
function emailFor(role: Role): string {
  return ENV.VITE_DEMO_EMAIL_PATTERN.replace('{role}', role.toLowerCase());
}

export function DemoAccounts({ onPick }: DemoAccountsProps) {
  const { t } = useTranslation();

  if (!import.meta.env.DEV) return null;

  return (
    <div className="border-border mt-6 border-t pt-5">
      <p className="text-foreground-subtle flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        <Icon name="bolt" className="size-3.5" />
        {t('AUTH_DEMO_TITLE')}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {ROLES.map((role) => {
          const labelKey = ROLE_LABEL[role];

          return (
            <button
              key={role}
              type="button"
              onClick={() => {
                onPick({ email: emailFor(role), password: DEMO_PASSWORD });
              }}
              className="border-border bg-surface-muted text-foreground-muted hover:border-brand-500 hover:text-brand-600 min-h-11 rounded-lg border px-2 py-2 text-xs font-medium transition-colors"
            >
              {labelKey ? t(labelKey) : role}
            </button>
          );
        })}
      </div>

      <p className="text-foreground-subtle mt-3 text-xs">{t('AUTH_DEMO_HINT')}</p>
    </div>
  );
}
