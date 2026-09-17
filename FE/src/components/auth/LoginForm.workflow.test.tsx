import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from 'src/test/renderWithProviders';
import { useAuthStore } from 'src/stores/authStore';
import { LoginForm } from './LoginForm';

/** Stand-in for the real member dashboard — proves role-aware navigation via
 * getHomeRouteForRole, not the dashboard page itself (out of this workflow's scope). */
function DashboardSentinel() {
  return <p>Dashboard</p>;
}

function renderLoginFlow() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<LoginForm />} />
      <Route path="/dashboard" element={<DashboardSentinel />} />
    </Routes>
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>, password: string) {
  await user.type(screen.getByLabelText('Email'), 'ada@example.com');
  await user.type(screen.getByLabelText('Password'), password);
}

/**
 * Workflow test: the full login flow (validation → submit → success/error),
 * through the real MSW-backed network layer. See AGENTS.md § Testing for why
 * this repo tests at this level rather than unit-testing individual primitives.
 * LoginForm's `useLogin` hook (src/hooks/auth/useAuth.ts) sets the session on
 * the shared `authStore` directly, so state is reset here between tests —
 * same reason `api-client.test.ts` does this.
 */
describe('LoginForm workflow', () => {
  afterEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup();
    renderLoginFlow();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Please enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('This value is too short')).toBeInTheDocument();
  });

  it('logs in successfully and navigates to the role home route', async () => {
    const user = userEvent.setup();
    renderLoginFlow();

    await fillValidForm(user, 'Sup3rSecret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('shows the server error for invalid credentials', async () => {
    const user = userEvent.setup();
    renderLoginFlow();

    // 'wrongpassword' is the reserved password handlers.ts uses for this.
    await fillValidForm(user, 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });
});
