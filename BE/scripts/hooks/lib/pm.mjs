/**
 * Resolve a locally installed CLI without going through a package manager.
 *
 * The hooks used to shell out to `pnpm exec <tool>`. That works only where pnpm
 * itself is installed, which is not a safe assumption once this toolkit is
 * exported into a project that uses npm or yarn — and the failure is confusing,
 * because it reports a missing package manager rather than the real problem.
 *
 * Every package manager's `exec` ultimately runs the binary in
 * `node_modules/.bin`, so calling that path directly is both simpler and
 * portable. `npx --no-install` is the fallback, kept deliberately offline so a
 * missing dependency stays a missing dependency instead of silently becoming a
 * download.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { REPO_ROOT } from './git.mjs';

/** Absolute path to a binary in node_modules/.bin, or null when absent. */
export function localBin(name, repoRoot = REPO_ROOT) {
  const file = process.platform === 'win32' ? `${name}.cmd` : name;
  const bin = path.join(repoRoot, 'node_modules', '.bin', file);
  return existsSync(bin) ? bin : null;
}

/**
 * A `[command, args]` pair ready to spread into spawnSync:
 *
 *   spawnSync(...runner('eslint', ['--fix', file]), { cwd })
 */
export function runner(name, args = [], repoRoot = REPO_ROOT) {
  const bin = localBin(name, repoRoot);
  return bin ? [bin, args] : ['npx', ['--no-install', name, ...args]];
}

/** The package manager this repo is installed with, for use in help text. */
export function packageManager(repoRoot = REPO_ROOT) {
  for (const [lockfile, pm] of [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
  ]) {
    if (existsSync(path.join(repoRoot, lockfile))) return pm;
  }
  return 'npm';
}
