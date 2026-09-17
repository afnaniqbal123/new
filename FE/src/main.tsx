import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from 'src/App';
import { CONFIG } from 'src/constants/config';
import 'src/i18n';
import 'src/index.css';

async function enableMocking(): Promise<void> {
  // Deliberate, narrow exception to "never read import.meta.env.VITE_X
  // outside env.ts" (AGENTS.md § Never Do): this specific check has to be a
  // raw `import.meta.env.X` reference, exactly like `DEV` right next to it,
  // for Vite/Rollup to constant-fold and dead-code-eliminate this whole `if`
  // — routing it through CONFIG (a runtime function-call chain) would make
  // the condition unprovable at build time, and the ~420KB MSW worker chunk
  // would ship to every real production build whether or not it can ever
  // run. `VITE_E2E` is still Zod-validated in env.ts (typo-safety), just not
  // exposed as a `CONFIG.*` convenience getter, since using it anywhere would
  // reintroduce exactly this bundle-bloat bug. Only `pnpm build:e2e` (`vite
  // build --mode e2e`, loading `.env.e2e`) sets it — a real prod build never
  // does, so this branch — and the chunk — stay eliminated there.
  const mswEnabledForThisBuild = import.meta.env.DEV || import.meta.env.VITE_E2E === 'true';
  if (!mswEnabledForThisBuild || !CONFIG.ENABLE_MOCKS) return;
  const { worker } = await import('src/mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root was not found');
}

void enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
