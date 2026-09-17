import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Derived from AxeBuilder's own return type instead of importing `axe-core`
// directly — that package is only a transitive dependency here (of
// @axe-core/playwright), and pnpm's strict node_modules layout doesn't
// guarantee a phantom dependency like that stays resolvable.
type AxeViolation = Awaited<ReturnType<InstanceType<typeof AxeBuilder>['analyze']>>['violations'][number];

/**
 * Narrow, documented allowlist for genuinely benign/unavoidable console noise
 * — never a blanket suppression. Empty today: nothing has needed one yet. Add
 * an entry only with a comment explaining exactly which third-party source
 * produces it and why it can't be fixed at the source instead.
 */
const IGNORED_CONSOLE_PATTERNS: RegExp[] = [];

function formatAxeViolations(violations: AxeViolation[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n');
      return `${violation.id} (${violation.impact ?? 'unknown'} impact): ${violation.help}\n${targets}\n  ${violation.helpUrl}`;
    })
    .join('\n\n');
}

interface Fixtures {
  /** Runs an axe scan against the current page; fails the test on any violation. */
  checkA11y: () => Promise<void>;
}

/**
 * Shared fixture for every e2e spec (see AGENTS.md § Testing):
 * - Overrides the built-in `page` fixture to collect every `console.error`
 *   and uncaught `pageerror` during the test, then fails the test if any
 *   showed up — a real regression should never pass silently just because
 *   the assertions happened to still find their elements.
 * - Exposes `checkA11y()` for a page-level axe-core scan.
 */
export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) return;
      consoleErrors.push(text);
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await use(page);

    expect(consoleErrors, 'Unexpected console.error output during the test').toEqual([]);
    expect(pageErrors, 'Unexpected uncaught page error(s) during the test').toEqual([]);
  },

  checkA11y: async ({ page }, use) => {
    await use(async () => {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, formatAxeViolations(results.violations)).toEqual([]);
    });
  },
});

export { expect };
