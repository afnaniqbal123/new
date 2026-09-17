import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { ApiError } from 'src/services/api-client';
import { useToastStore } from 'src/stores/toastStore';
import i18n from 'src/i18n';
import { createQueryClient } from './queryClient';

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

/**
 * `queryClient.ts` is mostly configuration (`QueryCache`/`MutationCache` `onError`
 * wiring), so the only genuinely testable behavior is that wiring itself — not the
 * static config values. `reportError` isn't exported, so this drives it the only
 * honest way: a real failing query/mutation through a real `QueryClientProvider`
 * (via `renderHook`, this repo's own established hook-testing pattern — see
 * `src/hooks/common/useDebouncedValue.test.ts`), never calling internal functions directly.
 * A fresh `createQueryClient()` per test, never the app's shared singleton (same
 * reason `src/test/renderWithProviders.tsx` does this for component tests).
 */
describe('queryClient', () => {
  afterEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('toasts the ApiError message + TOAST_ERROR_TITLE on a failed query', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['query-client-test-error'],
          queryFn: () => {
            throw new ApiError('Boom', 500);
          },
          retry: false,
        }),
      { wrapper: wrapperFor(client) }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        variant: 'error',
        description: 'Boom',
        title: i18n.t('TOAST_ERROR_TITLE'),
      }),
    ]);
  });

  it('falls back to the generic ERROR message for a non-ApiError query failure', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['query-client-test-generic-error'],
          queryFn: () => {
            throw new Error('some unexpected failure');
          },
          retry: false,
        }),
      { wrapper: wrapperFor(client) }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ variant: 'error', description: i18n.t('ERROR') }),
    ]);
  });

  it('does not toast a failed query when meta.skipErrorToast is set', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['query-client-test-skip-toast'],
          queryFn: () => {
            throw new ApiError('Silent failure', 500);
          },
          retry: false,
          meta: { skipErrorToast: true },
        }),
      { wrapper: wrapperFor(client) }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('toasts the ApiError message on a failed mutation', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => {
            throw new ApiError('Mutation boom', 400);
          },
        }),
      { wrapper: wrapperFor(client) }
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        variant: 'error',
        description: 'Mutation boom',
        title: i18n.t('TOAST_ERROR_TITLE'),
      }),
    ]);
  });

  it('does not toast a failed mutation when meta.skipErrorToast is set', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => {
            throw new ApiError('Silent mutation failure', 400);
          },
          meta: { skipErrorToast: true },
        }),
      { wrapper: wrapperFor(client) }
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(useToastStore.getState().toasts).toEqual([]);
  });
});
