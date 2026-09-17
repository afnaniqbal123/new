import type { ReactNode } from 'react';
import { useAuthStore } from 'src/stores/authStore';
import { Role } from 'src/routes/roles';

interface CanProps {
  /** Roles that may see `children`. */
  allowedRoles: readonly Role[];
  children: ReactNode;
  /** Rendered instead when the current user's role isn't in `allowedRoles`. */
  fallback?: ReactNode;
}

/**
 * Inline UI-level permission gate — complements the route-level `RoleGuards`
 * guard (`src/routes/RoleGuards.tsx`) for hiding/showing a piece of UI *within*
 * an already-rendered page, rather than blocking the whole route.
 */
export function Can({ allowedRoles, children, fallback = null }: CanProps) {
  const role = useAuthStore((state) => state.user?.role);
  // `role` is an unvalidated string from the backend/auth store (see AuthUser.role
  // in src/types/auth/index.ts) — the cast mirrors roles.ts's own `isRole` type
  // guard, comparing it against the closed `Role` set without widening
  // `allowedRoles`' own element type to `string` (AGENTS.md § Constant Registries).
  if (!role || !allowedRoles.includes(role as Role)) return <>{fallback}</>;
  return <>{children}</>;
}
