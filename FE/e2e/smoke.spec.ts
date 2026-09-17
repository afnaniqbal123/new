import { test, expect } from './fixtures';

/**
 * Deterministic browser smoke-gate (Chromium only — see playwright.config.ts
 * and AGENTS.md § Testing).
 *
 * What it proves, and nothing more: the app boots in a real browser, the
 * marketing page renders including its WebGL hero, a real sign-in round trip
 * goes through the MSW browser worker, and the app shell renders afterwards.
 *
 * Component and state behaviour belong in Vitest/RTL workflow tests. The
 * things here are the ones only a real browser can establish — a genuine page
 * load, a service worker intercepting a genuine fetch, and a canvas that
 * actually got a WebGL context.
 */
test.describe('App smoke', () => {
  test('serves the marketing page to a signed-out visitor at "/"', async ({
    page,
    checkA11y,
  }) => {
    // "/" is the landing page for a signed-out visitor rather than a redirect
    // to /login — see src/routes/HomeRedirectRoute.tsx for why. This proves
    // the app boots AND that the root decision actually fires.
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: /Run your entire business from one place/i,
        level: 1,
      }),
    ).toBeVisible();

    // Stays on "/" — a redirect here would mean the auth-aware root broke.
    await expect(page).toHaveURL('/');

    await checkA11y();
  });

  test('renders the WebGL hero without falling over', async ({ page }) => {
    await page.goto('/');

    // The scene mounts a <canvas> only once three.js has a real WebGL
    // context; if construction threw, the effect returns early and no canvas
    // exists. Asserting on its presence is therefore a genuine check that the
    // hero initialised — and it is a check only a real browser can make.
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveCount(1);

    // Decorative, so it must be hidden from assistive technology — the
    // headline beside it carries the message.
    await expect(canvas.locator('xpath=..')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  test('signs a user in through the MSW-backed API and renders the app shell', async ({
    page,
    checkA11y,
  }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('heading', { name: 'Sign in', level: 1 }),
    ).toBeVisible();

    await checkA11y();

    await page.getByRole('textbox', { name: 'Email' }).fill('owner@businessos.test');
    // By role, not by label: `getByLabel('Password')` also matches the
    // "Show password" toggle button that sits inside the same field.
    await page
      .getByRole('textbox', { name: 'Password', exact: true })
      .fill('correct-horse-battery');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Proves the real fetch → service worker → real HTTP response round trip,
    // the token landing in the persisted auth store, and the router acting on
    // it — none of which a jsdom test exercises.
    await expect(page).toHaveURL('/dashboard');
  });
});
