#!/usr/bin/env node
/**
 * Regression test for three previously-shipped hardening features (Issues
 * #5 Playwright browser-quality gate, #6 Agent Execution Safety, #7 pnpm
 * supply-chain), the same way `lint-config-contract.mjs` guards ESLint/TS
 * strictness: assert the specific settings/sections these features depend on
 * are still present and unweakened, so a future edit that silently drifts
 * one of them (not a deliberate, documented change) fails loudly here
 * instead of the feature quietly stopping to do its job.
 *
 * Static/string checks only, deliberately — no new dependency (a YAML parser
 * would only be a transitive one today, see AGENTS.md's own phantom-
 * dependency caution elsewhere) and no network calls. This does not replace
 * actually running the features (`pnpm check:e2e`, a real `pnpm install
 * --frozen-lockfile`, GitHub's own native Dependabot-config validation on a
 * PR) — it only confirms their configuration hasn't regressed.
 *
 * Standalone by design (not part of `pnpm verify`) — run on demand with
 * `pnpm check:hardening`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (relPath) => readFileSync(join(ROOT, relPath), 'utf8');

function requireIncludes(failures, content, needle, context) {
  if (!content.includes(needle)) {
    failures.push(`${context}: expected to find ${JSON.stringify(needle)}`);
  }
}

// --- Issue #5: Playwright browser-quality gate ------------------------------

function checkPlaywrightContract() {
  const failures = [];

  if (!existsSync(join(ROOT, 'playwright.config.ts'))) {
    failures.push('playwright.config.ts is missing');
    return failures;
  }
  const config = read('playwright.config.ts');

  requireIncludes(failures, config, "testDir: './e2e'", 'playwright.config.ts');
  requireIncludes(failures, config, "name: 'chromium'", 'playwright.config.ts (Chromium-only project)');
  // The two review-round fixes (AGENTS.md § Package Manager & Supply Chain's
  // sibling review — see git history on fix/check_5) — regressing either
  // reintroduces a real non-determinism bug, not just a style nit.
  requireIncludes(failures, config, 'reuseExistingServer: false', 'playwright.config.ts (deterministic webServer)');
  requireIncludes(failures, config, 'failOnFlakyTests: isCI', 'playwright.config.ts (flaky-test gate)');

  if (!existsSync(join(ROOT, 'e2e/fixtures.ts'))) {
    failures.push('e2e/fixtures.ts is missing');
  } else {
    const fixtures = read('e2e/fixtures.ts');
    requireIncludes(failures, fixtures, 'checkA11y', 'e2e/fixtures.ts (a11y fixture)');
    requireIncludes(failures, fixtures, "message.type() !== 'error'", 'e2e/fixtures.ts (console.error collection)');
    requireIncludes(failures, fixtures, "page.on('pageerror'", 'e2e/fixtures.ts (uncaught pageerror collection)');
  }

  if (!existsSync(join(ROOT, 'e2e/smoke.spec.ts'))) {
    failures.push('e2e/smoke.spec.ts is missing');
  } else {
    const smoke = read('e2e/smoke.spec.ts');
    requireIncludes(failures, smoke, 'checkA11y()', 'e2e/smoke.spec.ts (a11y assertion actually called)');
  }

  if (!existsSync(join(ROOT, '.env.e2e'))) {
    failures.push('.env.e2e is missing');
  } else {
    const envE2e = read('.env.e2e');
    requireIncludes(failures, envE2e, 'VITE_E2E=true', '.env.e2e');
    requireIncludes(failures, envE2e, 'VITE_API_BASE_URL=', '.env.e2e (pinned same-origin)');
    requireIncludes(failures, envE2e, 'VITE_ENABLE_MOCKS=true', '.env.e2e (MSW pinned on — review-round fix)');
  }

  const pkg = read('package.json');
  for (const script of ['check:e2e', 'test:e2e', 'test:e2e:headed', 'test:e2e:changed']) {
    requireIncludes(failures, pkg, `"${script}":`, 'package.json scripts');
  }
  requireIncludes(failures, pkg, 'pnpm check:e2e', "package.json's verify chain (check:e2e must run)");

  return failures;
}

// --- Issue #6: Agent Execution Safety ---------------------------------------

function checkAgentSafetyContract() {
  const failures = [];
  const agents = read('AGENTS.md');

  requireIncludes(failures, agents, '## Agent Execution Safety', 'AGENTS.md');

  const requiredRules = [
    'Inspect before edit',
    'Preserve unrelated changes',
    'No unrelated file edits',
    'Smallest-change preference',
    'Git mutation boundaries',
    'No auto-commit/push',
    'Bounded retry',
    'Verify before completion',
    'Final diff inspection',
    "Escalate, don't weaken",
  ];
  for (const rule of requiredRules) {
    requireIncludes(failures, agents, rule, 'AGENTS.md § Agent Execution Safety');
  }

  // The specific, easy-to-silently-water-down details, not just the headings.
  requireIncludes(failures, agents, 'git reset', 'AGENTS.md (git mutation boundary list)');
  requireIncludes(failures, agents, "push --force", 'AGENTS.md (git mutation boundary list)');
  requireIncludes(failures, agents, 'commit --amend', 'AGENTS.md (git mutation boundary list)');
  requireIncludes(failures, agents, 'rebase', 'AGENTS.md (git mutation boundary list)');
  requireIncludes(failures, agents, '**3**', 'AGENTS.md (bounded-retry threshold must stay explicit)');
  requireIncludes(failures, agents, 'materially-equivalent', 'AGENTS.md (bounded-retry definition)');

  // Dedup regression check: these files should point back to AGENTS.md, not
  // re-carry their own copy of the rule (the exact failure mode this whole
  // feature existed to prevent — AGENTS.md's own "point at this file
  // instead" rule, applied to itself).
  const duplicationCheck = [
    ['CLAUDE.md', read('CLAUDE.md')],
    ['.claude/commands/fix-commit.md', read('.claude/commands/fix-commit.md')],
    ['.claude/skills/fe-fix-commit/SKILL.md', read('.claude/skills/fe-fix-commit/SKILL.md')],
  ];
  const regressedDuplicate = 'git commit --no-verify` on the developer';
  for (const [file, content] of duplicationCheck) {
    if (content.includes(regressedDuplicate)) {
      failures.push(`${file}: has regressed back to duplicating the rule instead of pointing at AGENTS.md`);
    }
    if (!content.includes('AGENTS.md')) {
      failures.push(`${file}: no longer references AGENTS.md at all`);
    }
  }

  // ai:sync drift is already `ai:check`'s job — this only confirms the
  // Cursor mirror still exists at all (not stale content, just presence).
  if (!existsSync(join(ROOT, '.cursor/commands/fix-commit.md'))) {
    failures.push('.cursor/commands/fix-commit.md is missing (run `pnpm ai:sync`)');
  }

  return failures;
}

// --- Issue #7: pnpm supply-chain hardening ----------------------------------

function checkSupplyChainContract() {
  const failures = [];

  if (!existsSync(join(ROOT, 'pnpm-workspace.yaml'))) {
    failures.push('pnpm-workspace.yaml is missing');
    return failures;
  }
  const workspace = read('pnpm-workspace.yaml');

  const releaseAgeMatch = /^minimumReleaseAge:\s*(\d+)\s*$/m.exec(workspace);
  if (!releaseAgeMatch) {
    failures.push('pnpm-workspace.yaml: minimumReleaseAge is missing or not a plain number of minutes');
  } else if (Number(releaseAgeMatch[1]) < 1440) {
    failures.push(
      `pnpm-workspace.yaml: minimumReleaseAge is ${releaseAgeMatch[1]} minutes — below pnpm 11's own 1440-minute (1-day) default, weaker than doing nothing`
    );
  }

  requireIncludes(failures, workspace, 'msw: true', 'pnpm-workspace.yaml (allowBuilds)');
  requireIncludes(failures, workspace, 'puppeteer: false', 'pnpm-workspace.yaml (allowBuilds — puppeteer must stay denied)');

  if (!existsSync(join(ROOT, '.github/dependabot.yml'))) {
    failures.push('.github/dependabot.yml is missing');
  } else {
    const dependabot = read('.github/dependabot.yml');
    requireIncludes(failures, dependabot, "package-ecosystem: 'npm'", '.github/dependabot.yml');
    requireIncludes(failures, dependabot, "package-ecosystem: 'github-actions'", '.github/dependabot.yml');
    requireIncludes(failures, dependabot, 'groups:', '.github/dependabot.yml (grouped minor/patch updates)');
    requireIncludes(failures, dependabot, "update-types: ['minor', 'patch']", '.github/dependabot.yml');
    if (dependabot.includes("'major'")) {
      failures.push('.github/dependabot.yml: a group now includes "major" — majors must stay ungrouped for individual review');
    }
  }

  const workflowFiles = ['.github/workflows/quality-gate.yml', '.github/workflows/react-doctor.yml'];
  const shaPinned = /^[^@]+@[0-9a-f]{40}$/;
  for (const file of workflowFiles) {
    if (!existsSync(join(ROOT, file))) {
      failures.push(`${file} is missing`);
      continue;
    }
    const content = read(file);
    // Fresh regex per file — a shared `g`-flagged regex retains `lastIndex`
    // across `.exec()` calls, which would silently skip every file after
    // the first once its `lastIndex` outruns the next (shorter) file.
    const usesLine = /^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm;
    let match;
    let foundAny = false;
    while ((match = usesLine.exec(content)) !== null) {
      foundAny = true;
      const ref = match[1];
      if (!shaPinned.test(ref)) {
        failures.push(`${file}: action ${JSON.stringify(ref)} is not SHA-pinned (expected owner/repo@<40-char-sha>)`);
      }
    }
    if (!foundAny) failures.push(`${file}: no "uses:" action references found — check the file wasn't emptied`);
  }

  return failures;
}

function main() {
  const checks = [
    ['Playwright browser-quality gate (Issue #5)', checkPlaywrightContract],
    ['Agent Execution Safety (Issue #6)', checkAgentSafetyContract],
    ['pnpm supply-chain hardening (Issue #7)', checkSupplyChainContract],
  ];

  let totalFailures = 0;
  for (const [label, check] of checks) {
    const failures = check();
    if (failures.length === 0) {
      console.log(`✓ ${label}`);
      continue;
    }
    totalFailures += failures.length;
    console.error(`✗ ${label} — ${failures.length} problem(s):`);
    for (const f of failures) console.error(`    - ${f}`);
  }

  if (totalFailures > 0) {
    console.error(`\n${totalFailures} hardening-contract violation(s). See scripts/checks/hardening-contract.mjs.\n`);
    process.exit(1);
  }

  console.log('\n✓ hardening-contract — all three features confirmed configured as documented.');
}

main();
