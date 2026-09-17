import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from 'src/components/common/Seo';
import { ForgotPasswordForm } from 'src/components/auth/ForgotPasswordForm';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('AUTH_FORGOT_PASSWORD_TITLE')} />
      <header className="mb-7">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {t('AUTH_FORGOT_PASSWORD_TITLE')}
        </h1>
        <p className="text-foreground-muted mt-1.5 text-sm">{t('AUTH_FORGOT_PASSWORD_BODY')}</p>
      </header>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm">
        <Link
          to="/login"
          className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
        >
          {t('LINK_BACK_TO_LOGIN')}
        </Link>
      </p>
    </>
  );
}
