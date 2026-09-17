#!/usr/bin/env node
/**
 * Pre-commit quality gate.
 *
 * Runs four stages against the staged snapshot and blocks the commit if any of
 * them fail:
 *
 *   1. Guard rails   secrets, .env files, build output, conflict markers
 *   2. Auto-fix+lint eslint --fix / prettier --write, then the strict lint gate
 *   3. Type safety   tsc --noEmit across the project
 *   4. Structure     file naming and per-module documentation
 *
 * Design notes:
 * - Stages 1 and 4 read the git index, so the gate validates exactly what is
 *   about to be committed.
 * - Stage 2 mutates and re-stages files; everything else is read-only.
 * - Stages run sequentially on purpose: lint-staged stashes unstaged changes,
 *   so a concurrent `tsc` would type-check an inconsistent working tree.
 * - Every stage runs even after one fails, so the developer sees the complete
 *   list of problems in a single pass instead of playing whack-a-mole.
 *
 * Usage:
 *   node scripts/hooks/pre-commit.mjs          # staged files (git hook)
 *   node scripts/hooks/pre-commit.mjs --all    # whole repo (pnpm run verify)
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import {
  REPO_ROOT,
  addedFiles,
  filterTypeScript,
  stagedFiles,
} from './lib/git.mjs';
import {
  banner,
  color,
  duration,
  finding,
  line,
  section,
  step,
} from './lib/ui.mjs';
import { run as runGuard } from './checks/repo-guard.mjs';
import { run as runStructure } from './checks/structure.mjs';
import { runner, packageManager } from './lib/pm.mjs';

const REPORT_DIR = path.join(REPO_ROOT, '.git', 'quality-gate');
const PM = packageManager();
const REPORT_FILE = path.join(REPORT_DIR, 'last-failure.json');

const ALL_MODE = process.argv.includes('--all');

/** Rebases and merges replay existing work; gating them blocks conflict fixes. */
function isReplayInProgress() {
  return [
    'rebase-merge',
    'rebase-apply',
    'CHERRY_PICK_HEAD',
    'MERGE_HEAD',
  ].some((marker) => fs.existsSync(path.join(REPO_ROOT, '.git', marker)));
}

function exec(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      // Nested tools lose the TTY behind our pipe; keep their output readable.
      FORCE_COLOR: process.stdout.isTTY
        ? '1'
        : (process.env.FORCE_COLOR ?? '0'),
    },
    ...options,
  });
}

/** Parse `tsc --noEmit` output into structured findings. */
function parseTypeErrors(output) {
  const findings = [];
  const pattern = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/;

  for (const text of output.split('\n')) {
    const match = text.match(pattern);
    if (!match) continue;
    const [, file, lineNo, column, code, message] = match;

    findings.push({
      file: path.relative(REPO_ROOT, path.resolve(REPO_ROOT, file)),
      line: Number(lineNo),
      column: Number(column),
      message: `${message} ${color.gray(`(${code})`)}`,
    });
  }

  return findings;
}

