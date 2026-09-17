import { renderHook } from '@testing-library/react';
import { useAuthStore } from 'src/stores/authStore';
import { CONFIG } from 'src/constants/config';
import { useSyncAuthAcrossTabs } from './useSyncAuthAcrossTabs';

describe('useSyncAuthAcrossTabs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rehydrates the auth store when the auth storage key changes in another tab', () => {
    const rehydrateSpy = vi
      .spyOn(useAuthStore.persist, 'rehydrate')
      .mockImplementation(() => Promise.resolve());
    renderHook(() => {
      useSyncAuthAcrossTabs();
    });

    window.dispatchEvent(new StorageEvent('storage', { key: CONFIG.AUTH_STORE_NAME }));

    expect(rehydrateSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores storage events for unrelated keys', () => {
    const rehydrateSpy = vi
      .spyOn(useAuthStore.persist, 'rehydrate')
      .mockImplementation(() => Promise.resolve());
    renderHook(() => {
      useSyncAuthAcrossTabs();
    });

    window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-key' }));

    expect(rehydrateSpy).not.toHaveBeenCalled();
  });

  it('removes its listener on unmount', () => {
    const rehydrateSpy = vi
      .spyOn(useAuthStore.persist, 'rehydrate')
      .mockImplementation(() => Promise.resolve());
    const { unmount } = renderHook(() => {
      useSyncAuthAcrossTabs();
    });
    unmount();

    window.dispatchEvent(new StorageEvent('storage', { key: CONFIG.AUTH_STORE_NAME }));

    expect(rehydrateSpy).not.toHaveBeenCalled();
  });
});
