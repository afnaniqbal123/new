import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from 'src/stores/authStore';

interface AuthenticatedRouteProps {
  children: ReactNode;
  /** Where to send an unauthenticated user. */
  redirectTo?: string;
}

/**
 * Auth-only gate (no role check). Two uses:
 * 1. In `AppRouters.tsx`, wraps `RoleLayout` itself around the whole protected
 *    route group — so an unauthenticated visitor deep-linking a protected URL
 *    never sees a flash of the shell's chrome (sidebar, sign-out button)
 *    before being redirected. Each individual route inside is still
 *    role-checked by `RoleGuards` (src/routes/RoleGuards.tsx).
 * 2. Standalone, for a one-off route deliberately kept outside
 *    `PROTECTED_ROUTES` (src/routes/ProtectedRoutes.tsx) that still needs an
 *    auth check but isn't going through the normal registry.
 * Waits for zustand/persist's async rehydration (`hasHydrated`) before
 * deciding — see `RoleGuards.tsx` for why.
 */
export function AuthenticatedRoute({ children, redirectTo = '/login' }: AuthenticatedRouteProps) {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const location = useLocation();

  if (!hasHydrated) return null;
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
