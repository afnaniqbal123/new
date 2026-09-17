import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from 'src/test/renderWithProviders';
import { useAuthStore } from 'src/stores/authStore';
import { Role } from 'src/routes/roles';
import { HomeRedirectRoute } from './HomeRedirectRoute';

function DashboardSentinel() {
  return <p>Dashboard</p>;
}

function renderAtRoot() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<HomeRedirectRoute />} />
      <Route path="/dashboard" element={<DashboardSentinel />} />
    </Routes>
  );
}

/**
 * What "/" does, which differs from the boilerplate's behaviour deliberately.
 *
 * BusinessOS is a product people have to be sold before they sign up, so the
 * front door for a signed-out visitor is the marketing page — not a login
 * form. A signed-in visitor never sees it and goes straight to work.
 *
 * The landing page is lazily loaded (it carries the three.js scene), so the
 * signed-out assertion is about *not redirecting* rather than about the
 * marketing copy — asserting on the copy would make this a test of a chunk
 * loader's timing rather than of the routing decision.
 */
describe('HomeRedirectRoute workflow', () => {
  afterEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      hasHydrated: true,
    });
  });

  it('keeps a signed-out visitor on "/" rather than bouncing them to a login form', () => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      hasHydrated: true,
    });

    renderAtRoot();

    // Not redirected into the app.
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it("sends a signed-in visitor straight to their role's home route", () => {
    useAuthStore.setState({
      user: {
        _id: '1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        role: Role.CASHIER,
        status: 'active',
      },
      accessToken: 'token',
      hasHydrated: true,
    });

    renderAtRoot();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('decides nothing until the persisted session has been read back', () => {
    // zustand/persist reads localStorage asynchronously. Deciding before it
    // lands would flash the marketing page at a signed-in user on every
    // reload — so nothing renders until `hasHydrated` is true.
    useAuthStore.setState({
      user: {
        _id: '1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        role: Role.CASHIER,
        status: 'active',
      },
      accessToken: 'token',
      hasHydrated: false,
    });

    renderAtRoot();

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});
