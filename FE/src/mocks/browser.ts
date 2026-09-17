import { setupWorker } from 'msw/browser';
import { handlers } from 'src/mocks/handlers';

/** Browser MSW worker — started in dev from main.tsx. */
export const worker = setupWorker(...handlers);
