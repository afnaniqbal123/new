import { useEffect } from 'react';
import { useAuthStore } from 'src/stores/authStore';
import { CONFIG } from 'src/constants/config';

/**
 * Keeps this tab's auth state in sync with logout/login happening in another
 * tab. zustand/persist writes the auth session to localStorage under
 * `CONFIG.AUTH_STORE_NAME`; a `storage` event only fires in *other* tabs when
 * that key changes, so on any such event we re-read it here rather than
 * leaving this tab showing a stale "logged in" header until its next request
 * 401s. Call once at the app root (see App.tsx).
 */
export function useSyncAuthAcrossTabs(): void {
  useEffect(() => {
    function handleStorage(event: StorageEvent): void {
      if (event.key === CONFIG.AUTH_STORE_NAME) {
        void useAuthStore.persist.rehydrate();
      }
    }

    globalThis.addEventListener('storage', handleStorage);
    return () => {
      globalThis.removeEventListener('storage', handleStorage);
    };
  }, []);
}
