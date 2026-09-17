import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from 'src/stores/authStore';
import { getHomeRouteForRole } from 'src/routes/ProtectedRoutes';

interface AuthRedirectRouteProps {
  /** The public page to render for a signed-out visitor. */
  component: ReactNode;
}

/**
 * Keeps an already-authenticated user off the public auth screens (login,
 * signup, forgot-password, the OTP-verify pages, reset-password) — sends them
 * to their own role's home route instead of a fixed default (see
 * `getHomeRouteForRole` in `src/routes/ProtectedRoutes.tsx`), so an admin
 * hitting `/login` while authenticated lands on `/admin/dashboard`, not a
 * route `RoleGuards` would immediately bounce them back out of. Waits for
 * zustand/persist's async rehydration (`hasHydrated`) first — see
 * `RoleGuards.tsx` for why that matters. Wraps the `AuthLayout` route group in
 * `AppRouters.tsx`.
 */
export function AuthRedirectRoute({ component }: AuthRedirectRouteProps) {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  if (!hasHydrated) return null;
  if (user) {
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }
  return <>{component}</>;
}
