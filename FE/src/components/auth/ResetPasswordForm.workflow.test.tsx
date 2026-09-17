import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from 'src/test/renderWithProviders';
import { ResetPasswordForm } from './ResetPasswordForm';

/** Stand-in for the real LoginPage — proves navigation, not the login page
 * itself (out of this workflow's scope). */
function LoginSentinel() {
  return <p>Sign in</p>;
}

function renderResetPasswordFlow(token: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<ResetPasswordForm token={token} />} />
      <Route path="/login" element={<LoginSentinel />} />
    </Routes>
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('New password'), 'Sup3rSecret');
  await user.type(screen.getByLabelText('Confirm password'), 'Sup3rSecret');
}

/**
 * Workflow test: the full reset-password flow (validation → submit →
 * success/error), through the real MSW-backed network layer. See AGENTS.md §
 * Testing for why this repo tests at this level rather than unit-testing
 * individual primitives. `token` is a prop here (the page reads it from router
 * state or a `?token=` query string — see ResetPasswordPage.tsx — this test
 * exercises the form directly, same as every other form in this folder).
 */
describe('ResetPasswordForm workflow', () => {
  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup();
    renderResetPasswordFlow('valid-reset-token');

    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('This value is too short')).toBeInTheDocument();
  });

  it('shows a mismatch error when the passwords do not match', async () => {
    const user = userEvent.setup();
    renderResetPasswordFlow('valid-reset-token');

    await user.type(screen.getByLabelText('New password'), 'Sup3rSecret');
    await user.type(screen.getByLabelText('Confirm password'), 'Different1');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('resets the password successfully and navigates to login', async () => {
    const user = userEvent.setup();
    renderResetPasswordFlow('valid-reset-token');

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('Sign in')).toBeInTheDocument();
  });

  it('shows the error state for an invalid/expired token', async () => {
    const user = userEvent.setup();
    // 'invalid-token' is the reserved token handlers.ts uses for this.
    renderResetPasswordFlow('invalid-token');

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired token.');
  });
});
