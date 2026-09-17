#!/usr/bin/env node
/**
 * Commit message gate.
 *
 * Wraps commitlint so a rejected message explains the Conventional Commits
 * format with working examples, instead of printing rule ids the developer has
 * to go and look up.
 */
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import { REPO_ROOT } from './lib/git.mjs';
import { banner, color, line } from './lib/ui.mjs';
import { runner } from './lib/pm.mjs';

const messageFile = process.argv[2];

if (!messageFile) {
  line(color.red('  commit-msg hook called without a message file.'));
  process.exit(1);
}

const result = spawnSync(...runner('commitlint', ['--edit', messageFile]), {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});

if (result.status === 0) process.exit(0);

banner(
  'COMMIT MESSAGE REJECTED',
  'Your changes are safe and still staged — only the message needs fixing.',
  'red',
);

line(`${result.stdout ?? ''}${result.stderr ?? ''}`.trim());
line();
line(`  ${color.bold('Required format')}`);
line();
line(`      ${color.cyan('<type>(<scope>): <subject>')}`);
line();
line(`  ${color.bold('Types you can use')}`);
line(
  color.gray(
    '      feat      a new feature            fix       a bug fix\n' +
      '      refactor  restructured code        perf      a performance improvement\n' +
      '      test      tests only               docs      documentation only\n' +
      '      chore     tooling / deps           style     formatting only\n' +
      '      build     build system             ci        CI configuration',
  ),
);
line();
line(`  ${color.bold('Good examples')}`);
line(color.green('      feat(auth): add refresh token rotation'));
line(color.green('      fix(chat): stop duplicate messages on reconnect'));
line(color.green('      chore(deps): bump mongoose to 8.19'));
line();
line(`  ${color.bold('Common mistakes')}`);
line(
  color.gray(
    '      · Subject must be lower-case and must not end with a period.',
  ),
);
line(color.gray('      · Keep the subject under 72 characters.'));
line(
  color.gray(
    '      · Leave a blank line between the subject and any body text.',
  ),
);
line();
line(
  `  ${color.gray('Retry with:')} ${color.cyan('git commit -m "feat(scope): what changed"')}`,
);
line();

process.exit(1);
