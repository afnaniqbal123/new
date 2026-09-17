/**
 * Adoption tests for `scripts/export-toolkit.mjs`.
 *
 * Every bug this toolkit has shipped came from the same blind spot: it was only
 * ever exercised against this repository, which has a `test/` directory, pnpm,
 * a `docs/` tree, and an eslint config that already loads the custom rules. Real
 * targets have none of that, and each difference broke something — an eslint
 * glob that matched no files, hooks that shelled out to a package manager the
 * project did not use, a documentation stage that demanded an index for
 * documents that did not exist.
 *
 * So the fixture here is deliberately *unlike* this repo. It is the smallest
 * thing that still counts as an existing NestJS project, and it differs on every
 * axis a real one does. A new difference that breaks adoption should fail here,
 * not in someone's terminal.
 *
 *   node --test scripts/export-toolkit.spec.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const REPO_ROOT = join(import.meta.dirname, '..');

/** A minimal existing project that differs from this repo on every axis. */
function makeTarget() {
  const dir = mkdtempSync(join(tmpdir(), 'toolkit-adoption-'));

  mkdirSync(join(dir, 'src/modules/thing'), { recursive: true });
  writeFileSync(
    join(dir, 'src/modules/thing/thing.controller.ts'),
    'import { Controller, Get } from "@nestjs/common";\n' +
      '@Controller("thing")\n' +
      'export class ThingController {\n  @Get()\n  find() {\n    return [];\n  }\n}\n',
  );

  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'existing-api',
        version: '2.4.0',
        scripts: { build: 'nest build', test: 'jest' },
        dependencies: { '@nestjs/common': '^11.0.0' },
        devDependencies: { eslint: '^9.34.0', typescript: '^5.9.2' },
      },
      null,
      2,
    )}\n`,
  );

  // npm, not pnpm — the hooks must not assume a package manager.
  writeFileSync(join(dir, 'package-lock.json'), '{}\n');

  writeFileSync(
    join(dir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: 'commonjs',
          target: 'ES2023',
          outDir: './dist',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          skipLibCheck: true,
          strict: true,
          strictPropertyInitialization: false,
        },
      },
      null,
      2,
    )}\n`,
  );

  // Its own flat config: lints TypeScript, as any real NestJS project's does,
  // but knows nothing about the custom rules. If this could not lint .ts at all
  // the lint stage would fail for its own reasons, and the assertions below
  // would pass no matter what the toolkit did.
  writeFileSync(
    join(dir, 'eslint.config.mjs'),
    [
      "import eslint from '@eslint/js';",
      "import tseslint from 'typescript-eslint';",
      '',
      'export default tseslint.config(',
      "  { ignores: ['dist/**', 'node_modules/**'] },",
      '  eslint.configs.recommended,',
      '  ...tseslint.configs.recommended,',
      ');',
      '',
    ].join('\n'),
  );

  // A project that already runs something on commit — which most do, and which
  // used to mean the gate was skipped and silently never ran.
  mkdirSync(join(dir, '.husky'), { recursive: true });
  writeFileSync(
    join(dir, '.husky/pre-commit'),
    '#!/usr/bin/env sh\nnpx lint-staged\n',
  );

  // Deliberately absent: test/, docs/, .claude/ — and no `type: module`.

  run('git', ['init', '-q', '.'], dir);
  run('git', ['config', 'user.email', 'test@example.com'], dir);
  run('git', ['config', 'user.name', 'test'], dir);
  run('git', ['add', '-A'], dir);
  run('git', ['commit', '-qm', 'existing work'], dir);

  // The gate needs a resolvable toolchain; borrow this repo's.
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}

