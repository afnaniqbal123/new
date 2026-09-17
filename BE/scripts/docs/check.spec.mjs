/**
 * Tests for the documentation checker.
 *
 * The checker is a gate, and an unverified gate quietly stops catching things.
 * These run against temporary fixture trees rather than the repo, so they
 * assert the detection logic itself and cannot be made to pass by editing a
 * document.
 *
 * Run with: node --test scripts/docs/check.spec.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const roots = [];

after(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

/**
 * Build a throwaway repo containing only the checker and the given files, then
 * run it there. Returns { ok, output }.
 */
function runCheckerOn(files) {
  const root = mkdtempSync(join(tmpdir(), 'docs-check-'));
  roots.push(root);

  mkdirSync(join(root, 'scripts/docs'), { recursive: true });
  cpSync(join(HERE, 'check.mjs'), join(root, 'scripts/docs/check.mjs'));

  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }

  try {
    const output = execFileSync(
      process.execPath,
      [join(root, 'scripts/docs/check.mjs')],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { ok: true, output };
  } catch (err) {
    return { ok: false, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/** A minimal valid tree, so each test varies exactly one thing. */
const VALID = {
  'docs/architecture/README.md':
    '# Index\n\n- [system-context.md](./system-context.md)\n',
  'docs/architecture/system-context.md': '# Context\n\nProse.\n',
  'docs/adr/README.md': '# ADRs\n',
  'docs/adr/0001-a-decision.md':
    '# ADR 0001 — A decision\n\n- **Status:** Accepted\n- **Date:** 2026-08-25\n\nBody.\n',
};

describe('baseline', () => {
  it('passes on a well-formed tree', () => {
    const { ok } = runCheckerOn(VALID);
    assert.equal(ok, true);
  });
});

describe('link checking', () => {
  it('fails on a relative link to a file that does not exist', () => {
    const { ok, output } = runCheckerOn({
      ...VALID,
      'docs/architecture/system-context.md': '# Context\n\n[gone](./nope.md)\n',
    });
    assert.equal(ok, false);
    assert.match(output, /broken link/);
  });

  it('ignores external and anchor links', () => {
    const { ok } = runCheckerOn({
      ...VALID,
      'docs/architecture/system-context.md':
        '# Context\n\n[web](https://example.com) [anchor](#context)\n',
    });
    assert.equal(ok, true);
  });

  // A path inside a fenced sample is an illustration, not a link.
  it('ignores links inside fenced code blocks', () => {
    const { ok } = runCheckerOn({
      ...VALID,
      'docs/architecture/system-context.md':
        '# Context\n\n```md\n[example](./does-not-exist.md)\n```\n',
    });
    assert.equal(ok, true);
  });

  it('resolves a link that crosses directories', () => {
    const { ok } = runCheckerOn({
      ...VALID,
      'docs/architecture/system-context.md':
        '# Context\n\n[adr](../adr/0001-a-decision.md)\n',
    });
    assert.equal(ok, true);
  });
});

describe('mermaid checking', () => {
  it('fails on an unknown diagram type', () => {
    const { ok, output } = runCheckerOn({
      ...VALID,
      'docs/architecture/system-context.md':
        '# Context\n\n```mermaid\nflowhcart TD\n  A --> B\n```\n',
    });
    assert.equal(ok, false);
    assert.match(output, /mermaid block opens with/);
  });

  it('fails on unbalanced brackets', () => {
    const { ok, output } = runCheckerOn({
      ...VALID,
      'docs/architecture/system-context.md':
        '# Context\n\n```mermaid\nflowchart TD\n  A[Start --> B[End]\n```\n',
    });
    assert.equal(ok, false);
    assert.match(output, /mermaid block has/);
  });

  it('fails on an empty block', () => {
    const { ok, output } = runCheckerOn({
      ...VALID,
      'docs/architecture/system-context.md': '# Context\n\n```mermaid\n```\n',
    });
    assert.equal(ok, false);
    assert.match(output, /empty mermaid block/);
  });

  it('accepts the diagram types this repo uses', () => {
    for (const kind of [
      'flowchart TD',
      'sequenceDiagram',
      'C4Context',
      'erDiagram',
    ]) {
      const { ok } = runCheckerOn({
        ...VALID,
        'docs/architecture/system-context.md': `# Context\n\n\`\`\`mermaid\n${kind}\n\`\`\`\n`,
      });
      assert.equal(ok, true, `${kind} should be accepted`);
    }
  });
});

describe('ADR checking', () => {
  it('fails when Status is missing', () => {
    const { ok, output } = runCheckerOn({
      ...VALID,
      'docs/adr/0001-a-decision.md':
        '# ADR 0001 — A decision\n\n- **Date:** 2026-08-25\n',
    });
    assert.equal(ok, false);
    assert.match(output, /missing "Status"/);
  });

  it('fails when Date is missing', () => {
    const { ok, output } = runCheckerOn({
      ...VALID,
      'docs/adr/0001-a-decision.md':
        '# ADR 0001 — A decision\n\n- **Status:** Accepted\n',
    });
    assert.equal(ok, false);
    assert.match(output, /missing "Date"/);
  });

  it('fails on a filename that is not NNNN-kebab-slug.md', () => {
    const files = { ...VALID };
    delete files['docs/adr/0001-a-decision.md'];
    files['docs/adr/my-decision.md'] =
      '# ADR 0001 — A decision\n\n- **Status:** Accepted\n- **Date:** 2026-08-25\n';

    const { ok, output } = runCheckerOn(files);
    assert.equal(ok, false);
    assert.match(output, /ADR filename/);
  });

  it('fails when the title omits the ADR number', () => {
    const { ok, output } = runCheckerOn({
      ...VALID,
      'docs/adr/0001-a-decision.md':
        '# A decision\n\n- **Status:** Accepted\n- **Date:** 2026-08-25\n',
    });
    assert.equal(ok, false);
    assert.match(output, /ADR title line/);
  });

  it('does not treat the ADR index as a record', () => {
    const { ok } = runCheckerOn({
      ...VALID,
      'docs/adr/README.md': '# ADRs\n\nNo fields here.\n',
    });
    assert.equal(ok, true);
  });
});

describe('architecture index', () => {
  it('fails when a document is not listed in the index', () => {
    const { ok, output } = runCheckerOn({
      ...VALID,
      'docs/architecture/module-architecture.md': '# Modules\n\nProse.\n',
    });
    assert.equal(ok, false);
    assert.match(output, /is not listed/);
  });

  it('finds documents nested below architecture/', () => {
    const { ok, output } = runCheckerOn({
      ...VALID,
      'docs/architecture/security/authentication.md': '# Auth\n\nProse.\n',
    });
    assert.equal(ok, false);
    assert.match(output, /security\/authentication\.md/);
  });

  it('passes once the nested document is listed', () => {
    const { ok } = runCheckerOn({
      ...VALID,
      'docs/architecture/README.md':
        '# Index\n\n- [system-context.md](./system-context.md)\n- [security/authentication.md](./security/authentication.md)\n',
      'docs/architecture/security/authentication.md': '# Auth\n\nProse.\n',
    });
    assert.equal(ok, true);
  });

  /**
   * Regression: the index shows the directory layout in a fenced block, so a
   * naive substring match counted a filename mentioned there as "listed" and
   * silently accepted unlisted documents.
   */
  it('does not count a filename mentioned inside a code fence as listed', () => {
    const { ok, output } = runCheckerOn({
      ...VALID,
      'docs/architecture/README.md':
        '# Index\n\n- [system-context.md](./system-context.md)\n\n```text\ndocs/architecture/\n└── data-architecture.md   (when needed)\n```\n',
      'docs/architecture/data-architecture.md': '# Data\n\nProse.\n',
    });
    assert.equal(ok, false);
    assert.match(output, /data-architecture\.md" is not listed/);
  });

  it('fails when the index itself is missing', () => {
    const files = { ...VALID };
    delete files['docs/architecture/README.md'];

    const { ok, output } = runCheckerOn(files);
    assert.equal(ok, false);
    assert.match(output, /missing architecture index/);
  });
});
