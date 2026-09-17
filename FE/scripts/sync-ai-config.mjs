#!/usr/bin/env node
/**
 * Keeps `.cursor/commands/` in sync with `.claude/commands/`.
 *
 * Commands are authored ONCE in `.claude/commands/*.md` (with YAML frontmatter that
 * Claude Code understands). This script strips the frontmatter and writes the plain
 * body to `.cursor/commands/` with the same filename, so both tools expose the same
 * command set without duplicating the source of truth.
 *
 * This is a manual, explicit, mutating step (`pnpm ai:sync`) — it is deliberately
 * NOT run by `pnpm prepare` (a fresh `pnpm install` must never rewrite tracked
 * files). `pnpm ai:check` (scripts/checks/ai-config-contract.mjs) is the
 * non-mutating counterpart that verifies `.cursor/commands/` hasn't drifted from
 * this script's output, and is what `pnpm verify`/CI actually runs.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SRC_DIR = join(ROOT, '.claude', 'commands');
export const OUT_DIR = join(ROOT, '.cursor', 'commands');

const BANNER = '<!-- AUTO-GENERATED from .claude/commands — edit the source, then run `pnpm ai:sync`. -->\n\n';

/** Remove a leading YAML frontmatter block (--- ... ---) from a markdown string. */
function stripFrontmatter(markdown) {
  const match = /^---\n[\s\S]*?\n---\n?/.exec(markdown);
  return match ? markdown.slice(match[0].length).replace(/^\n+/, '') : markdown;
}

/**
 * Pure computation of what `.cursor/commands/` should contain, read from the
 * current `.claude/commands/` source — shared by this script's write mode and
 * `ai-config-contract.mjs`'s read-only drift check, so the two can never
 * silently diverge in what counts as "in sync."
 *
 * Returns `null` if there's no `.claude/commands/` directory at all (nothing to
 * generate), otherwise a `Map<filename, expectedContent>`.
 */
export function computeExpectedCommandFiles() {
  if (!existsSync(SRC_DIR)) return null;

  const files = readdirSync(SRC_DIR).filter((name) => name.endsWith('.md'));
  const expected = new Map();

  for (const file of files) {
    const source = readFileSync(join(SRC_DIR, file), 'utf8');
    const body = stripFrontmatter(source).trimEnd();
    expected.set(file, `${BANNER}${body}\n`);
  }

  return expected;
}

function main() {
  const expected = computeExpectedCommandFiles();

  if (expected === null) {
    console.log('ai:sync — no .claude/commands directory, nothing to sync.');
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const [file, content] of expected) {
    writeFileSync(join(OUT_DIR, file), content);
  }

  console.log(`ai:sync — mirrored ${expected.size} command(s) to .cursor/commands/.`);
}

// CLI entrypoint: only write files when run directly (`pnpm ai:sync`), not
// when imported by ai-config-contract.mjs's read-only check.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
