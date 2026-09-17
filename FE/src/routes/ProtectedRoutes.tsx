import { lazy, type ComponentType } from 'react';
import type { TranslationKey } from 'src/i18n';
import type { IconName } from 'src/components/common/Icon';
import { isRole, Role } from 'src/routes/roles';

/**
 * The single registry of every protected page: which roles may reach it, and
 * its sidebar entry if it has one.
 *
 * Read by two places. `AppRouters.tsx` generates every protected `<Route>`
 * from `PROTECTED_ROUTES`, wrapping each in `RoleGuards` with that route's own
 * `roles`; `RoleLayout` calls `getNavItemsForRole`/`getRoleLayout` for the
 * signed-in user's sidebar and shell.
 *
 * ## How access is decided here
 *
 * The `roles` list on each route mirrors the backend's CASL policy for the
 * same resource — but it is **not** the enforcement. The API refuses a
 * request the caller may not make regardless of what this file says. What
 * this buys is that a cashier does not see a Purchasing link that would only
 * 403 when clicked, which is the difference between a product that feels
 * tailored and one that feels broken.
 *
 * Adding a role touches exactly three files: `roles.ts`, this one, and the
 * role's own pages.
 */
export interface ProtectedRoute {
  /** Absolute path, e.g. '/pos'. */
  path: string;
  Component: ComponentType;
  /** Roles that may reach this route; 'all' = every authenticated role. */
  roles: readonly Role[] | 'all';
  /** Present only for a route that belongs in the sidebar. */
  nav?: {
    labelKey: TranslationKey;
    /** The sidebar glyph. Decorative — the label beside it is what is read. */
    icon: IconName;
    /** Passed to `NavLink`'s `end` — exact-match highlighting. */
    end?: boolean;
    /** Groups the sidebar. Routes without one sit in the first group. */
    group?: 'sell' | 'stock' | 'money' | 'grow' | 'admin';
  };
}

