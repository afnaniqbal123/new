import { useEffect, useState } from 'react';

/**
 * Generic debounce hook. Feature-agnostic utilities like this live in src/hooks;
 * feature-specific hooks live inside their feature folder.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = globalThis.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      globalThis.clearTimeout(id);
    };
  }, [value, delayMs]);

  return debounced;
}
