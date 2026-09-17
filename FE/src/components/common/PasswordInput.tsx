import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from 'src/components/common/Input';
import { Icon } from 'src/components/common/Icon';
import { cn } from 'src/lib/utils';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  // See Input.tsx's `error` prop doc — same reason for `| undefined`.
  error?: string | undefined;
  hint?: ReactNode;
}

/**
 * Text input with a show/hide toggle — wraps the common `Input`, same a11y
 * contract.
 *
 * The toggle is an eye icon rather than the words "Show password". The text
 * version sat *inside* the field and read as placeholder content, so the field
 * looked pre-filled when it was empty; it also pushed the real value behind
 * 7rem of padding. The accessible name is unchanged — it still announces
 * "Show password" / "Hide password", and it still flips with the state.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    const { t } = useTranslation();
    const toggleLabel = visible ? t('LABEL_PASSWORD_HIDE') : t('LABEL_PASSWORD_SHOW');

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-11', className)}
          {...rest}
        />
        <button
          type="button"
          className="text-foreground-subtle hover:text-foreground focus-visible:ring-brand-500 top-field-toggle absolute right-2 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          aria-label={toggleLabel}
          onClick={() => {
            setVisible((current) => !current);
          }}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} className="size-4.5" />
        </button>
      </div>
    );
  }
);
