#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook (Write|Edit).
 *
 * Runs the project's typecheck (`tsc --noEmit -p tsconfig.json`, same command
 * as `pnpm run typecheck` and pre-commit stage 3) right after Claude edits a
 * src/** TypeScript file, and feeds any error back so it gets fixed in the
 * same turn instead of surfacing later at commit.
 *
 * Silent on success and on any file outside src/**.ts(x) — this only adds
 * noise/latency when there's something to fix.
 *
 * Wired up via .claude/settings.json -> hooks.PostToolUse (matcher Write|Edit).
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

const isSrcTs = /^src[\\/].*\.tsx?$/.test(relative);
if (!isSrcTs) process.exit(0);

const result = spawnSync(
  ...runner('tsc', ['--noEmit', '-p', 'tsconfig.json']),
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
  },
);

if (result.status === 0) {
  process.exit(0);
}

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
const lines = output.split('\n').slice(0, 60).join('\n');

console.log(
  JSON.stringify({
    decision: 'block',
    reason: `tsc --noEmit found type errors after editing ${relative}:\n\n${lines}\n\nFix these before continuing.`,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `Typecheck failed after editing ${relative}. See reason for details.`,
    },
  }),
);
