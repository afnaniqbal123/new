import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CONFIG } from 'src/constants/config';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/** Persisted UI preference — light/dark/system. Applied to the DOM by useThemeSync. */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: CONFIG.THEME_STORE_NAME }
  )
);
