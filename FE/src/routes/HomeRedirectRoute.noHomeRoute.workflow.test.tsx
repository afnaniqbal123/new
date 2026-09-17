import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from 'src/test/renderWithProviders';
import { useAuthStore } from 'src/stores/authStore';
import { HomeRedirectRoute } from './HomeRedirectRoute';

/**
 * Isolated in its own file (rather than a third case in
 * HomeRedirectRoute.workflow.test.tsx) because this edge case cannot be
 * reached through the real route registry: COMMON_PROTECTED_ROUTES always
 * ships at least one nav-eligible `roles: 'all'` route (e.g. /profile), which
 * `isRouteAllowedForRole` matches for every role unconditionally — so any
 * signed-in user, even one whose role has zero role-specific routes, already
 * has a home route today. The only way to exercise the genuinely-unconfigured
 * fallback UI is to mock `hasHomeRouteForRole` itself, standing in for a
 * project that has gutted its common routes too (or is mid-build before
 * adding any).
 */
vi.mock('src/routes/ProtectedRoutes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ProtectedRoutes')>();
  return {
    ...actual,
    hasHomeRouteForRole: () => false,
  };
});

function renderAtRoot() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<HomeRedirectRoute />} />
    </Routes>
  );
}

describe('HomeRedirectRoute workflow — unconfigured-role fallback', () => {
  afterEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      hasHydrated: true,
    });
  });

  it('shows a dev-facing message instead of silently bouncing to /login when the signed-in role has no route configured', () => {
    useAuthStore.setState({
      user: {
        _id: '2',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        role: 'UNCONFIGURED_ROLE',
        status: 'active',
      },
      // "/" now decides on the token, not on the user object: a signed-out
      // visitor gets the marketing page, so the signed-in branch has to be
      // reached the same way the real app reaches it.
      accessToken: 'token',
      hasHydrated: true,
    });

    renderAtRoot();

    expect(
      screen.getByRole('heading', { name: 'No home page configured for this role yet' })
    ).toBeInTheDocument();
    expect(screen.getByText('UNCONFIGURED_ROLE')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});
