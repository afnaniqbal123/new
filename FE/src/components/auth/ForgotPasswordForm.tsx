import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from 'src/components/common/Input';
import { Button } from 'src/components/common/Button';
import { useForgotPassword } from 'src/hooks/auth/useAuth';
import { forgotPasswordSchema, type ForgotPasswordValues } from 'src/schemas/auth/auth.schema';

export function ForgotPasswordForm() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const forgotPassword = useForgotPassword();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          forgotPassword.mutate(values, {
            onSuccess: (_data, variables) => {
              void navigate('/verify-forgot-password-otp', { state: { email: variables.email } });
            },
          });
        })(event);
      }}
      noValidate
    >
      <Input
        label={t('LABEL_EMAIL')}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      {forgotPassword.isError ? (
        <p role="alert" className="text-danger text-sm">
          {forgotPassword.error instanceof Error ? forgotPassword.error.message : t('ERROR')}
        </p>
      ) : null}
      <Button type="submit" disabled={forgotPassword.isPending}>
        {forgotPassword.isPending ? t('LOADING') : t('BUTTON_SEND_CODE')}
      </Button>
    </form>
  );
}
