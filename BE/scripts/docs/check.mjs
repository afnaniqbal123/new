#!/usr/bin/env node
/**
 * Documentation checks — the docs half of the quality gate.
 *
 * Architecture docs are only worth enforcing if they stay true. Four things
 * rot silently and are cheap to catch mechanically:
 *
 *   1. Relative links that point at files which moved or never existed.
 *   2. Mermaid blocks with obvious structural breakage (unknown opener,
 *      unbalanced brackets). This is a sanity check, not a parse — a block
 *      can pass it and still fail to render.
 *   3. ADRs that skip the fields the policy requires, or are misnamed.
 *   4. Architecture docs missing from the index nobody remembers to update.
 *
 * Deliberately not a prose linter. It checks facts, not style — a rule that
 * argues about wording trains people to stop reading the output.
 *
 * Usage: node scripts/docs/check.mjs
 * Policy: docs/architecture/README.md, docs/adr/README.md
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ARCH_DIR = join(REPO_ROOT, 'docs/architecture');
const ADR_DIR = join(REPO_ROOT, 'docs/adr');
const ARCH_INDEX = join(ARCH_DIR, 'README.md');

const ESC = String.fromCharCode(27);
const bold = (s) => `${ESC}[1m${s}${ESC}[0m`;
const red = (s) => `${ESC}[31m${s}${ESC}[0m`;
const green = (s) => `${ESC}[32m${s}${ESC}[0m`;
const dim = (s) => `${ESC}[2m${s}${ESC}[0m`;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

/** Every tracked Markdown file, excluding vendored trees. */
function markdownFiles(dir = REPO_ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) markdownFiles(full, out);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

const findings = [];
const report = (file, detail, expected) =>
  findings.push({ file: relative(REPO_ROOT, file), detail, expected });

/** Strip fenced code so links and headings inside samples are not parsed. */
function withoutCodeFences(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/[^\n]/g, ' '),
  );
}

// ── 1 · Relative links resolve ────────────────────────────────────────────
const LINK = /\[[^\]]*\]\(([^)]+)\)/g;

function checkLinks(file) {
  const body = withoutCodeFences(readFileSync(file, 'utf8'));

  for (const [, target] of body.matchAll(LINK)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;

    const [path] = target.split('#');
    if (!path) continue; // pure anchor

    const resolved = resolve(dirname(file), path);
    if (!existsSync(resolved)) {
      report(
        file,
        `broken link -> ${target}`,
        'The target does not exist. Fix the path, or update it if the file moved.',
      );
    }
  }
}

// ── 2 · Mermaid structural sanity ─────────────────────────────────────────
// Not a parser. It catches the two breakages that actually occur — a typo'd
// diagram type and unbalanced brackets in a label — and nothing else. Look at
// the rendered diagram in the PR; GitHub renders Mermaid natively.
const MERMAID = /```mermaid\n([\s\S]*?)```/g;

// The diagram kinds this repo actually uses. An unknown opener is almost
// always a typo, and GitHub renders it as an error box rather than failing.
const DIAGRAM_KINDS = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'gitGraph',
  'mindmap',
  'timeline',
  'quadrantChart',
  'C4Context',
  'C4Container',
  'C4Component',
];

function checkMermaid(file) {
  const raw = readFileSync(file, 'utf8');

  for (const [, block] of raw.matchAll(MERMAID)) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      report(file, 'empty mermaid block', 'Remove it or add the diagram.');
      continue;
    }

    const opener = lines[0];
    if (!DIAGRAM_KINDS.some((kind) => opener.startsWith(kind))) {
      report(
        file,
        `mermaid block opens with "${opener.slice(0, 40)}"`,
        `Not a diagram type Mermaid recognises — GitHub will render an error box. Expected one of: ${DIAGRAM_KINDS.slice(0, 6).join(', ')}, ...`,
      );
    }

    // Unbalanced brackets in a node label are the most common breakage and
    // the error Mermaid reports for it is not obvious.
    for (const pair of [
      ['[', ']'],
      ['(', ')'],
      ['{', '}'],
    ]) {
      const opens = (block.match(new RegExp(`\\${pair[0]}`, 'g')) ?? []).length;
      const closes = (block.match(new RegExp(`\\${pair[1]}`, 'g')) ?? [])
        .length;
      if (opens !== closes) {
        report(
          file,
          `mermaid block has ${opens} "${pair[0]}" and ${closes} "${pair[1]}"`,
          'Unbalanced brackets — Mermaid will fail to parse the diagram.',
        );
      }
    }
  }
}

