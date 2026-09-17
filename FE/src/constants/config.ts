import { ENV } from 'src/constants/env';

/**
 * Runtime configuration derived from the validated env (src/constants/env.ts).
 * Routes in api-routes.ts are absolute (e.g. "/auth/login"), so the base is
 * host-only and empty by default (same-origin, which MSW intercepts in dev + tests).
 */
export const CONFIG = {
  API_BASE_URL: ENV.VITE_API_BASE_URL,
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
  // Enable MSW in dev so the boilerplate runs with no real backend.
  ENABLE_MOCKS: ENV.VITE_ENABLE_MOCKS === 'true',
  /** Zustand `persist` storage key for the auth store (src/stores/authStore.ts). */
  AUTH_STORE_NAME: 'geeks.auth',
  /** Zustand `persist` storage key for the theme store (src/stores/themeStore.ts). */
  THEME_STORE_NAME: 'geeks.theme',
} as const;
