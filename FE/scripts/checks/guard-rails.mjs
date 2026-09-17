#!/usr/bin/env node
/**
 * Guard Rails check — static content scan for what ESLint/TypeScript cannot
 * see: secrets, merge markers, and oversized files. There is no CLI tool for
 * this (unlike lint/a11y/style/doctor, which all natively accept a file-list),
 * so this is the one shared function referenced by AGENTS.md: one rule set,
 * two scopes.
 *
 *   - `pnpm check:guardrails` (this file, run directly) scans every
 *     production file under src/.
 *   - `scripts/hooks/pre-commit.mjs` imports `guardRails()` and calls it with
 *     just the staged files, for commit speed.
 *
 * Three regex checks that used to live here were removed because ESLint
 * (`eslint.config.js`) already enforces the identical thing, more reliably
 * (AST-based, not regex) and with the same file-scope exemptions:
 *   - `no-console`   → ESLint's own `no-console: 'error'` (off in src/mocks/,
 *                      exactly like this file's old production-src filter).
 *   - `no-as-any`    → `@typescript-eslint/no-explicit-any: 'error'` bans
 *                      every use of `any`, a strict superset of the old
 *                      `as any`-only regex.
 *   - `no-ts-ignore` → `@typescript-eslint/ban-ts-comment` is configured with
 *                      `{ 'ts-expect-error': true, 'ts-ignore': true,
 *                      'ts-nocheck': true }`, matching this file's old
 *                      unconditional ban (the rule's default allows
 *                      `@ts-expect-error` with a description; that default
 *                      was overridden specifically so ESLint fully replaces
 *                      this check — see eslint.config.js's comment there).
 * `no-eslint-disable`, `no-secret`, and the file-size limit stay: none of
 * them has an ESLint/TypeScript equivalent (there's no rule that bans its
 * own disable-comments, and secrets/file-size aren't lint concerns at all).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const MAX_FILE_LINES = 500;

export const GUARD_PATTERNS = [
  { rule: 'no-merge-marker', re: /^(<{7}|={7}|>{7})(\s|$)/, message: 'unresolved merge conflict marker' },
  { rule: 'no-eslint-disable', re: /eslint-disable/, message: 'eslint-disable is banned — fix the code, not the check' },
  { rule: 'no-secret', re: /(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(api|secret|access)[_-]?key\s*[:=]\s*['"][^'"]{12,}['"])/i, message: 'possible hardcoded secret — move it to .env' },
];

// Mocks/scaffolding are excluded because console/etc. are legitimate there.
export function isProductionSrcFile(file) {
  return /^src\/.*\.(ts|tsx)$/.test(file) && !/\.stories\.tsx?$/.test(file) && !file.startsWith('src/mocks/');
}

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile()) {
      out.push(relative(process.cwd(), full));
    }
  }
  return out;
}

export function allProductionSrcFiles() {
  return walk('src', []).filter(isProductionSrcFile);
}

/** Scans the given files and returns a list of violations (does not mutate anything). */
export function guardRails(files) {
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    if (lines.length > MAX_FILE_LINES) {
      violations.push({ file, line: lines.length, rule: 'max-file-lines', message: `file has ${lines.length} lines (max ${MAX_FILE_LINES}) — split it up` });
    }

    lines.forEach((text, index) => {
      for (const { rule, re, message } of GUARD_PATTERNS) {
        if (re.test(text)) {
          violations.push({ file, line: index + 1, rule, message });
        }
      }
    });
  }

  return violations;
}

export function formatViolation(v) {
  return `  ✗ ${v.file}:${v.line}  [${v.rule}] ${v.message}`;
}

// CLI entrypoint: full-repo scan when run directly (`pnpm check:guardrails`).
if (import.meta.url === `file://${process.argv[1]}`) {
  const files = allProductionSrcFiles();
  const violations = guardRails(files);

  if (violations.length > 0) {
    console.error('\n\u{1F6D1} Guard Rails violations:\n');
    for (const v of violations) console.error(formatViolation(v));
    console.error(`\n${violations.length} violation(s) found.\n`);
    process.exit(1);
  }

  console.log(`✓ Guard Rails — no violations (${files.length} files scanned).`);
}
