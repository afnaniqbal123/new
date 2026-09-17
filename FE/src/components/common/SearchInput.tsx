import { useRef, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from 'src/components/common/Input';

interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'defaultValue' | 'label'
> {
  /** Initial value only — this is an uncontrolled input (see note below). */
  defaultValue?: string;
  onChange: (value: string) => void;
  /** Debounce delay before `onChange` fires (ms). */
  delayMs?: number;
  label?: string;
}

/**
 * Debounced search box. Deliberately **uncontrolled** — the debounce timer is
 * armed directly inside the change handler (`globalThis.setTimeout`/`clearTimeout`
 * on a ref), not synced through a `useEffect`. An earlier version buffered
 * keystrokes into `useState` and pushed the debounced result to the parent via
 * an effect; react-doctor correctly flagged that as fragile (state derived from
 * a prop that never re-syncs if the parent resets `value` externally) and an
 * anti-pattern (effects shouldn't push data to a parent — lift state up or, as
 * here, skip the effect entirely). If a caller needs to externally clear/reset
 * the field, remount it with a `key` change rather than trying to control `value`.
 */
export function SearchInput({
  defaultValue,
  onChange,
  delayMs = 300,
  label,
  ...rest
}: SearchInputProps) {
  const timeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined);
  const { t } = useTranslation();

  return (
    <Input
      label={label ?? t('LABEL_SEARCH')}
      type="search"
      defaultValue={defaultValue}
      onChange={(event) => {
        const next = event.target.value;
        globalThis.clearTimeout(timeoutRef.current);
        timeoutRef.current = globalThis.setTimeout(() => {
          onChange(next);
        }, delayMs);
      }}
      {...rest}
    />
  );
}