// ── 3 · ADR naming and required fields ────────────────────────────────────
const ADR_NAME = /^\d{4}-[a-z0-9-]+\.md$/;
const REQUIRED_ADR_FIELDS = ['Status', 'Date'];

function checkAdrs() {
  if (!existsSync(ADR_DIR)) return;

  for (const entry of readdirSync(ADR_DIR)) {
    if (!entry.endsWith('.md') || entry === 'README.md') continue;
    const file = join(ADR_DIR, entry);

    if (!ADR_NAME.test(entry)) {
      report(
        file,
        `ADR filename "${entry}"`,
        'ADRs are named NNNN-kebab-slug.md (four digits). See docs/adr/README.md.',
      );
    }

    const body = readFileSync(file, 'utf8');
    for (const field of REQUIRED_ADR_FIELDS) {
      if (!new RegExp(`^-\\s+\\*\\*${field}:\\*\\*`, 'm').test(body)) {
        report(
          file,
          `ADR missing "${field}"`,
          `Every ADR states **${field}:** in its header block. See docs/adr/README.md.`,
        );
      }
    }

    if (!/^#\s+ADR\s+\d{4}\s+—/m.test(body)) {
      report(
        file,
        'ADR title line',
        'Title must read "# ADR NNNN — Short decision", so the number is visible in the rendered doc.',
      );
    }
  }
}

// ── 4 · Architecture index lists every architecture doc ───────────────────
function checkArchitectureIndex() {
  // A project with no architecture documents yet needs no index of them.
  // Demanding one produces a stub that says nothing, which the standard this
  // check enforces explicitly calls worse than a missing file — and it would
  // fail the very first `verify` in any repo that adopted the toolkit before
  // writing its architecture down.
  if (!existsSync(ARCH_DIR)) return;

  if (!existsSync(ARCH_INDEX)) {
    report(
      ARCH_INDEX,
      'missing architecture index',
      'docs/architecture/ has documents in it, so it needs the index agents read first.',
    );
    return;
  }

  // Strip fences first: the index shows the directory layout in a code block,
  // and a filename mentioned there is an illustration, not a link to it.
  // Matching against the raw file silently accepts unlisted documents.
  const index = withoutCodeFences(readFileSync(ARCH_INDEX, 'utf8'));
  const docs = markdownFiles(ARCH_DIR)
    .map((f) => relative(ARCH_DIR, f))
    .filter((f) => f !== 'README.md');

  for (const doc of docs) {
    if (!index.includes(doc)) {
      report(
        ARCH_INDEX,
        `"${doc}" is not listed`,
        'Every architecture doc must appear in the index, or nobody finds it. Add a row.',
      );
    }
  }
}

for (const file of markdownFiles()) {
  checkLinks(file);
  checkMermaid(file);
}
checkAdrs();
checkArchitectureIndex();

if (findings.length === 0) {
  console.log(green('Documentation check passed.'));
  process.exit(0);
}

console.error(`\n  ${bold('Documentation check')}\n`);
console.error(red(`  ${findings.length} issue(s).\n`));
for (const f of findings) {
  console.error(`  ${red('x')} ${bold(f.file)}  ${f.detail}`);
  console.error(`    ${dim('->')} ${f.expected}\n`);
}
process.exit(1);
