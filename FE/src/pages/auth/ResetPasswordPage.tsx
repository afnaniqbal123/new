import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from 'src/components/common/Seo';
import { ResetPasswordForm } from 'src/components/auth/ResetPasswordForm';

interface LocationState {
  resetToken?: string;
}

/**
 * Reads the reset token from either the OTP-verify step's route state or a
 * `?token=` query string — the latter is how the backend's alternate
 * `forgot-password-link` email flow lands a user here directly, so both entry
 * points work with no extra route.
 */
export function ResetPasswordPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const token = (location.state as LocationState | null)?.resetToken ?? searchParams.get('token');
  const { t } = useTranslation();

  if (!token) return <Navigate to="/forgot-password" replace />;

  return (
    <>
      <Seo title={t('AUTH_RESET_PASSWORD_TITLE')} />
      <header className="mb-7">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {t('AUTH_RESET_PASSWORD_TITLE')}
        </h1>
      </header>
      <ResetPasswordForm token={token} />
    </>
  );
}
