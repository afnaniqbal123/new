import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from 'src/services/queryClient';
import { useAuthStore } from 'src/stores/authStore';
import { VerifySignupOtpPage } from 'src/pages/auth/VerifySignupOtpPage';

/**
 * `OtpForm` is purely presentational — it takes `onVerify`/`onResend` as props
 * and has no knowledge of which real endpoint it hits (see OtpForm.tsx's own
 * doc comment: "which endpoint gets called... is entirely up to the page").
 * Testing it directly would mean passing mock callback props, which is exactly
 * the inline-mock-instead-of-real-MSW-handlers this repo's testing philosophy
 * forbids (AGENTS.md § Testing). So this renders it through
 * `VerifySignupOtpPage` — one of its two real callers — the same way any other
 * shared, generic piece in this repo gets exercised through a real workflow
 * rather than in isolation. `VerifyForgotPasswordOtpPage` (its other caller,
 * wired to a different endpoint) is not covered here — OtpForm's own shape is
 * fully proven once via either.
 */
function renderVerifySignupOtpFlow(email: string | undefined) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter
        initialEntries={[{ pathname: '/verify-signup-otp', state: email ? { email } : null }]}
      >
        <Routes>
          <Route path="/verify-signup-otp" element={<VerifySignupOtpPage />} />
          <Route path="/signup" element={<p>Sign up</p>} />
          <Route path="/dashboard" element={<p>Dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('OtpForm workflow (via VerifySignupOtpPage)', () => {
  afterEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  it('redirects back to /signup when hit directly with no email in state', () => {
    renderVerifySignupOtpFlow(undefined);

    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('shows a validation error when submitted empty', async () => {
    const user = userEvent.setup();
    renderVerifySignupOtpFlow('ada@example.com');

    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Enter the 6-digit code')).toBeInTheDocument();
  });

  it('verifies successfully and navigates to the role home route', async () => {
    const user = userEvent.setup();
    renderVerifySignupOtpFlow('ada@example.com');

    await user.type(screen.getByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('shows the error state for an invalid/expired code', async () => {
    const user = userEvent.setup();
    renderVerifySignupOtpFlow('ada@example.com');

    // '000000' is the reserved code handlers.ts uses for this.
    await user.type(screen.getByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired code.');
  });

  it('resends the code successfully', async () => {
    const user = userEvent.setup();
    renderVerifySignupOtpFlow('ada@example.com');

    await user.click(screen.getByRole('button', { name: 'Resend code' }));

    // resend's onSuccess toasts — Toaster isn't mounted in this test tree, so
    // the observable proof is that the button becomes interactive again (no
    // pending state stuck forever) rather than a resolved promise never settling.
    expect(await screen.findByRole('button', { name: 'Resend code' })).not.toBeDisabled();
  });
});
