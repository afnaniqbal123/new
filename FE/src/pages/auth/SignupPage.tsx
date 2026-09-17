import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from 'src/components/common/Seo';
import { SignupForm } from 'src/components/auth/SignupForm';

export function SignupPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('AUTH_SIGNUP_TITLE')} />
      <header className="mb-7">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {t('AUTH_SIGNUP_TITLE')}
        </h1>
        <p className="text-foreground-muted mt-1.5 text-sm">{t('AUTH_SIGNUP_SUB')}</p>
      </header>

      <SignupForm />

      <p className="mt-6 text-sm">
        <Link
          to="/login"
          className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
        >
          {t('LINK_HAVE_ACCOUNT')}
        </Link>
      </p>
    </>
  );
}
