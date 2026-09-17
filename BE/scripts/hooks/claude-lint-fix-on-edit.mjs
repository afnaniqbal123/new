#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook (Write|Edit).
 *
 * Runs `eslint --fix` then `prettier --write` on the file Claude just
 * touched — same two commands lint-staged runs at commit time, just applied
 * immediately instead of waiting. Auto-fixable issues (formatting, quote
 * style, import order, etc.) are silently corrected on disk. Anything ESLint
 * can't auto-fix is fed back so it gets addressed in the same turn instead of
 * surfacing later at commit.
 *
 * Silent on success and on any non-.ts(x) file.
 *
 * Wired up via .claude/settings.json -> hooks.PostToolUse (matcher Write|Edit),
 * alongside claude-typecheck-on-edit.mjs.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { runner } from './lib/pm.mjs';

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

const input = readStdin();
const filePath = input?.tool_input?.file_path ?? input?.tool_response?.filePath;

if (!filePath) process.exit(0);

const relative = path.isAbsolute(filePath)
  ? path.relative(process.cwd(), filePath)
  : filePath;

if (!/\.tsx?$/.test(relative)) process.exit(0);
if (!fs.existsSync(path.resolve(process.cwd(), relative))) process.exit(0);

spawnSync(...runner('eslint', ['--fix', relative]), {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 20_000,
});

spawnSync(...runner('prettier', ['--write', relative]), {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 20_000,
});

// Re-run lint (no --fix) to see what's left after auto-fixing.
const recheck = spawnSync(...runner('eslint', [relative]), {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 20_000,
});

if (recheck.status === 0) {
  process.exit(0);
}

const output = `${recheck.stdout ?? ''}${recheck.stderr ?? ''}`.trim();
const lines = output.split('\n').slice(0, 60).join('\n');

console.log(
  JSON.stringify({
    decision: 'block',
    reason: `eslint found issues in ${relative} that --fix couldn't auto-correct:\n\n${lines}\n\nFix these before continuing.`,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `Lint issues remain in ${relative} after auto-fix. See reason for details.`,
    },
  }),
);
