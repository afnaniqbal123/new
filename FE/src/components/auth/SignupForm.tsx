import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from 'src/components/common/Input';
import { PasswordInput } from 'src/components/common/PasswordInput';
import { Button } from 'src/components/common/Button';
import { useSignup } from 'src/hooks/auth/useAuth';
import { signupSchema, type SignupValues } from 'src/schemas/auth/auth.schema';

export function SignupForm() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  const signup = useSignup();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          signup.mutate(values, {
            onSuccess: (_data, variables) => {
              void navigate('/verify-signup-otp', { state: { email: variables.email } });
            },
          });
        })(event);
      }}
      noValidate
    >
      <Input
        label={t('LABEL_NAME')}
        autoComplete="name"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label={t('LABEL_EMAIL')}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label={t('LABEL_PHONE')}
        type="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <PasswordInput
        label={t('LABEL_PASSWORD')}
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordInput
        label={t('LABEL_CONFIRM_PASSWORD')}
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      {signup.isError ? (
        <p role="alert" className="text-danger text-sm">
          {signup.error instanceof Error ? signup.error.message : t('ERROR')}
        </p>
      ) : null}
      <Button type="submit" disabled={signup.isPending}>
        {signup.isPending ? t('LOADING') : t('BUTTON_SIGNUP')}
      </Button>
    </form>
  );
}
