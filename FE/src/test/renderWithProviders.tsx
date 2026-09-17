import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { createQueryClient } from 'src/services/queryClient';

/**
 * Test-only render: a fresh `QueryClient` per call (never the app's shared
 * singleton in `src/services/queryClient.ts` — reusing it would leak cached
 * queries and toasts between tests) plus a `MemoryRouter`, since several
 * components read router context (`useNavigate`, `NavLink`, ...) even when a
 * given test isn't exercising navigation itself. `NuqsTestingAdapter` (not the
 * real `nuqs/adapters/react-router/v7` `AppRouters.tsx` uses) backs any
 * `useQueryState`/`useQueryStates` call (docs/adr/url-page-state.md) — nuqs's own
 * URL-update queue is a module-level global, so the real router adapter would
 * leak search-param state between tests in the same file even with a fresh
 * `MemoryRouter` each time; the testing adapter resets that queue on every mount
 * instead. `hasMemory: true` still lets a search/pagination interaction update
 * state and re-render, same as the real adapter, so a workflow test still
 * exercises the real "typing updates the URL, the URL drives the query" flow.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const queryClient = createQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>{children}</NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
