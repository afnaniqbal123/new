import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from 'src/stores/authStore';
import type { Role } from 'src/routes/roles';

interface RoleGuardsProps {
  /** Roles allowed to reach this route; 'all' = every authenticated role. */
  roles: readonly Role[] | 'all';
  component: ReactNode;
}

/**
 * The auth + role gate applied to every entry in `PROTECTED_ROUTES`
 * (src/routes/ProtectedRoutes.tsx) — `AppRouters.tsx` wraps each route's
 * element in this, passing that route's own `roles` straight through, so a
 * role can never reach another role's route unless it's explicitly marked
 * common (`roles: 'all'`). Not authenticated → `/login` (preserving where the
 * user was headed via `state.from`); authenticated but wrong role → `/403`;
 * otherwise renders `component`. Waits for zustand/persist's async
 * rehydration (`hasHydrated`) before deciding — without this, a hard refresh
 * briefly reads `user: null` even for a logged-in session and would bounce
 * the user to `/login` for one tick.
 */
export function RoleGuards({ roles, component }: RoleGuardsProps) {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const location = useLocation();

  if (!hasHydrated) return null;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  // user.role is an unvalidated string from the backend (AuthUser.role in
  // src/types/index.ts) — cast to compare against the closed `Role` set, same
  // boundary pattern as roles.ts's own `isRole`.
  if (roles !== 'all' && !roles.some((allowed) => allowed === (user.role as Role))) {
    return <Navigate to="/403" replace />;
  }
  return <>{component}</>;
}
