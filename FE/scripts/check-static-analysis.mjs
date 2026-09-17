#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';

const REQUIRED_RULES = [
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/ban-ts-comment',
  '@typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/no-floating-promises',
  '@typescript-eslint/no-misused-promises',
  '@typescript-eslint/await-thenable',
  'react-hooks/rules-of-hooks',
  'react-hooks/exhaustive-deps',
  'react/display-name',
  'react/no-unescaped-entities',
  'react-refresh/only-export-components',
];

const REQUIRED_TS_OPTIONS = [
  'strict',
  'useUnknownInCatchVariables',
  'exactOptionalPropertyTypes',
  'noImplicitReturns',
  'noUncheckedIndexedAccess',
  'noPropertyAccessFromIndexSignature',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readCompilerOptions(path) {
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  return parsed.compilerOptions ?? {};
}

const eslint = new ESLint();
const config = await eslint.calculateConfigForFile('src/components/common/Button.tsx');

for (const rule of REQUIRED_RULES) {
  const entry = config.rules?.[rule];
  assert(entry, `Missing critical ESLint rule: ${rule}`);
  assert(entry[0] === 2, `Critical ESLint rule must be error-level: ${rule}`);
}

assert(config.linterOptions?.noInlineConfig === true, 'ESLint inline config must stay disabled');

for (const path of ['tsconfig.app.json', 'tsconfig.node.json']) {
  const options = await readCompilerOptions(path);
  for (const option of REQUIRED_TS_OPTIONS) {
    assert(options[option] === true, `${path} must keep compilerOptions.${option}=true`);
  }
}

console.log('Static-analysis contract passed.');
