import { setupServer } from 'msw/node';
import { handlers } from 'src/mocks/handlers';

/**
 * Node MSW server for tests — the exact same `handlers` the dev-time browser
 * worker (`src/mocks/browser.ts`) uses, just intercepted at the Node request
 * layer instead of the Service Worker layer. Started/reset/stopped by
 * `src/test/setup.ts`; a test that needs a one-off response override calls
 * `server.use(...)` (see MSW docs), it does not add handlers here.
 */
export const server = setupServer(...handlers);
