import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from 'src/components/common/Seo';
import { OtpForm } from 'src/components/auth/OtpForm';
import { useForgotPassword, useVerifyForgotPasswordOtp } from 'src/hooks/auth/useAuth';

interface LocationState {
  email?: string;
}

/** Verifying the forgot-password OTP returns a single-use reset token, not a session. */
export function VerifyForgotPasswordOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as LocationState | null)?.email;
  const { t } = useTranslation();
  const verifyOtp = useVerifyForgotPasswordOtp();
  // Resending is the same call as the initial "forgot password" submit.
  const resend = useForgotPassword();

  // No email in state means this route was hit directly, not via forgot-password
  // — send the user back to start the flow properly instead of a broken form.
  if (!email) return <Navigate to="/forgot-password" replace />;

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
          const { resetToken } = await verifyOtp.mutateAsync({ email, otp });
          void navigate('/reset-password', { state: { resetToken } });
        }}
        onResend={() => resend.mutateAsync({ email })}
      />
    </>
  );
}
