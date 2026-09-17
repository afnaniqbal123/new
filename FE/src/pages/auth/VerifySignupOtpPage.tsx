import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from 'src/components/common/Seo';
import { OtpForm } from 'src/components/auth/OtpForm';
import { useResendSignupOtp, useVerifyOtp } from 'src/hooks/auth/useAuth';
import { getHomeRouteForRole } from 'src/routes/ProtectedRoutes';

interface LocationState {
  email?: string;
}

/** Completes signup: verifying the OTP activates the account and starts a session. */
export function VerifySignupOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as LocationState | null)?.email;
  const { t } = useTranslation();
  const verifyOtp = useVerifyOtp();
  const resendOtp = useResendSignupOtp();

  // No email in state means this route was hit directly, not via signup — send
  // the user back to start the flow properly instead of rendering a broken form.
  if (!email) return <Navigate to="/signup" replace />;

  return (
    <>
      <Seo title={t('AUTH_OTP_TITLE')} />
      <header className="mb-7">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {t('AUTH_OTP_TITLE')}
        </h1>
        <p className="text-foreground-muted mt-1.5 text-sm">{t('AUTH_OTP_BODY')}</p>
      </header>
      <OtpForm
        email={email}
        onVerify={async (otp) => {
          // useVerifyOtp's own onSuccess already sets the session (src/hooks/auth/useAuth.ts).
          const { user } = await verifyOtp.mutateAsync({ email, otp });
          void navigate(getHomeRouteForRole(user.role), { replace: true });
        }}
        onResend={() => resendOtp.mutateAsync({ email })}
      />
    </>
  );
}
