#!/usr/bin/env node
/**
 * Regression test for the two strongest layers of the enforcement hierarchy
 * this repo relies on (AGENTS.md § The Quality Gate): ESLint (eslint.config.js)
 * and the TypeScript compiler (tsconfig.*.json). Asserts that the specific
 * rules/options the repo's strictness bar depends on haven't silently
 * regressed to a weaker default — the failure mode this guards against is
 * someone downgrading a rule (or a compiler option) to make a red CI run
 * green, instead of fixing the code that tripped it.
 *
 * Run via `pnpm check:lint-contract`; part of `pnpm verify`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';

const ROOT = process.cwd();

// Rules escalated from the maintained presets' own defaults per AGENTS.md §
// The Quality Gate — these must be 'error'. The only way one may sit at
// 'warn' instead is a matching entry in DOCUMENTED_WARN_EXCEPTIONS below.
const REQUIRED_ERROR_RULES = [
  'react-hooks/exhaustive-deps',
  '@typescript-eslint/no-floating-promises',
  '@typescript-eslint/no-misused-promises',
  '@typescript-eslint/await-thenable',
  'react/display-name',
  'react/no-unescaped-entities',
  'react-refresh/only-export-components',
];

// A rule from REQUIRED_ERROR_RULES that's deliberately left at 'warn', mapped
// to why. Empty today — every rule above is 'error' in this repo. Before
// downgrading any of them in eslint.config.js, add an entry here explaining
// the specific false-positive class first (see AGENTS.md § The Quality Gate's
// "genuine false positive" guidance) — this script fails otherwise.
const DOCUMENTED_WARN_EXCEPTIONS = new Map([
  // Example shape: ['rule-name', 'why it is a genuine false positive here'],
]);

// react-refresh/only-export-components only applies under src/components/**/*.tsx
// (see eslint.config.js) — every other rule above applies to any .tsx/.ts file.
const SAMPLE_FILE_FOR_RULE = {
  'react-refresh/only-export-components': 'src/components/common/Button.tsx',
};
const DEFAULT_SAMPLE_FILE = 'src/main.tsx';

// Compiler options that must be `true` in both TS projects — the app project
// and the node-tooling project (vite.config.ts, doctor.config.ts, scripts/)
// are expected to carry the same strictness bar (AGENTS.md § The Quality Gate).
const REQUIRED_TRUE_COMPILER_OPTIONS = [
  'strict',
  'noUnusedLocals',
  'noUnusedParameters',
  'noImplicitReturns',
  'noFallthroughCasesInSwitch',
  'noUncheckedIndexedAccess',
  'noUncheckedSideEffectImports',
  'exactOptionalPropertyTypes',
  'noPropertyAccessFromIndexSignature',
];
const TSCONFIG_FILES = ['tsconfig.app.json', 'tsconfig.node.json'];

async function checkEslintRules() {
  const eslint = new ESLint({ cwd: ROOT });
  const failures = [];

  for (const rule of REQUIRED_ERROR_RULES) {
    const file = SAMPLE_FILE_FOR_RULE[rule] ?? DEFAULT_SAMPLE_FILE;
    const config = await eslint.calculateConfigForFile(file);
    const entry = config.rules?.[rule];
    const severity = Array.isArray(entry) ? entry[0] : entry;
    const isError = severity === 'error' || severity === 2;
    const isWarn = severity === 'warn' || severity === 1;
    const exceptionReason = DOCUMENTED_WARN_EXCEPTIONS.get(rule);

    if (isError) continue;
    if (isWarn && exceptionReason) continue;

    if (isWarn && !exceptionReason) {
      failures.push(
        `${rule}: is 'warn' but has no entry in DOCUMENTED_WARN_EXCEPTIONS — either restore ` +
          `'error' or document why it's a genuine false positive here (checked against ${file})`
      );
      continue;
    }

    failures.push(`${rule}: expected 'error' (checked against ${file}), got ${JSON.stringify(entry)}`);
  }

  return failures;
}

function checkTsconfigOptions() {
  const failures = [];

  for (const file of TSCONFIG_FILES) {
    const raw = readFileSync(join(ROOT, file), 'utf8');
    const json = JSON.parse(raw);
    const compilerOptions = json.compilerOptions ?? {};

    for (const option of REQUIRED_TRUE_COMPILER_OPTIONS) {
      if (compilerOptions[option] !== true) {
        failures.push(
          `${file}: compilerOptions.${option} must be true, got ${JSON.stringify(compilerOptions[option])}`
        );
      }
    }
  }

  return failures;
}

async function main() {
  const failures = [...(await checkEslintRules()), ...checkTsconfigOptions()];

  if (failures.length > 0) {
    console.error('\n\u{1F6D1} Lint/type config-contract violations:\n');
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error(`\n${failures.length} violation(s). See AGENTS.md § The Quality Gate.\n`);
    process.exit(1);
  }

  const ruleCount = REQUIRED_ERROR_RULES.length;
  const optionCount = REQUIRED_TRUE_COMPILER_OPTIONS.length * TSCONFIG_FILES.length;
  console.log(`✓ Lint/type config contract — ${ruleCount} ESLint rule(s), ${optionCount} compiler option(s) confirmed.`);
}

main();
