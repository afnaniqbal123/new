import { useEffect } from 'react';
import { useThemeStore } from 'src/stores/themeStore';

function applyThemeClass(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
}

/**
 * Applies the persisted theme preference to `<html class="dark">` and, when the
 * preference is "system", tracks `prefers-color-scheme` live. Call once at the
 * app root (see App.tsx) — the actual light/dark tokens live in src/index.css.
 */
export function useThemeSync(): void {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    if (theme !== 'system') {
      applyThemeClass(theme === 'dark');
      return;
    }

    const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
    applyThemeClass(media.matches);
    const listener = (event: MediaQueryListEvent) => {
      applyThemeClass(event.matches);
    };
    media.addEventListener('change', listener);
    return () => {
      media.removeEventListener('change', listener);
    };
  }, [theme]);
}
