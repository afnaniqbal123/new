#!/usr/bin/env node
/**
 * Technical-debt report.
 *
 * `eslint-suppressions.json` records the convention violations that already
 * existed when the gate was introduced. New code is held to the full standard;
 * this script shows what is left of the old backlog so it can be paid down
 * deliberately rather than forgotten.
 *
 *   pnpm run debt
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { REPO_ROOT } from './lib/git.mjs';
import { color, line } from './lib/ui.mjs';
import { RULE_GUIDANCE } from '../../tools/eslint-rules/guidance.mjs';

const SUPPRESSIONS = path.join(REPO_ROOT, 'eslint-suppressions.json');

if (!fs.existsSync(SUPPRESSIONS)) {
  line(
    color.green('  No suppressions file — the codebase is fully compliant.'),
  );
  process.exit(0);
}

/** @type {Record<string, Record<string, {count: number}>>} */
const data = JSON.parse(fs.readFileSync(SUPPRESSIONS, 'utf8'));

const byRule = new Map();
let total = 0;

for (const [file, rules] of Object.entries(data)) {
  for (const [rule, entry] of Object.entries(rules)) {
    const count = entry?.count ?? 0;
    total += count;

    if (!byRule.has(rule)) byRule.set(rule, { count: 0, files: new Set() });
    const bucket = byRule.get(rule);
    bucket.count += count;
    bucket.files.add(file);
  }
}

const ranked = [...byRule.entries()].sort((a, b) => b[1].count - a[1].count);

line();
line(
  `  ${color.bold('Convention debt')} ${color.gray(`· ${total} suppressed violation(s)`)}`,
);
line(
  color.gray(
    '  These pre-date the quality gate. New code must be clean; this list can only shrink.',
  ),
);
line();

for (const [rule, { count, files }] of ranked) {
  const isConvention = rule.startsWith('nestjs/');
  const label = isConvention ? color.magenta(rule) : color.yellow(rule);
  line(
    `  ${String(count).padStart(4)}  ${label} ${color.gray(`in ${files.size} file(s)`)}`,
  );

  const docs = RULE_GUIDANCE[rule];
  if (docs) line(color.gray(`        ${docs}`));
}

line();
line(`  ${color.bold('Pay some down')}`);
line(
  color.gray(
    '      claude "/fix-commit --debt <rule>"   let Claude fix one rule across the repo',
  ),
);
line(
  color.gray(
    '      pnpm run lint:baseline:prune          drop suppressions you have already fixed',
  ),
);
line();
