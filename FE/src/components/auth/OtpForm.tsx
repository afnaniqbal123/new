import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Input } from 'src/components/common/Input';
import { Button } from 'src/components/common/Button';
import { toast } from 'src/stores/toastStore';
import { otpSchema, type OtpValues } from 'src/schemas/auth/auth.schema';

interface OtpFormProps {
  /** Shown as read-only context above the code field. */
  email: string;
  /** Verifies the code. Resolves/rejects — this form doesn't know what happens next. */
  onVerify: (otp: string) => Promise<void>;
  /** Requests a new code for the same email. */
  onResend: () => Promise<void>;
}

/**
 * Generic OTP-entry form, reused by both `VerifySignupOtpPage` (activates the
 * account) and `VerifyForgotPasswordOtpPage` (returns a password-reset token) —
 * which endpoint gets called, and what happens on success, is entirely up to
 * the `onVerify`/`onResend` callbacks the page supplies.
 */
export function OtpForm({ email, onVerify, onResend }: OtpFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpValues>({ resolver: zodResolver(otpSchema) });

  const verify = useMutation({
    mutationFn: (values: OtpValues) => onVerify(values.code),
    meta: { skipErrorToast: true },
  });

  const resend = useMutation({
    mutationFn: onResend,
    onSuccess: () => {
      toast.success(t('SUCCESS'));
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        // .catch(() => {}) — the global onError already handles the error;
        // without it a rejected mutateAsync is an unhandled promise rejection
        // (AGENTS.md § Data & State).
        void handleSubmit((values) => verify.mutateAsync(values).catch(() => {}))(event);
      }}
      noValidate
    >
      <p className="text-foreground-muted text-sm">{email}</p>
      <Input
        label={t('LABEL_OTP_CODE')}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        error={errors.code?.message}
        {...register('code')}
      />
      {verify.isError ? (
        <p role="alert" className="text-danger text-sm">
          {verify.error instanceof Error ? verify.error.message : t('ERROR')}
        </p>
      ) : null}
      <Button type="submit" disabled={verify.isPending}>
        {verify.isPending ? t('LOADING') : t('BUTTON_VERIFY')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={resend.isPending}
        onClick={() => {
          resend.mutate();
        }}
      >
        {resend.isPending ? t('LOADING') : t('BUTTON_RESEND_CODE')}
      </Button>
    </form>
  );
}
