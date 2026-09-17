import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders } from 'src/test/renderWithProviders';
import { server } from 'src/mocks/server';
import { AuthRoutes } from 'src/constants/auth';
import { SignupForm } from './SignupForm';

/** Stand-in for the real VerifySignupOtpPage — proves navigation + router state,
 * not the OTP page itself (that's its own feature, out of this workflow's scope). */
function VerifyOtpSentinel() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;
  return <p>Verify OTP for {email}</p>;
}

function renderSignupFlow() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<SignupForm />} />
      <Route path="/verify-signup-otp" element={<VerifyOtpSentinel />} />
    </Routes>
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText('Full name'), 'Ada Lovelace');
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Phone number'), '+15555550123');
  await user.type(screen.getByLabelText('Password'), 'Sup3rSecret');
  await user.type(screen.getByLabelText('Confirm password'), 'Sup3rSecret');
}

/**
 * Workflow test: the full signup flow (validation → submit → success/error),
 * through the real MSW-backed network layer. See AGENTS.md § Testing for why
 * this repo tests at this level rather than unit-testing individual primitives.
 */
describe('SignupForm workflow', () => {
  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup();
    renderSignupFlow();

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
  });

  it('never calls the signup API for an invalid submission — SignupForm has no', async () => {
    // explicit cancel action, so this is the closest equivalent: confirm an
    // incomplete submit never reaches the network rather than silently
    // succeeding or hanging.
    const user = userEvent.setup();
    let signupCalls = 0;
    server.use(
      http.post(AuthRoutes.SIGNUP, () => {
        signupCalls += 1;
        return HttpResponse.json({ data: true, status: 200, message: 'Account created.' });
      })
    );
    renderSignupFlow();

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByText('This field is required');

    expect(signupCalls).toBe(0);
  });

  it('signs up successfully and navigates to OTP verification', async () => {
    const user = userEvent.setup();
    renderSignupFlow();

    await fillValidForm(user, 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Verify OTP for ada@example.com')).toBeInTheDocument();
  });

  it('shows the server error when the email is already registered', async () => {
    const user = userEvent.setup();
    renderSignupFlow();

    // 'taken@example.com' is the reserved address handlers.ts uses for this.
    await fillValidForm(user, 'taken@example.com');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists.'
    );
  });
});
