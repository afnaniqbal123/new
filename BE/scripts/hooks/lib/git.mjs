/**
 * Git plumbing used by the hooks. Everything here reads the *index*, not the
 * working tree, so the gate validates exactly what is about to be committed.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
}

/**
 * Files staged for commit.
 * `--diff-filter=ACMR` excludes deletions, which cannot be linted.
 */
export function stagedFiles() {
  const head = hasCommits() ? ['HEAD'] : [];
  const output = git([
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
    ...head,
  ]);

  return output
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Files touched by the most recent commit — used by the post-commit hook. */
export function committedFiles() {
  if (!hasCommits()) return [];

  const isFirstCommit = (() => {
    try {
      git(['rev-parse', 'HEAD~1'], { stdio: ['ignore', 'pipe', 'ignore'] });
      return false;
    } catch {
      return true;
    }
  })();

  const args = isFirstCommit
    ? ['show', '--name-only', '--pretty=format:', '--diff-filter=ACMR', 'HEAD']
    : ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD~1', 'HEAD'];

  return git(args)
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Files newly added in this commit. Rules that would punish developers for
 * pre-existing debt are scoped to these, so touching a legacy file never
 * blocks work that is unrelated to it.
 */
export function addedFiles() {
  const head = hasCommits() ? ['HEAD'] : [];
  const output = git([
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=A',
    ...head,
  ]);
  return output
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Does this repository have at least one commit yet? */
export function hasCommits() {
  try {
    git(['rev-parse', '--verify', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/** Staged content of a file, as it will be committed. */
export function stagedContent(file) {
  try {
    return git(['show', `:${file}`]);
  } catch {
    return '';
  }
}

/** Size in bytes of a file's staged blob. */
export function stagedSize(file) {
  try {
    return Number(git(['cat-file', '-s', `:${file}`]).trim());
  } catch {
    return 0;
  }
}

/** Is the file text (as opposed to a binary blob git refuses to diff)? */
export function isTextFile(file) {
  return !/\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|gz|tar|mp4|mov|woff2?|ttf|eot|hbs)$/i.test(
    file,
  );
}

export function filterTypeScript(files) {
  return files.filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
}
