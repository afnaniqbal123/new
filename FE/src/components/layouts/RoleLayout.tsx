import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from 'src/components/common/Button';
import { ThemeToggle } from 'src/components/common/ThemeToggle';
import { Icon } from 'src/components/common/Icon';
import { Logo } from 'src/components/common/Logo';
import { useAuthStore } from 'src/stores/authStore';
import { useLogout } from 'src/hooks/auth/useAuth';
import {
  getNavItemsForRole,
  getRoleLayout,
  type NavItem,
  type RoleLayoutVariant,
} from 'src/routes/ProtectedRoutes';
import type { TranslationKey } from 'src/i18n';

interface SidebarShellProps {
  titleKey: TranslationKey;
  navItems: NavItem[];
}

/** The one shell design that exists today (`variant: 'sidebar'`). */
function SidebarShell({ titleKey, navItems }: SidebarShellProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const { t } = useTranslation();

  return (
    <div className="bg-surface text-foreground flex min-h-screen">
      <aside className="border-border bg-surface-muted w-56 shrink-0 border-r">
        {/* The monogram carries the product; the line under it says which role
            you are signed in as. Pairing the mark directly with the role read
            as though the product itself were called "Owner". */}
        <div className="border-border flex items-center gap-2.5 border-b px-4 py-3">
          <Logo showName={false} markClassName="size-8" />
          <span className="min-w-0">
            <span className="text-foreground block truncate text-sm font-semibold">
              {t('APP_NAME')}
            </span>
            <span className="text-foreground-subtle block truncate text-xs">{t(titleKey)}</span>
          </span>
        </div>
        <nav aria-label={t('LABEL_SIDEBAR_NAV')} className="p-2">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  // NavLink's own `end` prop type doesn't accept `undefined`
                  // explicitly; `false` is its own default for "unset" anyway.
                  end={item.end ?? false}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-surface text-brand-600'
                        : 'text-foreground-muted hover:bg-surface hover:text-foreground'
                    }`
                  }
                >
                  {/* Decorative: the label beside it is the accessible name. */}
                  <Icon name={item.icon} className="size-4.5" />
                  {t(item.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="border-border flex items-center justify-end gap-4 border-b px-6 py-3">
          {user ? <span className="text-foreground-muted text-sm">{user.email}</span> : null}
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              logout.mutate(undefined, {
                onSuccess: () => {
                  void navigate('/login', { replace: true });
                },
              });
            }}
          >
            {t('NAV_SIGN_OUT')}
          </Button>
        </header>
        <main aria-label={t('LABEL_MAIN')} className="flex-1 px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * One entry per `RoleLayoutVariant` — a real TypeScript `Record`, same
 * exhaustiveness mechanism `ProtectedRoutes.tsx`'s own `ROLE_LAYOUT: Record<Role,
 * RoleLayoutConfig>` already relies on: if `RoleLayoutVariant` ever gains a
 * second member without a matching entry here, this object literal is a
 * compile-time `tsc -b` error, not a silently-wrong render. A `switch`/`case`
 * over a currently-single-member union would trip
 * `@typescript-eslint/no-unnecessary-condition` (the `'sidebar'` comparison is
 * genuinely always-true today) — this sidesteps that without weakening the
 * guarantee, since a `Record` doesn't need a runtime comparison to be exhaustive.
 */
const SHELL_BY_VARIANT: Record<RoleLayoutVariant, (props: SidebarShellProps) => ReactNode> = {
  sidebar: SidebarShell,
};

/**
 * Renders the right shell for the current user's role — reads
 * `src/routes/ProtectedRoutes.tsx`'s `getRoleLayout(role)` for which `variant`
 * to use and `getNavItemsForRole(role)` for its nav items (own + common
 * routes), so two roles sharing a `variant` (both example roles do today) get
 * the identical shell for free, and a role that needs a visually different
 * area just needs a new `variant` value + an entry in `SHELL_BY_VARIANT` above
 * — no router or guard code changes. Wired into `AppRouters.tsx`'s protected
 * route group, where `RoleGuards` guarantees `user` exists by the time this
 * renders.
 */
export function RoleLayout() {
  const role = useAuthStore((state) => state.user?.role);
  const layout = getRoleLayout(role);
  const navItems = getNavItemsForRole(role);

  const Shell = SHELL_BY_VARIANT[layout.variant];
  return <Shell titleKey={layout.titleKey} navItems={navItems} />;
}
