import { useId, type ReactNode } from 'react';

interface FormFieldProps {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** Render prop so the field can wrap any control (Select, checkbox group, ...),
   * not just a plain `<input>` — use the common `Input`/`PasswordInput` directly
   * for those, this is for a control that doesn't already manage its own label. */
  children: (ids: { fieldId: string; describedBy?: string | undefined }) => ReactNode;
}

/**
 * Generic labeled-field wrapper for a non-`Input` control. Produces the same
 * `htmlFor`/`aria-describedby`/`role="alert"` contract as `Input` (see AGENTS.md
 * § Accessibility) so every form field is consistent regardless of what control
 * lives inside it.
 */
export function FormField({ label, error, hint, children }: FormFieldProps) {
  const generatedId = useId();
  const fieldId = generatedId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-foreground text-sm font-medium">
        {label}
      </label>
      {children({ fieldId, describedBy })}
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
}