function run(cmd, args, cwd) {
  return spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

const strip = (s) => s.replace(/\[[0-9;]*[A-Za-z]/g, '');

describe('adopting the toolkit into an existing project', () => {
  let dir;
  let exportOut;

  before(() => {
    dir = makeTarget();
    const res = run(
      'node',
      [join(REPO_ROOT, 'scripts/export-toolkit.mjs'), dir],
      REPO_ROOT,
    );
    exportOut = strip(`${res.stdout}${res.stderr}`);
  });

  after(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  test('copies the enforcement layer, not just the directories', () => {
    // A directory that exists but is empty used to count as "already there",
    // which shipped husky hooks pointing at scripts that were never copied.
    for (const f of [
      'scripts/hooks/pre-commit.mjs',
      'scripts/hooks/lib/pm.mjs',
      'scripts/architecture/check.mjs',
      'scripts/docs/check.mjs',
      'tools/eslint-rules/index.mjs',
    ]) {
      assert.ok(existsSync(join(dir, f)), `${f} should have been copied`);
    }
  });

  test('every hook the husky scripts invoke actually exists', () => {
    for (const hook of ['pre-commit', 'commit-msg', 'post-commit']) {
      const path = join(dir, '.husky', hook);
      assert.ok(existsSync(path), `.husky/${hook} missing`);
      const script = run('cat', [path], dir).stdout;
      const target = script.match(/scripts\/hooks\/[\w.-]+\.mjs/)?.[0];
      assert.ok(target, `.husky/${hook} names no script`);
      assert.ok(
        existsSync(join(dir, target)),
        `.husky/${hook} calls ${target}, which was not copied`,
      );
    }
  });

  test('adds the gate to an existing hook instead of skipping it', () => {
    // The failure this guards is silent and total: everything else lands, the
    // export reports success, and nothing ever invokes the gate because the
    // project already had a pre-commit and it was left untouched.
    const hook = run('cat', ['.husky/pre-commit'], dir).stdout;

    assert.match(hook, /lint-staged/, "the project's own hook was discarded");
    assert.match(
      hook,
      /scripts\/hooks\/pre-commit\.mjs/,
      'the hook does not invoke the gate, so it will never run',
    );
  });

  test('names the target’s own package manager in its next steps', () => {
    assert.match(exportOut, /npm install/);
    assert.doesNotMatch(exportOut, /pnpm install/);
  });

  test('the documentation stage passes on a project with no docs of its own', () => {
    // The copied skills reference an ADR policy; the export has to bring it, or
    // the first `verify` fails on a link the developer never wrote.
    assert.ok(existsSync(join(dir, 'docs/adr/README.md')));

    const res = run('node', ['scripts/docs/check.mjs'], dir);
    assert.equal(
      res.status,
      0,
      `docs:check failed on a fresh adoption:\n${strip(res.stdout)}`,
    );
  });

  test('the lint stage runs where there is no test/ directory', () => {
    assert.ok(!existsSync(join(dir, 'test')), 'fixture should have no test/');

    // The documented adoption sequence: record the existing debt first, then
    // check. Expecting a pass without the baselines would be testing a project
    // with no history, which is the one case this toolkit is not for.
    run(
      'node',
      ['scripts/architecture/check.mjs', '--update', '--accept-new'],
      dir,
    );
    run('npx', ['eslint', 'src/**/*.ts', '--suppress-all'], dir);

    const res = run('node', ['scripts/hooks/pre-commit.mjs', '--all'], dir);
    const out = strip(`${res.stdout}${res.stderr}`);

    // Assert the stage passed. Asserting only that a specific error string is
    // absent is what let a hard-coded glob survive this test once already: the
    // stage was failing, just with different words.
    const lintLine = out
      .split('\n')
      .find((l) => l.includes('Lint & conventions'));
    assert.ok(lintLine, 'lint stage did not run at all');
    assert.match(
      lintLine,
      /✔/u,
      `lint stage failed on a project with no test/ directory:\n${out}`,
    );
  });

  test('the custom rules actually run against the project’s code', () => {
    // The failure this guards is silent: the rules get copied, the project's own
    // eslint config never loads them, and the gate reports green while enforcing
    // nothing. A toolkit that quietly does nothing is worse than one that fails.
    assert.ok(
      existsSync(join(dir, 'eslint.config.project.mjs')),
      "the project's own config should have been kept",
    );

    // A file written now, so the baseline recorded earlier cannot suppress it —
    // suppressions are keyed by file, and this one did not exist when they were
    // taken. Without this the test would pass on an empty result and prove
    // nothing.
    const probe = 'src/modules/thing/probe.controller.ts';
    writeFileSync(
      join(dir, probe),
      'import { Controller, Get } from "@nestjs/common";\n' +
        '@Controller("probe")\n' +
        'export class ProbeController {\n  @Get()\n  find() {\n    return [];\n  }\n}\n',
    );

    const res = run('npx', ['eslint', probe, '--format', 'json'], dir);
    const fired = JSON.parse(res.stdout || '[]')
      .flatMap((f) => f.messages)
      .map((m) => m.ruleId)
      .filter((id) => id?.startsWith('nestjs/'));

    rmSync(join(dir, probe), { force: true });

    assert.ok(
      fired.length > 0,
      `no nestjs/* rule fired on new code — the rules were copied but never loaded:\n${strip(res.stderr)}`,
    );
  });

  test('the whole export is undone by one git command', () => {
    run('git', ['checkout', '.'], dir);
    run('git', ['clean', '-fdq', '-e', 'node_modules'], dir);
    const left = run('git', ['status', '--porcelain'], dir)
      .stdout.split('\n')
      .filter((l) => l.trim() && !l.includes('node_modules'));
    assert.deepEqual(left, [], 'rollback left changes behind');
  });
});
