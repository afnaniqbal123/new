import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from 'src/components/common/Seo';
import { LoginForm } from 'src/components/auth/LoginForm';

export function LoginPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('AUTH_LOGIN_TITLE')} />
      <header className="mb-7">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {t('AUTH_LOGIN_TITLE')}
        </h1>
        <p className="text-foreground-muted mt-1.5 text-sm">{t('AUTH_LOGIN_SUB')}</p>
      </header>

      <LoginForm />

      <div className="mt-6 flex flex-col gap-2 text-sm">
        <Link
          to="/forgot-password"
          className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
        >
          {t('LINK_FORGOT_PASSWORD')}
        </Link>
        <Link
          to="/signup"
          className="text-foreground-muted hover:text-foreground transition-colors"
        >
          {t('LINK_NO_ACCOUNT')}
        </Link>
      </div>
    </>
  );
}
