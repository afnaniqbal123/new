import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from 'src/test/renderWithProviders';
import { useAuthStore } from 'src/stores/authStore';
import { Role } from 'src/routes/roles';
import { AuthRedirectRoute } from './AuthRedirectRoute';

function DashboardSentinel() {
  return <p>Dashboard</p>;
}

function LoginFormSentinel() {
  return <h2>Sign in</h2>;
}

function renderLoginRoute() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<AuthRedirectRoute component={<LoginFormSentinel />} />} />
      <Route path="/dashboard" element={<DashboardSentinel />} />
    </Routes>
  );
}

/**
 * Workflow test for the guest-only auth screens' own guard: a signed-in
 * visitor is bounced off /login (never sees the login form again); a
 * signed-out visitor sees it normally. See HomeRedirectRoute.workflow.test.tsx
 * for the mirror-image "/" behavior.
 */
describe('AuthRedirectRoute workflow', () => {
  afterEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      hasHydrated: true,
    });
  });

  it('shows the login form normally for a signed-out visitor', () => {
    useAuthStore.setState({ user: null, hasHydrated: true });

    renderLoginRoute();

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it("bounces an already-signed-in visitor straight to their role's home route instead of showing the login form again", () => {
    useAuthStore.setState({
      user: {
        _id: '1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        role: Role.CASHIER,
        status: 'active',
      },
      hasHydrated: true,
    });

    renderLoginRoute();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});
