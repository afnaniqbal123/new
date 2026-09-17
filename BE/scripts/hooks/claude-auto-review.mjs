#!/usr/bin/env node
/**
 * Claude Code Stop hook — automatic two-axis code review.
 *
 * The pre-commit gate catches everything a tool can check: lint, conventions,
 * types, structure. What it cannot catch is design — a module that follows
 * every rule and is still shaped wrong, or code that does something other than
 * what the issue asked for. That is the `code-review` skill's job, and until
 * now it only ran when somebody remembered to type it.
 *
 * This hook fires when Claude tries to end a turn, measures how much of
 * `src/**` changed since the review baseline, and blocks the turn if the change
 * is substantial enough to deserve a review. Claude then runs the skill and
 * reports before it is allowed to finish.
 *
 * Deliberately quiet on small work: a one-line fix should not spawn two
 * sub-agents. See THRESHOLD_* below.
 *
 * Wired up via .claude/settings.json -> hooks.Stop.
 * Escape hatch: CLAUDE_SKIP_AUTO_REVIEW=1 disables it for a session.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { REPO_ROOT } from './lib/git.mjs';

/** A change is "worth reviewing" if ANY of these is true. */
const THRESHOLD_FILES = 3; // distinct src/**.ts files touched
const THRESHOLD_LINES = 150; // added + deleted across them
// ...or a brand-new module folder appeared, which always counts.

const STATE_FILE = path.join(REPO_ROOT, '.git', 'claude-auto-review.json');
const DEFAULT_BRANCH = 'main';

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

/** Run git; return trimmed stdout, or null if the command failed. */
function git(args) {
  const result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return result.status === 0 ? (result.stdout ?? '').trim() : null;
}

function isTypeScriptSource(file) {
  return file.startsWith('src/') && file.endsWith('.ts');
}

/**
 * What to compare against.
 *
 * On a feature branch that is the merge-base with main, so the whole branch is
 * in scope. On main the branch itself is the work, so fall back to the last
 * pushed commit, then to HEAD (uncommitted changes only).
 */
function resolveBaseline() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);

  if (branch && branch !== DEFAULT_BRANCH) {
    const base = git(['merge-base', DEFAULT_BRANCH, 'HEAD']);
    if (base) return { ref: base, label: DEFAULT_BRANCH };
  }

  const upstream = `origin/${DEFAULT_BRANCH}`;
  if (git(['rev-parse', '--verify', `${upstream}^{commit}`])) {
    const base = git(['merge-base', upstream, 'HEAD']);
    if (base && base !== git(['rev-parse', 'HEAD'])) {
      return { ref: base, label: upstream };
    }
  }

  return { ref: 'HEAD', label: 'HEAD (uncommitted work)' };
}

/** Tracked files changed since the baseline, working tree included. */
function trackedChanges(baseline) {
  const output = git(['diff', '--numstat', baseline, '--', 'src/']);
  if (!output) return [];

  return output
    .split('\n')
    .map((row) => row.split('\t'))
    .filter(([, , file]) => file && isTypeScriptSource(file))
    .map(([added, deleted, file]) => ({
      file,
      // Binary files report "-"; they are not TypeScript, but be safe.
      lines: (Number(added) || 0) + (Number(deleted) || 0),
    }));
}

/** Files that exist on disk but not in git yet — a new module starts here. */
function untrackedChanges() {
  const output = git([
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    'src/',
  ]);
  if (!output) return [];

  return output
    .split('\n')
    .filter(isTypeScriptSource)
    .map((file) => {
      let lines = 0;
      try {
        lines = fs
          .readFileSync(path.join(REPO_ROOT, file), 'utf8')
          .split('\n').length;
      } catch {
        /* unreadable file contributes nothing */
      }
      return { file, lines };
    });
}

/** Module folders in the change set that did not exist at the baseline. */
function newModules(files, baseline) {
  const touched = new Set();
  for (const file of files) {
    const match = /^src\/modules\/([^/]+)\//.exec(file);
    if (match) touched.add(match[1]);
  }

  return [...touched].filter((name) => {
    if (baseline === 'HEAD') {
      // Nothing is committed yet for an untracked folder, so ask the index.
      return !git(['ls-files', '--error-unmatch', `src/modules/${name}`]);
    }
    return !git(['ls-tree', '--name-only', baseline, `src/modules/${name}/`]);
  });
}

/**
 * Fingerprint of the current change set.
 *
 * Re-firing on a change set that already triggered a review turns the hook
 * into a nag loop, so the last one that fired is remembered and skipped.
 */
function fingerprint(changes) {
  const canonical = changes
    .map(({ file, lines }) => `${file}:${lines}`)
    .sort()
    .join('\n');
  return crypto.createHash('sha1').update(canonical).digest('hex');
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // The state file only suppresses repeats; never fail the hook over it.
  }
}

function main() {
  const input = readStdin();

  // Claude is already continuing because of a stop hook — do not stack another.
  if (input?.stop_hook_active) return null;
  if (process.env.CLAUDE_SKIP_AUTO_REVIEW === '1') return null;
  if (!git(['rev-parse', '--is-inside-work-tree'])) return null;

  const baseline = resolveBaseline();
  const changes = [...trackedChanges(baseline.ref), ...untrackedChanges()];
  if (changes.length === 0) return null;

  const files = changes.map((c) => c.file);
  const lines = changes.reduce((sum, c) => sum + c.lines, 0);
  const modules = newModules(files, baseline.ref);

  const reasons = [];
  if (modules.length > 0) {
    reasons.push(
      `new module${modules.length === 1 ? '' : 's'}: ${modules.join(', ')}`,
    );
  }
  if (changes.length >= THRESHOLD_FILES) {
    reasons.push(`${changes.length} src files changed`);
  }
  if (lines >= THRESHOLD_LINES) {
    reasons.push(`${lines} lines changed`);
  }

  if (reasons.length === 0) return null;

  const signature = fingerprint(changes);
  const state = readState();
  if (state.signature === signature) return null;

  writeState({ signature, firedAt: new Date().toISOString(), files });

  const fileList = files
    .slice(0, 20)
    .map((f) => `  - ${f}`)
    .join('\n');
  const elided =
    files.length > 20 ? `\n  ...and ${files.length - 20} more` : '';

  return [
    `This turn changed enough of src/** to warrant a review (${reasons.join('; ')}).`,
    '',
    'Run the `code-review` skill now, before ending the turn:',
    '',
    `  - Fixed point: ${baseline.ref} (${baseline.label})`,
    `  - Diff command: git diff ${baseline.ref} -- src/`,
    '  - Untracked files are part of the change set; read them from disk, they',
    '    will not appear in that diff.',
    '',
    'Changed files:',
    fileList + elided,
    '',
    'Do not ask the user for a fixed point — it is given above. Report the',
    'Standards and Spec findings, then finish. If the review surfaces nothing,',
    'say so in one line.',
  ].join('\n');
}

const reason = main();

if (reason) {
  console.log(
    JSON.stringify({
      decision: 'block',
      reason,
      systemMessage: 'Auto code-review triggered — substantial src/** change.',
    }),
  );
}

process.exit(0);