// Lazy per page — every route is code-split (AGENTS.md § Performance Budget).
// AppRouters.tsx wraps each in <Suspense>.
const DashboardPage = lazy(() =>
  import('src/pages/common/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  }))
);
const PosPage = lazy(() =>
  import('src/pages/common/PosPage').then((m) => ({ default: m.PosPage }))
);
const SalesPage = lazy(() =>
  import('src/pages/common/SalesPage').then((m) => ({ default: m.SalesPage }))
);
const SaleDetailPage = lazy(() =>
  import('src/pages/common/SaleDetailPage').then((m) => ({
    default: m.SaleDetailPage,
  }))
);
const ProductsPage = lazy(() =>
  import('src/pages/common/ProductsPage').then((m) => ({
    default: m.ProductsPage,
  }))
);
const InventoryPage = lazy(() =>
  import('src/pages/common/InventoryPage').then((m) => ({
    default: m.InventoryPage,
  }))
);
const CustomersPage = lazy(() =>
  import('src/pages/common/CustomersPage').then((m) => ({
    default: m.CustomersPage,
  }))
);
const CustomerDetailPage = lazy(() =>
  import('src/pages/common/CustomerDetailPage').then((m) => ({
    default: m.CustomerDetailPage,
  }))
);
const SuppliersPage = lazy(() =>
  import('src/pages/common/SuppliersPage').then((m) => ({
    default: m.SuppliersPage,
  }))
);
const PurchasingPage = lazy(() =>
  import('src/pages/common/PurchasingPage').then((m) => ({
    default: m.PurchasingPage,
  }))
);
const ReportsPage = lazy(() =>
  import('src/pages/common/ReportsPage').then((m) => ({
    default: m.ReportsPage,
  }))
);
const WhatsAppPage = lazy(() =>
  import('src/pages/common/WhatsAppPage').then((m) => ({
    default: m.WhatsAppPage,
  }))
);
const ClerkPage = lazy(() =>
  import('src/pages/common/ClerkPage').then((m) => ({ default: m.ClerkPage }))
);
const SettingsPage = lazy(() =>
  import('src/pages/common/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  }))
);
const TeamPage = lazy(() =>
  import('src/pages/common/TeamPage').then((m) => ({ default: m.TeamPage }))
);
const BillingPage = lazy(() =>
  import('src/pages/common/BillingPage').then((m) => ({
    default: m.BillingPage,
  }))
);
const ProfilePage = lazy(() =>
  import('src/pages/common/ProfilePage').then((m) => ({
    default: m.ProfilePage,
  }))
);
const NotificationsPage = lazy(() =>
  import('src/pages/common/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  }))
);

/** Everyone who works the counter or above. */
const SELLS = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CASHIER] as const;

/** Roles that run the business rather than the till. */
const RUNS = [Role.OWNER, Role.ADMIN, Role.MANAGER] as const;

/** Roles with a financial remit. */
const MONEY = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] as const;

export const PROTECTED_ROUTES: readonly ProtectedRoute[] = [
  {
    path: '/dashboard',
    Component: DashboardPage,
    roles: 'all',
    nav: { labelKey: 'NAV_DASHBOARD', icon: 'dashboard', end: true },
  },

  // --- Selling ----------------------------------------------------------
  {
    path: '/pos',
    Component: PosPage,
    // An accountant does not ring up sales, and a viewer reads only.
    roles: SELLS,
    nav: { labelKey: 'NAV_POS', icon: 'cart', group: 'sell' },
  },
  {
    path: '/sales',
    Component: SalesPage,
    roles: 'all',
    nav: { labelKey: 'NAV_SALES', icon: 'receipt', group: 'sell' },
  },
  { path: '/sales/:id', Component: SaleDetailPage, roles: 'all' },
  {
    path: '/whatsapp',
    Component: WhatsAppPage,
    roles: 'all',
    nav: { labelKey: 'NAV_WHATSAPP', icon: 'chat', group: 'sell' },
  },

  // --- Stock ------------------------------------------------------------
  {
    path: '/products',
    Component: ProductsPage,
    roles: 'all',
    nav: { labelKey: 'NAV_PRODUCTS', icon: 'box', group: 'stock' },
  },
  {
    path: '/inventory',
    Component: InventoryPage,
    roles: 'all',
    nav: { labelKey: 'NAV_INVENTORY', icon: 'layers', group: 'stock' },
  },
  {
    path: '/purchasing',
    Component: PurchasingPage,
    // A cashier never sees purchase cost — that is the whole point of the
    // backend's purchasing policy, mirrored here so the link is not offered.
    roles: MONEY,
    nav: { labelKey: 'NAV_PURCHASING', icon: 'truck', group: 'stock' },
  },

  // --- Money ------------------------------------------------------------
  {
    path: '/customers',
    Component: CustomersPage,
    roles: 'all',
    nav: { labelKey: 'NAV_CUSTOMERS', icon: 'users', group: 'money' },
  },
  { path: '/customers/:id', Component: CustomerDetailPage, roles: 'all' },
  {
    path: '/suppliers',
    Component: SuppliersPage,
    roles: MONEY,
    nav: { labelKey: 'NAV_SUPPLIERS', icon: 'building', group: 'money' },
  },
  {
    path: '/reports',
    Component: ReportsPage,
    roles: 'all',
    nav: { labelKey: 'NAV_REPORTS', icon: 'chart', group: 'money' },
  },

  // --- Grow -------------------------------------------------------------
  {
    path: '/clerk',
    Component: ClerkPage,
    roles: 'all',
    nav: { labelKey: 'NAV_CLERK', icon: 'sparkles', group: 'grow' },
  },

  // --- Admin ------------------------------------------------------------
  {
    path: '/team',
    Component: TeamPage,
    roles: RUNS,
    nav: { labelKey: 'NAV_TEAM', icon: 'shield', group: 'admin' },
  },
  {
    path: '/billing',
    Component: BillingPage,
    // Committing the business to a recurring charge is the owner's alone;
    // an admin and the accountant may read it.
    roles: [Role.OWNER, Role.ADMIN, Role.ACCOUNTANT],
    nav: { labelKey: 'NAV_BILLING', icon: 'card', group: 'admin' },
  },
  {
    path: '/settings',
    Component: SettingsPage,
    roles: 'all',
    nav: { labelKey: 'NAV_SETTINGS', icon: 'settings', group: 'admin' },
  },
  { path: '/profile', Component: ProfilePage, roles: 'all' },
  { path: '/notifications', Component: NotificationsPage, roles: 'all' },
];

export type RoleLayoutVariant = 'sidebar';

export interface RoleLayoutConfig {
  variant: RoleLayoutVariant;
  titleKey: TranslationKey;
}

/**
 * The shell each role gets.
 *
 * Every role currently shares the sidebar shell — the *contents* differ (see
 * `getNavItemsForRole`), not the chrome. Kept as a per-role map anyway so a
 * genuinely different shell (a kiosk-mode cashier view, say) is a change here
 * rather than a change to the layout component.
 */
export const ROLE_LAYOUT: Record<Role, RoleLayoutConfig> = {
  [Role.OWNER]: { variant: 'sidebar', titleKey: 'ROLE_OWNER' },
  [Role.ADMIN]: { variant: 'sidebar', titleKey: 'ROLE_ADMIN' },
  [Role.MANAGER]: { variant: 'sidebar', titleKey: 'ROLE_MANAGER' },
  [Role.CASHIER]: { variant: 'sidebar', titleKey: 'ROLE_CASHIER' },
  [Role.ACCOUNTANT]: { variant: 'sidebar', titleKey: 'ROLE_ACCOUNTANT' },
  [Role.VIEWER]: { variant: 'sidebar', titleKey: 'ROLE_VIEWER' },
};

/**
 * The shell for a role.
 *
 * Falls back to the viewer's shell for an unrecognised role — read-only
 * chrome is the safe default when the frontend does not know who this is.
 */
export function getRoleLayout(role: string | undefined): RoleLayoutConfig {
  const narrowed = asRole(role);

  return ROLE_LAYOUT[narrowed ?? Role.VIEWER];
}

/** Whether a role may reach a given route. */
function roleCanReach(route: ProtectedRoute, role: Role): boolean {
  return route.roles === 'all' || route.roles.includes(role);
}

export type NavGroup = NonNullable<NonNullable<ProtectedRoute['nav']>['group']>;

export interface NavItem {
  /** Named `to` to match what `NavLink` consumes directly. */
  to: string;
  labelKey: TranslationKey;
  icon: IconName;
  // `| undefined` explicitly: `exactOptionalPropertyTypes` treats an absent
  // key and a present-but-undefined one as different, and these are built by
  // reading an optional field straight off the route entry.
  end?: boolean | undefined;
  group?: NavGroup | undefined;
}

/**
 * Roles arrive as plain strings — off a JWT claim or an API payload — so
 * every function here takes `string` and narrows internally.
 *
 * An unrecognised value yields no nav items rather than throwing: a user whose
 * role the frontend does not know should see an empty, honest shell, not a
 * white screen.
 */
function asRole(role: string | undefined): Role | null {
  return role !== undefined && isRole(role) ? role : null;
}

/** The sidebar entries a role should see, in registry order. */
export function getNavItemsForRole(role: string | undefined): NavItem[] {
  const narrowed = asRole(role);

  if (!narrowed) return [];

  return PROTECTED_ROUTES.filter((route) => route.nav && roleCanReach(route, narrowed)).map(
    (route) => ({
      to: route.path,
      labelKey: (route.nav as NonNullable<ProtectedRoute['nav']>).labelKey,
      icon: (route.nav as NonNullable<ProtectedRoute['nav']>).icon,
      end: route.nav?.end,
      group: route.nav?.group,
    })
  );
}

/**
 * Where a role lands after signing in.
 *
 * Everyone lands on the dashboard — unlike a multi-portal product, every role
 * works on the same business, and the dashboard filters itself to what the
 * role may see rather than being replaced wholesale.
 */
export function getHomeRouteForRole(role: string | undefined): string {
  return getNavItemsForRole(role)[0]?.to ?? '/dashboard';
}

/** Whether a role has any nav-eligible route at all. */
export function hasHomeRouteForRole(role: string | undefined): boolean {
  return getNavItemsForRole(role).length > 0;
}