function main() {
  if (isReplayInProgress()) {
    line(color.gray('  Quality gate skipped — merge/rebase in progress.'));
    return 0;
  }

  const staged = ALL_MODE ? [] : stagedFiles();
  const added = ALL_MODE ? [] : addedFiles();

  if (!ALL_MODE && staged.length === 0) {
    line(color.gray('  Nothing staged — quality gate skipped.'));
    return 0;
  }

  const stagedTs = filterTypeScript(staged);
  const scope = ALL_MODE
    ? 'whole repository'
    : `${staged.length} staged file${staged.length === 1 ? '' : 's'}`;

  line();
  line(`  ${color.bold('Quality gate')} ${color.gray(`· ${scope}`)}`);
  line();

  /** @type {Array<{title: string, findings: Array<object>, raw?: string}>} */
  const failures = [];

  // ── Stage 1 · Guard rails ────────────────────────────────────────────────
  {
    const started = Date.now();
    const { findings } = ALL_MODE ? { findings: [] } : runGuard({ staged });
    const took = duration(Date.now() - started);

    if (findings.length > 0) {
      failures.push({ title: 'Must never be committed', findings });
      step('fail', 'Guard rails', `${findings.length} blocked · ${took}`);
    } else {
      step(
        ALL_MODE ? 'skip' : 'pass',
        'Guard rails',
        ALL_MODE ? 'staged-only' : took,
      );
    }
  }

  // ── Stage 2 · Auto-fix and lint ──────────────────────────────────────────
  {
    const started = Date.now();
    let result;

    if (ALL_MODE) {
      // Only the roots that exist. ESLint treats a glob matching nothing as an
      // error, so hard-coding `test/**` fails the whole stage in a project that
      // simply keeps its tests beside the source.
      const roots = ['src', 'test']
        .filter((d) => fs.existsSync(path.join(REPO_ROOT, d)))
        .map((d) => `${d}/**/*.ts`);
      result = exec(
        ...runner('eslint', [
          ...roots,
          '--max-warnings=0',
          '--pass-on-unpruned-suppressions',
          '--format',
          './scripts/hooks/eslint-reporter.mjs',
        ]),
      );
    } else if (
      stagedTs.length === 0 &&
      !staged.some((f) => /\.(js|mjs|cjs|json|md|ya?ml)$/.test(f))
    ) {
      result = { status: 0, stdout: '', stderr: '' };
    } else {
      result = exec(...runner('lint-staged', ['--quiet', '--relative']));
    }

    const took = duration(Date.now() - started);

    if (result.status !== 0) {
      const raw = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
      failures.push({ title: 'Code quality & conventions', findings: [], raw });
      step('fail', 'Lint & conventions', took);
    } else {
      step(
        'pass',
        'Lint & conventions',
        ALL_MODE ? `check only · ${took}` : `auto-fixed & re-staged · ${took}`,
      );
    }
  }

  // ── Stage 3 · Type safety ────────────────────────────────────────────────
  {
    const started = Date.now();
    const result = exec(...runner('tsc', ['--noEmit', '-p', 'tsconfig.json']));
    const took = duration(Date.now() - started);

    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      const findings = parseTypeErrors(output);
      failures.push({
        title: 'Type errors',
        findings,
        raw: findings.length === 0 ? output.trim() : undefined,
      });
      step(
        'fail',
        'Type safety',
        `${findings.length || '?'} error(s) · ${took}`,
      );
    } else {
      step('pass', 'Type safety', took);
    }
  }

  // ── Stage 4 · Structure ──────────────────────────────────────────────────
  {
    const started = Date.now();
    const { findings } = ALL_MODE ? { findings: [] } : runStructure({ added });
    const took = duration(Date.now() - started);

    if (findings.length > 0) {
      failures.push({ title: 'Project structure', findings });
      step(
        'fail',
        'Structure & naming',
        `${findings.length} issue(s) · ${took}`,
      );
    } else {
      step(
        ALL_MODE ? 'skip' : 'pass',
        'Structure & naming',
        ALL_MODE ? 'new files only' : took,
      );
    }
  }

  // ── Stage 5 · Architecture ───────────────────────────────────────────────
  // Module boundaries rather than file contents: dependency cycles, foreign
  // schema reads, provider-SDK leakage. Ratcheted against
  // architecture-baseline.json — see docs/architecture/module-architecture.md.
  {
    const started = Date.now();
    const result = exec('node', ['scripts/architecture/check.mjs']);
    const took = duration(Date.now() - started);

    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      failures.push({
        title: 'Architecture boundaries',
        findings: [],
        raw: output.trim(),
      });
      step('fail', 'Architecture boundaries', took);
    } else {
      step('pass', 'Architecture boundaries', took);
    }
  }

  // ── Stage 6 · Documentation ──────────────────────────────────────────────
  // Links, Mermaid, ADR structure, architecture index. Facts only — it has no
  // opinion about prose. See .claude/skills/architecture-documentation/.
  {
    const started = Date.now();
    const result = exec('node', ['scripts/docs/check.mjs']);
    const took = duration(Date.now() - started);

    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      failures.push({
        title: 'Documentation',
        findings: [],
        raw: output.trim(),
      });
      step('fail', 'Documentation', took);
    } else {
      step('pass', 'Documentation', took);
    }
  }

  // ── Verdict ──────────────────────────────────────────────────────────────
  if (failures.length === 0) {
    banner(
      'Quality gate passed',
      ALL_MODE ? 'The repository meets every standard.' : 'Committing.',
      'green',
    );
    clearReport();
    return 0;
  }

  const total = failures.reduce((sum, f) => sum + (f.findings.length || 1), 0);
  banner(
    'COMMIT BLOCKED',
    `${total} issue${total === 1 ? '' : 's'} must be resolved before this can be committed.`,
    'red',
  );

  for (const failure of failures) {
    if (failure.findings.length > 0) {
      section(failure.title, failure.findings.length);
      for (const item of failure.findings) finding(item);
    } else if (failure.raw) {
      section(failure.title, 'see below');
      line(failure.raw);
      line();
    }
  }

  writeReport(failures);

  line(color.gray('  ─'.repeat(32)));
  line();
  line(
    `  ${color.bold('Fix it automatically')} — let Claude apply the project conventions:`,
  );
  line();
  line(`      ${color.cyan(color.bold('claude "/fix-commit"'))}`);
  line();
  line(`  ${color.bold('Or fix it yourself')}:`);
  line(
    `      ${color.gray(`${PM} run lint`)}        ${color.gray('# auto-fix formatting and simple rules')}`,
  );
  line(
    `      ${color.gray(`${PM} run typecheck`)}   ${color.gray('# list every type error')}`,
  );
  line(
    `      ${color.gray(`${PM} run verify`)}      ${color.gray('# re-run this gate across the repo')}`,
  );
  line();
  line(
    color.gray(
      '  Conventions live in .claude/skills/best-practices/ — each finding links to the relevant page.',
    ),
  );
  line();

  return 1;
}

function writeReport(failures) {
  try {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(
      REPORT_FILE,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), failures },
        null,
        2,
      ),
    );
  } catch {
    // A report is a convenience for /fix-commit; never fail the hook over it.
  }
}

function clearReport() {
  try {
    fs.rmSync(REPORT_FILE, { force: true });
  } catch {
    /* ignore */
  }
}

process.exit(main());
