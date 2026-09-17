#!/usr/bin/env node
/**
 * Non-mutating drift check for `.cursor/commands/` against its source of
 * truth, `.claude/commands/` — the read-only counterpart to `pnpm ai:sync`
 * (scripts/sync-ai-config.mjs), which actually writes the files. Both import
 * the same `computeExpectedCommandFiles()` so "in sync" means the identical
 * thing to both — this script can never pass on content `ai:sync` wouldn't
 * also produce.
 *
 * Catches the case a plain `pnpm verify` run would otherwise miss entirely:
 * someone edits a `.claude/commands/*.md` source file and forgets to run
 * `pnpm ai:sync`, leaving Cursor's mirror silently stale. Never writes
 * anything — that's what `pnpm ai:sync` is for.
 *
 * Run via `pnpm ai:check`; part of `pnpm verify`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeExpectedCommandFiles, OUT_DIR } from '../sync-ai-config.mjs';

function main() {
  const expected = computeExpectedCommandFiles();

  if (expected === null) {
    console.log('✓ ai:check — no .claude/commands directory, nothing to verify.');
    return;
  }

  const failures = [];

  for (const [file, expectedContent] of expected) {
    const outPath = join(OUT_DIR, file);

    if (!existsSync(outPath)) {
      failures.push(`.cursor/commands/${file} is missing`);
      continue;
    }

    const actualContent = readFileSync(outPath, 'utf8');
    if (actualContent !== expectedContent) {
      failures.push(`.cursor/commands/${file} is stale (doesn't match .claude/commands/${file})`);
    }
  }

  // Files present in .cursor/commands/ that .claude/commands/ no longer has a
  // source for aren't flagged here — `pnpm ai:sync` doesn't delete orphaned
  // output either, so "run ai:sync to fix" wouldn't actually resolve that
  // case. Cleaning those up, if it's ever needed, is a separate concern.

  if (failures.length > 0) {
    console.error('\n\u{1F6D1} .cursor/commands/ has drifted from .claude/commands/:\n');
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error(`\n${failures.length} file(s) out of sync. Run \`pnpm ai:sync\` to fix, then commit the result.\n`);
    process.exit(1);
  }

  console.log(`✓ ai:check — .cursor/commands/ matches .claude/commands/ (${expected.size} file(s)).`);
}

main();
