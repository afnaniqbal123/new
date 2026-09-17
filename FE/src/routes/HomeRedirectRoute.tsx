import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from 'src/stores/authStore';
import { Seo } from 'src/components/common/Seo';
import { getHomeRouteForRole, hasHomeRouteForRole } from 'src/routes/ProtectedRoutes';

/**
 * The marketing page, lazily loaded.
 *
 * Lazy specifically because it carries the three.js scene. A signed-in user
 * never renders this component, so they never download that chunk — which is
 * what keeps the app's entry bundle unaffected by the landing page's weight
 * (AGENTS.md § Performance Budget, CONTEXT.md D15).
 */
const LandingPage = lazy(() =>
  import('src/pages/common/LandingPage').then((m) => ({
    default: m.LandingPage,
  }))
);

/**
 * The signed-in-only half of `HomeRedirectRoute` below — reads the role and
 * decides between an instant redirect to its home route and the dev-facing
 * fallback message. Split out so `AuthenticatedRoute` owns the "not signed in"
 * branch entirely (see `HomeRedirectRoute`) rather than this file re-deciding
 * that too.
 */
function SignedInHomeRedirect() {
  const role = useAuthStore((state) => state.user?.role);
  const { t } = useTranslation();

  if (role !== undefined && hasHomeRouteForRole(role)) {
    return <Navigate to={getHomeRouteForRole(role)} replace />;
  }

  // Genuinely-unconfigured-role state — signed in, but ProtectedRoutes.tsx has
  // no nav-eligible route for this role yet. Rare in a fully-built-out project
  // (every shipped role has one), but common mid-build if auth gets wired up
  // before roles/dashboards do — surfacing this clearly instead of silently
  // bouncing to /login (which used to be `getHomeRouteForRole`'s own fallback
  // for this exact case) is the whole point of this component existing.
  return (
    <section aria-labelledby="no-home-route-heading" className="flex flex-col gap-2">
      <Seo title={t('NO_HOME_ROUTE_TITLE')} />
      <h1 id="no-home-route-heading" className="text-foreground text-2xl font-semibold">
        {t('NO_HOME_ROUTE_TITLE')}
      </h1>
      <p role="alert" className="text-foreground-muted max-w-prose">
        {t('NO_HOME_ROUTE_BODY')}
      </p>
      <p className="text-foreground-muted text-sm">
        {t('NO_HOME_ROUTE_SIGNED_IN_AS')} <code className="font-mono">{role}</code>
      </p>
    </section>
  );
}

/**
 * What "/" renders.
 *
 * Two different things, deliberately:
 *
 * - **Signed out** → the marketing landing page. This is a product people
 *   have to be sold before they sign up, so the front door is a pitch, not a
 *   login form. (The boilerplate redirected to `/login` here, which is right
 *   for an internal tool and wrong for a SaaS.)
 * - **Signed in** → straight to their role's home route, with no flash of
 *   marketing in between.
 *
 * `hasHydrated` is waited on before deciding, because zustand/persist reads
 * localStorage asynchronously — deciding before it lands would show the
 * landing page to a signed-in user for a frame on every reload.
 */
export function HomeRedirectRoute() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => Boolean(state.accessToken));

  if (!hasHydrated) {
    return null;
  }

  if (isAuthenticated) {
    return <SignedInHomeRedirect />;
  }

  return (
    <Suspense fallback={null}>
      <LandingPage />
    </Suspense>
  );
}
