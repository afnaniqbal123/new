// `/vitest` (not the plain `@testing-library/jest-dom` entry) both registers
// the matchers AND augments Vitest's `expect` types — no separate `.d.ts` needed.
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { apiClient } from 'src/services/api-client';
import { server } from 'src/mocks/server';

// api-client.ts's baseURL is '' in the real app (same-origin — see
// src/constants/config.ts). Under Vitest, Node's module resolution (not
// Vite's browser-target build) loads axios's Node platform module even
// though the environment is jsdom, so its http adapter can't turn a relative
// URL into a request without an absolute base to resolve against — give it
// jsdom's own origin, which is also what MSW resolves its relative-path
// handlers against, so the two agree.
apiClient.defaults.baseURL = window.location.origin;

// jsdom doesn't implement matchMedia at runtime (TS's DOM lib types it as
// always-present, which is why this isn't behind an `if`); useThemeSync (and
// anything rendering ThemeToggle) reads it eagerly, so every test gets a
// harmless stub for free instead of each test file needing to know about
// this jsdom gap.
window.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

// jsdom doesn't implement the Pointer Capture APIs or scrollIntoView at
// runtime (same "TS's DOM lib types it as always-present" situation as
// matchMedia above); Radix's Dialog/DropdownMenu/Toast primitives call these
// during pointer/keyboard interaction handling, so any test that opens one
// throws without these.
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

// 'error' on an unmocked request — a missing handler should fail the test
// loudly, not silently hit the network or return an empty response.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

afterAll(() => {
  server.close();
});
