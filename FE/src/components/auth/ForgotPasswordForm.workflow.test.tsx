import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders } from 'src/test/renderWithProviders';
import { ForgotPasswordForm } from './ForgotPasswordForm';

/** Stand-in for the real VerifyForgotPasswordOtpPage — proves navigation + router
 * state, not the OTP page itself (out of this workflow's scope). */
function VerifyOtpSentinel() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;
  return <p>Verify OTP for {email}</p>;
}

function renderForgotPasswordFlow() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<ForgotPasswordForm />} />
      <Route path="/verify-forgot-password-otp" element={<VerifyOtpSentinel />} />
    </Routes>
  );
}

/**
 * Workflow test: the full forgot-password flow (validation → submit →
 * success/error), through the real MSW-backed network layer. See AGENTS.md §
 * Testing for why this repo tests at this level rather than unit-testing
 * individual primitives.
 */
describe('ForgotPasswordForm workflow', () => {
  it('shows a validation error when submitted empty', async () => {
    const user = userEvent.setup();
    renderForgotPasswordFlow();

    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByText('Please enter a valid email')).toBeInTheDocument();
  });

  it('sends the code and navigates to OTP verification', async () => {
    const user = userEvent.setup();
    renderForgotPasswordFlow();

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByText('Verify OTP for ada@example.com')).toBeInTheDocument();
  });

  it('shows the error state when the server fails', async () => {
    const user = userEvent.setup();
    renderForgotPasswordFlow();

    // 'error@example.com' is the reserved address handlers.ts uses for this.
    await user.type(screen.getByLabelText('Email'), 'error@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error.');
  });
});
