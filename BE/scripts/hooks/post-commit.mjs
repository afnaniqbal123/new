#!/usr/bin/env node
/**
 * Post-commit test run.
 *
 * Tests run *after* the commit rather than inside the gate on purpose: the
 * commit is a local checkpoint, and making every checkpoint wait on Jest is
 * what pushes people towards `--no-verify`. Running here keeps commits instant
 * while still telling you, within seconds, if you broke something.
 *
 * Only tests related to the committed files run — `jest --findRelatedTests`
 * walks the import graph, so a change to `user.service.ts` runs the specs that
 * import it, and nothing else.
 *
 * Git ignores this hook's exit code, so a failure here reports loudly but
 * never rewrites or rejects the commit you just made.
 */
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import { REPO_ROOT, committedFiles, filterTypeScript } from './lib/git.mjs';
import { banner, color, duration, line } from './lib/ui.mjs';
import { runner } from './lib/pm.mjs';

/** Files whose behaviour is expected to be covered by a unit test. */
const TESTABLE = /\.(service|controller|gateway|guard|util|strategy)\.ts$/;

function main() {
  const committed = committedFiles();
  const sources = filterTypeScript(committed).filter(
    (f) => f.startsWith('src/') && !/\.(spec|e2e-spec)\.ts$/.test(f),
  );

  if (sources.length === 0) return;

  const started = Date.now();
  const result = spawnSync(
    ...runner('jest', [
      '--findRelatedTests',
      ...sources,
      '--passWithNoTests',
      '--silent',
      '--bail',
      '--colors',
    ]),
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: process.stdout.isTTY ? '1' : '0' },
    },
  );

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const took = duration(Date.now() - started);

  if (result.status === 0) {
    const ran = /Tests:\s+(\d+)/.exec(output);
    const suites = /Test Suites:.*?(\d+) total/.exec(output);

    if (!suites || suites[1] === '0') {
      const untested = sources.filter((f) => TESTABLE.test(f));
      if (untested.length > 0) {
        line();
        line(
          `  ${color.yellow('!')} ${color.bold('No tests cover this change.')} ${color.gray(`(${took})`)}`,
        );
        for (const file of untested.slice(0, 5)) {
          line(color.gray(`      ${file}`));
        }
        if (untested.length > 5) {
          line(color.gray(`      …and ${untested.length - 5} more`));
        }
        line(
          color.gray(
            '      Unit tests live beside the file they test, as <name>.spec.ts — see .claude/skills/best-practices/references/testing-tooling.md',
          ),
        );
        line();
      }
      return;
    }

    line();
    line(
      `  ${color.green('✔')} ${color.bold('Related tests passed')} ${color.gray(
        `· ${ran ? `${ran[1]} test(s)` : 'all'} in ${took}`,
      )}`,
    );
    line();
    return;
  }

  banner(
    'TESTS FAILING ON THE COMMIT YOU JUST MADE',
    `Ran in ${took}. The commit was created — it is not lost.`,
    'red',
  );
  line(output.trim());
  line();
  line(`  ${color.bold('Fix it automatically')}:`);
  line();
  line(`      ${color.cyan(color.bold('claude "/fix-commit"'))}`);
  line();
  line(`  ${color.bold('Then fold the fix into the same commit')}:`);
  line(`      ${color.gray('git add -A && git commit --amend --no-edit')}`);
  line();
  line(color.gray('  Do not push until this is green.'));
  line();
}

main();
