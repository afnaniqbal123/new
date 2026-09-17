import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from 'src/services/api-client';
import { toast } from 'src/stores/toastStore';
import i18n from 'src/i18n';

/** Extra per-query/mutation options beyond TanStack Query's own `meta` shape. */
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { skipErrorToast?: boolean };
    mutationMeta: { skipErrorToast?: boolean };
  }
}

function reportError(error: unknown, skipErrorToast?: boolean): void {
  if (skipErrorToast) return;
  const message = error instanceof ApiError ? error.message : i18n.t('ERROR');
  toast.error(message, i18n.t('TOAST_ERROR_TITLE'));
}

/**
 * Single shared TanStack Query client. All server-state fetching goes through
 * this — never raw useEffect fetches (see AGENTS.md § Data Fetching).
 *
 * Failed queries/mutations toast automatically (the pattern repeats across our
 * real projects); opt a specific call out with `meta: { skipErrorToast: true }`
 * when the caller renders its own inline error state instead.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(error, query.meta?.skipErrorToast);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        reportError(error, mutation.meta?.skipErrorToast);
      },
    }),
  });
}

export const queryClient = createQueryClient();
