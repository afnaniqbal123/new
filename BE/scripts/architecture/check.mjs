#!/usr/bin/env node
/**
 * Architecture check — the boundary half of the quality gate.
 *
 * ESLint enforces how a file is written; this enforces how modules relate.
 * It follows the same ratchet the lint suppressions use: what already exists
 * is baselined and tolerated, anything new fails. The baseline can shrink and
 * never grows on its own, so legacy debt does not block unrelated work while
 * new debt cannot slip in beside it.
 *
 * Usage:
 *   node scripts/architecture/check.mjs            # check
 *   node scripts/architecture/check.mjs --update   # rewrite the baseline
 *
 * Rules and rationale: docs/architecture/module-architecture.md
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildGraph, readImports, REPO_ROOT } from './graph.mjs';
import { RULES } from './rules.mjs';

const BASELINE_PATH = join(REPO_ROOT, 'architecture-baseline.json');
const UPDATING = process.argv.includes('--update');
/**
 * Recording a *new* exception has to be a deliberate, visible act — otherwise
 * "the baseline only shrinks" is a slogan rather than a property. Without
 * this flag, `--update` may only remove entries that no longer occur.
 */
const ACCEPT_NEW = process.argv.includes('--accept-new');

const ESC = String.fromCharCode(27);
const bold = (s) => `${ESC}[1m${s}${ESC}[0m`;
const red = (s) => `${ESC}[31m${s}${ESC}[0m`;
const green = (s) => `${ESC}[32m${s}${ESC}[0m`;
const dim = (s) => `${ESC}[2m${s}${ESC}[0m`;

function loadBaseline({ tolerant = false } = {}) {
  if (!existsSync(BASELINE_PATH)) return { accepted: [] };

  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    if (!Array.isArray(parsed?.accepted)) {
      throw new TypeError('missing an "accepted" array');
    }
    return parsed;
  } catch (error) {
    // Regenerating is the documented cure for a corrupt baseline, so the
    // update path has to survive one. The check path fails closed instead: a
    // corrupt file must not silently become "no exceptions recorded".
    if (tolerant) {
      console.error(dim(`  Existing baseline unreadable (${error.message}).`));
      // `unreadable` is what stops the growth guard from firing on every
      // violation at once: with nothing to compare against, "new" is not a
      // question this run can answer, so it restores the file to current
      // reality rather than demanding blanket acceptance.
      return { accepted: [], unreadable: true };
    }

    console.error(red(`\n  Cannot read ${BASELINE_PATH}: ${error.message}\n`));
    console.error(
      dim(
        '  Restore it from git, or regenerate: pnpm run architecture:baseline\n',
      ),
    );
    process.exit(1);
  }
}

function collectViolations() {
  // `buildGraph()` already walked the tree and returned `files`; walking it a
  // second time here just to overwrite that list was pure waste.
  const graph = buildGraph();
  const context = {
    ...graph,
    readImports,
    readFile: (file) => readFileSync(join(REPO_ROOT, file), 'utf8'),
  };
  return RULES.flatMap((rule) => rule.run(context));
}

const violations = collectViolations();
const baseline = loadBaseline({ tolerant: UPDATING });
const accepted = new Set(baseline.accepted.map((entry) => entry.key));

if (UPDATING) {
  const additions = baseline.unreadable
    ? []
    : violations.filter((v) => !accepted.has(v.key));

  if (baseline.unreadable) {
    console.error(
      dim(
        '  Rebuilding it from the current state. Check the result into git and\n' +
          '  compare it against the previous version before trusting it.\n',
      ),
    );
  }

  if (additions.length > 0 && !ACCEPT_NEW) {
    console.error(`\n  ${bold('Baseline not updated')}\n`);
    console.error(
      red(
        `  ${additions.length} violation(s) are not in the baseline. Regenerating\n` +
          '  would bless them silently, so this refuses.\n',
      ),
    );
    for (const addition of additions) {
      console.error(`    ${addition.rule}  ${addition.detail}`);
    }
    console.error(
      dim(
        '\n  Fix them, or — if one is a deliberate architectural decision —\n' +
          '  document it in docs/architecture/module-architecture.md and re-run with:\n' +
          '      node scripts/architecture/check.mjs --update --accept-new\n',
      ),
    );
    process.exit(1);
  }

  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        $comment:
          'Architecture debt that predates the check. This list may shrink, never grow — see docs/architecture/module-architecture.md. Regenerate with: pnpm run architecture:baseline',
        accepted: [
          ...new Map(
            violations.map((v) => [
              v.key,
              { key: v.key, rule: v.rule, detail: v.detail },
            ]),
          ).values(),
        ].sort((a, b) => a.key.localeCompare(b.key)),
      },
      null,
      2,
    )}\n`,
  );
  const removed = accepted.size + additions.length - violations.length;
  console.log(
    green(`Baseline written with ${violations.length} accepted entries.`),
  );
  if (removed > 0) {
    console.log(dim(`  ${removed} resolved entr(ies) removed.`));
  }
  if (additions.length > 0) {
    console.log(
      dim(`  ${additions.length} new exception(s) accepted explicitly.`),
    );
  }
  process.exit(0);
}

const fresh = violations.filter((v) => !accepted.has(v.key));
const stillPresent = new Set(violations.map((v) => v.key));
const resolved = [...accepted].filter((key) => !stillPresent.has(key));

if (fresh.length === 0) {
  console.log(green('Architecture check passed.'));
  if (accepted.size > 0) {
    console.log(
      dim(
        `  ${accepted.size} known exception(s) baselined — see architecture-baseline.json`,
      ),
    );
  }
  if (resolved.length > 0) {
    console.log(
      dim(
        `  ${resolved.length} baselined item(s) no longer occur. Shrink the baseline: pnpm run architecture:baseline`,
      ),
    );
  }
  process.exit(0);
}

console.error(`\n  ${bold('Architecture check')}\n`);
console.error(red(`  ${fresh.length} new boundary violation(s).\n`));

for (const v of fresh) {
  console.error(`  ${red('x')} ${bold(v.rule)}  ${v.detail}`);
  if (v.path) console.error(dim(v.path));
  console.error(`    ${dim('->')} ${v.expected}\n`);
}

console.error(
  dim(
    '  These are new. If one is a deliberate architectural decision, document\n' +
      '  it in docs/architecture/module-architecture.md and record it with:\n' +
      '      pnpm run architecture:baseline\n',
  ),
);

process.exit(1);
