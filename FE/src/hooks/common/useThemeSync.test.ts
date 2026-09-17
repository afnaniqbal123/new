import { cleanup, renderHook } from '@testing-library/react';
import { useThemeStore } from 'src/stores/themeStore';
import { useThemeSync } from './useThemeSync';

/** A controllable matchMedia stub — the global one in src/test/setup.ts is a
 * fixed no-op; this one lets a test flip `matches` and fire a live change,
 * which is exactly what the 'system' preference path needs to exercise. */
function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;

  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;

  return {
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => {
        listener({ matches: next } as MediaQueryListEvent);
      });
    },
  };
}

describe('useThemeSync', () => {
  afterEach(() => {
    // Unmount *before* resetting the store — src/test/setup.ts's own
    // afterEach also calls cleanup(), but that's a root-level hook and runs
    // after this describe-scoped one; resetting theme first, while the just-
    // finished test's hook host is still mounted and subscribed to
    // useThemeStore, re-renders it outside any act() scope (React's "not
    // wrapped in act(...)" warning). Unmounting first removes the (only)
    // subscriber, so the reset below has nothing live left to notify.
    cleanup();
    useThemeStore.setState({ theme: 'system' });
    document.documentElement.classList.remove('dark');
  });

  it('applies the dark class directly when the preference is "dark"', () => {
    useThemeStore.setState({ theme: 'dark' });
    renderHook(() => {
      useThemeSync();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes the dark class when the preference is "light"', () => {
    document.documentElement.classList.add('dark');
    useThemeStore.setState({ theme: 'light' });
    renderHook(() => {
      useThemeSync();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('follows the system preference, including a live change, when the preference is "system"', () => {
    const media = mockMatchMedia(false);
    useThemeStore.setState({ theme: 'system' });
    renderHook(() => {
      useThemeSync();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    media.setMatches(true);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
