import { useId } from 'react';

interface SettingsToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * A labelled on/off setting.
 *
 * A plain checkbox rather than a Radix switch: it is already keyboard- and
 * screen-reader-correct with no focus management to get wrong, and the hint
 * below it is linked with `aria-describedby` so the consequence of the toggle
 * is announced along with its name — which matters here, where flipping one of
 * these changes how money is calculated.
 */
export function SettingsToggle({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: SettingsToggleProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        {...(hint ? { 'aria-describedby': hintId } : {})}
        className="accent-brand-600 mt-0.5 size-4 shrink-0"
      />
      <span className="min-w-0">
        <label htmlFor={id} className="text-foreground block text-sm font-medium">
          {label}
        </label>
        {hint ? (
          <span id={hintId} className="text-foreground-subtle mt-0.5 block text-xs">
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}
