import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * A small, deterministic browser smoke-gate — not a full E2E suite. Chromium
 * only, on purpose (see AGENTS.md § Testing: this layer proves the app boots
 * and one real user flow works in a real browser; it is not where
 * cross-browser coverage lives).
 *
 * Runs against the actual production build (`pnpm build:e2e` — `vite build
 * --mode e2e`, output to dist-e2e/, distinct from `check:build`'s own dist/ so
 * neither step disturbs the other's artifact), served by `vite preview`. The
 * `e2e` mode only flips `VITE_E2E=true` (see .env.e2e, src/main.tsx) so the
 * MSW browser worker still starts — a real prod build never sets this.
 */
const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // A test that fails then passes on retry is still flaky, not fixed — without this, CI's
  // one retry above would let a flaky test go green silently, forever. Only in CI: locally
  // a flaky failure should just fail so you see it immediately, not report a `failOnFlakyTests`
  // error on top of a retry you were still watching run.
  failOnFlakyTests: isCI,
  // 'list' for live terminal output; 'html' so a failure leaves a real,
  // trace-viewer-capable report behind for CI to upload (open: 'never' — a
  // report that tries to launch a browser tab would just hang in CI).
  reporter: [['list'], ['html', { open: 'never' }]],
  // Omitted (not set to `undefined`) outside CI — exactOptionalPropertyTypes
  // treats an explicit `undefined` differently from the key being absent.
  ...(isCI ? { workers: 1 } : {}),

  use: {
    baseURL: BASE_URL,
    // Only kept on the run that actually needed them — a trace/video on every
    // green run would just be discarded CI-artifact weight.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Local-only, opt-in slow-motion for `--headed` debugging (e.g. `SLOWMO=500
    // pnpm exec playwright test --headed`) — never hardcoded, so CI (always
    // headless) never pays for it.
    ...(process.env['SLOWMO'] ? { launchOptions: { slowMo: Number(process.env['SLOWMO']) } } : {}),
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: `pnpm run build:e2e && pnpm exec vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Always a fresh build+serve, locally and in CI — reusing a server you happened to
    // already have running on this port would validate whatever stale build it was serving,
    // not the current branch. The canonical verification path (`check:e2e`/`pnpm verify`)
    // must never have that failure mode; the build is cheap enough (~5-10s) that this isn't
    // worth trading determinism for.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
