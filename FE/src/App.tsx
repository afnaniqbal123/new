import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from 'src/services/queryClient';
import { router } from 'src/routes/AppRouters';
import { Toaster } from 'src/components/common/Toaster';
import { useThemeSync } from 'src/hooks/common/useThemeSync';
import { useSyncAuthAcrossTabs } from 'src/hooks/common/useSyncAuthAcrossTabs';

/** Root provider composition: server-state client + data router + toast host + theme sync. */
export function App() {
  useThemeSync();
  useSyncAuthAcrossTabs();

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
