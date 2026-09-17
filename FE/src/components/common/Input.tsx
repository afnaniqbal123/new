import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from 'src/lib/utils';

const inputVariants = cva(
  'border-border bg-surface text-foreground rounded-md border px-3 py-2 text-base'
);

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible label text — required so every input is programmatically labeled. */
  label: ReactNode;
  /** Optional error message; when present the field is marked aria-invalid.
   *  Typed `| undefined` (not just `?`) because React Hook Form's
   *  `fieldState.error?.message` is always this exact type, present or not. */
  error?: string | undefined;
  /** Optional helper text linked via aria-describedby. */
  hint?: ReactNode;
}

/**
 * Labeled text input. The label is always associated with the control via htmlFor,
 * and errors are linked with aria-describedby + role="alert" (WCAG 2.1 AA).
 * Ref-forwarding so it plugs directly into React Hook Form's `register`.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-foreground text-sm font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(inputVariants(), className)}
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="text-foreground-muted text-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
});
