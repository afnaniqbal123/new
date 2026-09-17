#!/usr/bin/env node
/**
 * Export this boilerplate's agent toolkit into another NestJS project.
 *
 * Copies the three portable layers — skills, enforcement scripts, custom ESLint
 * rules — merges the required package.json entries, and wires up the Claude Code
 * hooks. Repo-specific state (baselines, CLAUDE.md, docs/, CONTEXT.md) is never
 * copied; it is regenerated in the target instead, which is what lets an existing
 * codebase adopt strict rules without fixing its whole history first.
 *
 * Usage:
 *   node scripts/export-toolkit.mjs <target-project-path>
 *   node scripts/export-toolkit.mjs <target> --dry-run   # show the plan, write nothing
 *   node scripts/export-toolkit.mjs <target> --force     # overwrite files that exist
 *
 * Existing files in the target are skipped unless --force is passed, so re-running
 * is safe and never silently clobbers local edits.
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  readdirSync,
  statSync,
  chmodSync,
} from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ESC = String.fromCharCode(27);
const c = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  gray: `${ESC}[90m`,
  green: `${ESC}[32m`,
  yellow: `${ESC}[33m`,
  red: `${ESC}[31m`,
  cyan: `${ESC}[36m`,
};
const paint = (color, s) => `${c[color]}${s}${c.reset}`;
const line = (s = '') => process.stdout.write(`${s}\n`);

/* ------------------------------------------------------------------ manifest */

/** Copied verbatim — no coupling to this repo's module layout. */
const PORTABLE = [
  'scripts/hooks',
  'scripts/architecture',
  'scripts/docs',
  'tools/eslint-rules',
  'commitlint.config.cjs',
  '.prettierrc',
];

/** package.json scripts the toolkit needs to function. */
const SCRIPTS = [
  'prepare',
  'lint',
  'lint:check',
  'lint:baseline',
  'lint:baseline:prune',
  'typecheck',
  'verify',
  'debt',
  'architecture:check',
  'architecture:baseline',
  'architecture:test',
  'architecture:accept',
  'docs:check',
  'docs:test',
];

/** devDependencies the enforcement layer needs. Versions read from this repo. */
const DEV_DEPS = [
  '@commitlint/cli',
  '@commitlint/config-conventional',
  '@eslint/eslintrc',
  '@eslint/js',
  'eslint',
  'eslint-config-prettier',
  'eslint-plugin-prettier',
  'globals',
  'husky',
  'lint-staged',
  'prettier',
  'typescript-eslint',
];

/** The package manager the TARGET uses, so the next steps are copy-pasteable. */
function targetPackageManager(dir) {
  for (const [lockfile, pm] of [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
  ]) {
    if (existsSync(join(dir, lockfile))) return pm;
  }
  return 'npm';
}

/**
 * Where a specific release, not just a major, is what the toolkit needs.
 *
 * `lint:baseline` calls `eslint --suppress-all`, added in 9.24. A project on
 * 9.23 passes a major-version check and then fails on the first command the
 * next steps tell it to run.
 */
const MINIMUM_VERSIONS = {
  eslint: '9.24.0',
};

/** Said in terms of what actually breaks, not a generic warning. */
const WHY_IT_MATTERS = {
  eslint: '`lint:baseline` uses --suppress-all, which older ESLint rejects',
  'typescript-eslint':
    'the flat config and the custom rule plugin will not load',
  husky: 'the git hooks are activated differently before v9',
  'lint-staged': 'the pre-commit stage passes flags older versions reject',
  '@commitlint/cli': 'the commit-message stage may not run',
};

/** The major from a version range: `^9.1.7` -> 9. */
function major(range) {
  return Number(
    String(range)
      .replace(/^[^0-9]*/, '')
      .split('.')[0],
  );
}

/** -1, 0 or 1, comparing dotted numeric versions ignoring any range prefix. */
function compare(a, b) {
  const parts = (v) =>
    String(v)
      .replace(/^[^0-9]*/, '')
      .split('.')
      .map((n) => Number(n) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1;
  }
  return 0;
}

/** Never copied — these describe THIS codebase and must be regenerated. */
const REGENERATE = [
  // `architecture:accept`, not `architecture:baseline`. The plain baseline
  // command refuses to record violations it has not seen before — it will not
  // bless new debt silently, which is the behaviour you want every day after
  // today. On the first adoption every existing violation is "new" to it, so
  // that first record has to be the deliberate one.
  ['architecture-baseline.json', 'run architecture:accept'],
  ['eslint-suppressions.json', 'run lint:baseline'],
];

/* --------------------------------------------------------------------- args */

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const FORCE = argv.includes('--force');
const ALLOW_DIRTY = argv.includes('--allow-dirty');
const targetArg = argv.find((a) => !a.startsWith('--'));

if (!targetArg) {
  line(
    paint(
      'red',
      'Usage: node scripts/export-toolkit.mjs <target-project-path> [--dry-run] [--force] [--allow-dirty]',
    ),
  );
  process.exit(2);
}

const TARGET = resolve(process.cwd(), targetArg);

/* ---------------------------------------------------------------- preflight */

/** Uncommitted tracked changes, ignoring untracked files. */
function isDirty(dir) {
  const res = spawnSync(
    'git',
    ['status', '--porcelain', '--untracked-files=no'],
    {
      cwd: dir,
      encoding: 'utf8',
    },
  );
  return res.status === 0 && res.stdout.trim().length > 0;
}

function preflight() {
  const problems = [];
  if (!existsSync(TARGET)) problems.push(`Target does not exist: ${TARGET}`);
  else if (!statSync(TARGET).isDirectory())
    problems.push(`Target is not a directory: ${TARGET}`);
  else {
    if (!existsSync(join(TARGET, 'package.json')))
      problems.push('No package.json — is this a Node project?');
    if (!existsSync(join(TARGET, 'src')))
      problems.push(
        'No src/ directory — the checks assume src/ holds the app.',
      );
    if (!existsSync(join(TARGET, '.git')))
      problems.push('Not a git repo — husky hooks need one (run: git init).');
    else if (!ALLOW_DIRTY && !DRY && isDirty(TARGET))
      // With a clean tree, `git checkout . && git clean -fd` undoes this export
      // completely. That guarantee is the whole safety story for dropping a
      // toolkit into a codebase someone has been shipping from for months, so
      // it is worth refusing rather than warning.
      problems.push(
        'Working tree has uncommitted changes. Commit or stash first, so this\n' +
          '    export can be undone with a single git command. Override: --allow-dirty',
      );
  }
  if (resolve(TARGET) === resolve(SRC))
    problems.push('Target is this repo. Pick a different project.');
  return problems;
}

/* ------------------------------------------------------------------- actions */

const done = [];
const skipped = [];
const warned = [];

/**
 * Every file under `rel` in the source, as paths relative to it.
 */
function filesUnder(dir, base = dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) filesUnder(full, base, found);
    else found.push(relative(base, full));
  }
  return found;
}

function copyPath(rel, destRel = rel) {
  const from = join(SRC, rel);
  const to = join(TARGET, destRel);
  if (!existsSync(from)) {
    warned.push(`missing in source: ${rel}`);
    return;
  }

  // Directories are merged file by file, never skipped wholesale.
  //
  // Skipping on the directory's mere existence looked equivalent and was not:
  // `git clean -fd` can leave a directory behind with its files gone, and an
  // empty `scripts/hooks/` then swallowed the entire quality gate while the
  // report said "(exists)". The husky hooks still landed, pointing at scripts
  // that were never copied — so every commit failed, in the one situation the
  // skip was meant to make safe.
  if (statSync(from).isDirectory()) {
    const files = filesUnder(from);
    const missing = files.filter((f) => !existsSync(join(to, f)));

    if (missing.length === 0 && !FORCE) {
      skipped.push(
        `${destRel} ${paint('gray', `(${files.length} files, all present)`)}`,
      );
      return;
    }
    if (!DRY) {
      for (const f of FORCE ? files : missing) {
        const src = join(from, f);
        const dst = join(to, f);
        mkdirSync(dirname(dst), { recursive: true });
        cpSync(src, dst);
      }
    }
    const partial = missing.length !== files.length && !FORCE;
    done.push(
      `${destRel} ${paint('gray', partial ? `(${missing.length} of ${files.length} files added)` : `(${files.length} files)`)}`,
    );
    return;
  }

  if (existsSync(to) && !FORCE) {
    skipped.push(`${destRel} ${paint('gray', '(exists)')}`);
    return;
  }
  if (!DRY) {
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
    if (destRel.startsWith('.husky/')) chmodSync(to, 0o755);
  }
  done.push(destRel);
}

/** The git hooks, which are merged rather than copied — see `mergeHuskyHooks`. */
const HOOKS = ['pre-commit', 'commit-msg', 'post-commit'];

/**
 * Put the gate into the target's git hooks without discarding what is there.
 *
 * Skipping an existing hook the way an ordinary file is skipped was the worst
 * outcome available: everything else lands, the export reports success, and the
 * gate never runs because nothing invokes it. A project that already had a
 * `pre-commit` — most do — got a quality gate that was silently absent.
 *
 * So an existing hook keeps its contents and gains a line calling ours. Order
 * matters: theirs runs first, because a hook that formats or stages files
 * should do so before the gate inspects the result.
 */
function mergeHuskyHooks() {
  for (const hook of HOOKS) {
    const rel = `.husky/${hook}`;
    const from = join(SRC, rel);
    const to = join(TARGET, rel);
    if (!existsSync(from)) continue;

    const ours = readFileSync(from, 'utf8').trim();

    if (!existsSync(to)) {
      if (!DRY) {
        mkdirSync(dirname(to), { recursive: true });
        cpSync(from, to);
        chmodSync(to, 0o755);
      }
      done.push(rel);
      continue;
    }

    const theirs = readFileSync(to, 'utf8');
    if (theirs.includes(`scripts/hooks/${hook}.mjs`)) {
      skipped.push(`${rel} ${paint('gray', '(already calls the gate)')}`);
      continue;
    }

    if (!DRY) {
      const merged = `${theirs.replace(/\s*$/, '')}\n\n# Added by the agent toolkit — runs the quality gate.\n${ours}\n`;
      writeFileSync(to, merged);
      chmodSync(to, 0o755);
    }
    done.push(`${rel} ${paint('gray', '(your hook kept; the gate appended)')}`);
  }
}

function copySkills() {
  const dir = join(SRC, '.claude/skills');
  for (const name of readdirSync(dir).sort()) {
    copyPath(`.claude/skills/${name}`);
  }

  // `best-practices` is the one skill that describes a codebase rather than a
  // way of working, so it is the one most likely to be wrong for the target.
  // It still lands as itself: an earlier version parked a second copy beside it
  // under a review name, which only produced two folders both claiming to be
  // the conventions, and no signal about which one anything should follow.
  //
  // Files already present are left alone, as everywhere else — so a target that
  // has edited this skill keeps its edits, and is told rather than surprised.
  const bp = join(TARGET, '.claude/skills/best-practices');
  if (existsSync(bp) && differsFromSource('.claude/skills/best-practices')) {
    warned.push(
      "best-practices differs from this repo's — kept yours. Compare with:\n" +
        `      diff -ru ${relative(process.cwd(), bp)} <boilerplate>/.claude/skills/best-practices\n` +
        "      It describes THIS repo's conventions; check they are also yours.",
    );
  }
}

/** True when any file of `rel` present in the target differs from the source. */
function differsFromSource(rel) {
  const from = join(SRC, rel);
  const to = join(TARGET, rel);
  return filesUnder(from).some((f) => {
    const a = join(from, f);
    const b = join(to, f);
    return existsSync(b) && readFileSync(a, 'utf8') !== readFileSync(b, 'utf8');
  });
}

function mergePackageJson() {
  const srcPkg = JSON.parse(readFileSync(join(SRC, 'package.json'), 'utf8'));
  const dstPath = join(TARGET, 'package.json');
  const dstPkg = JSON.parse(readFileSync(dstPath, 'utf8'));

  const added = { scripts: [], devDependencies: [] };
  const conflicts = [];

  dstPkg.scripts ??= {};
  for (const key of SCRIPTS) {
    const val = srcPkg.scripts?.[key];
    if (!val) continue;
    if (dstPkg.scripts[key] && dstPkg.scripts[key] !== val) {
      if (FORCE) {
        dstPkg.scripts[key] = val;
        added.scripts.push(key);
      } else
        conflicts.push(`script "${key}": target has "${dstPkg.scripts[key]}"`);
    } else if (!dstPkg.scripts[key]) {
      dstPkg.scripts[key] = val;
      added.scripts.push(key);
    }
  }

  dstPkg.devDependencies ??= {};
  for (const dep of DEV_DEPS) {
    const val = srcPkg.devDependencies?.[dep];
    if (!val) continue;
    const have = dstPkg.devDependencies[dep] ?? dstPkg.dependencies?.[dep];
    if (have) {
      // A major behind is the obvious break. A *minor* matters too where a
      // specific release added the feature the toolkit calls: eslint gained
      // `--suppress-all` in 9.24, so 9.23 satisfies a major check and then
      // fails on the very first `lint:baseline`.
      const need = MINIMUM_VERSIONS[dep];
      const short = need ? compare(have, need) < 0 : major(have) < major(val);

      if (short) {
        conflicts.push(
          `devDep "${dep}": target has ${have}, needs ${need ?? val} — ${WHY_IT_MATTERS[dep] ?? 'the toolkit expects the newer one'}`,
        );
      }
      continue;
    }
    dstPkg.devDependencies[dep] = val;
    added.devDependencies.push(dep);
  }
  dstPkg.devDependencies = Object.fromEntries(
    Object.entries(dstPkg.devDependencies).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  );

  if (!dstPkg['lint-staged']) {
    dstPkg['lint-staged'] = srcPkg['lint-staged'];
    added.scripts.push('lint-staged config');
  } else {
    conflicts.push(
      'lint-staged: target already has its own config — merge by hand',
    );
  }

  // The lint scripts arrive globbing `{src,test}`. ESLint treats a glob that
  // matches nothing as an error, so in a project that keeps its tests beside the
  // source those scripts fail before linting anything.
  const roots = ['src', 'test'].filter((d) => existsSync(join(TARGET, d)));
  const glob =
    roots.length === 1
      ? `'${roots[0]}/**/*.ts'`
      : `'{${roots.join(',')}}/**/*.ts'`;
  for (const key of [
    'lint',
    'lint:check',
    'lint:baseline',
    'lint:baseline:prune',
  ]) {
    const script = dstPkg.scripts?.[key];
    if (script?.includes('{src,test}')) {
      dstPkg.scripts[key] = script.replace(
        /'?\{src,test\}\/\*\*\/\*\.ts'?/,
        glob,
      );
    }
  }

  if (!DRY) writeFileSync(dstPath, `${JSON.stringify(dstPkg, null, 2)}\n`);
  return { added, conflicts };
}

/**
 * The `architecture-documentation` skill links to `docs/adr/README.md` as the
 * canonical ADR policy, and `docs:check` follows that link. Copy the skill into
 * a project with no `docs/adr/` and the very first `verify` fails on a link the
 * developer did not write — which reads as "this toolkit broke my repo".
 *
 * So the export brings the policy the skill refers to. The index is empty
 * because the decisions belong to the project, not to the boilerplate.
 */
function scaffoldAdrPolicy() {
  const rel = 'docs/adr/README.md';
  const dst = join(TARGET, rel);
  if (existsSync(dst)) {
    skipped.push(`${rel} ${paint('gray', '(exists)')}`);
    return;
  }
  if (!DRY) {
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, ADR_POLICY);
  }
  done.push(`${rel} ${paint('gray', '(policy scaffold, empty index)')}`);
}

const ADR_POLICY = `# Architecture Decision Records

An ADR records _why_ a decision was made. The code shows what was decided; only
this says what the alternatives were and why they lost.

## The records

| #   | Decision                | Status |
| --- | ----------------------- | ------ |
| —   | _No ADRs recorded yet._ | —      |

## When an ADR is required

All three must be true:

1. **Hard to reverse** — changing your mind later costs real work.
2. **Surprising without context** — a future reader will look at the code and
   ask "why on earth is it done this way?"
3. **A genuine trade-off** — there were real alternatives and one was chosen
   for specific reasons.

If it is easy to reverse, skip it — you will just reverse it. If it is not
surprising, nobody will wonder. If there was no alternative, there is nothing
to record beyond "we did the obvious thing".

### Always an ADR

- Adopting a framework or library as canonical architecture
- Module ownership or boundary changes
- Authentication or authorization model changes
- Persistence or storage strategy changes
- Infrastructure or deployment strategy changes
- Major cross-cutting conventions

### Never an ADR

Routine implementation detail. Which loop you used, how a function is named,
anything a reader can see from the code and would not question.

## Format

Filename \`NNNN-kebab-slug.md\`, four digits, sequential — take the highest
number present and add one.

\`\`\`md
# ADR 0001 — Short statement of the decision

- **Status:** Accepted
- **Date:** YYYY-MM-DD

## Context

What forced a decision. The constraints, and what was actually observed —
not a general essay on the topic.

## Decision

What was chosen, stated plainly.

## Consequences

What this costs as well as what it buys. An ADR with only upsides is an
advertisement, not a record.
\`\`\`

\`Status\` and \`Date\` are required and checked by the documentation stage of the
quality gate. Everything below the header block is guidance: a three-sentence
ADR that captures a real trade-off beats a templated one that fills every
heading and says nothing.

\`Status\` is one of \`Accepted\`, \`Proposed\`, \`Deprecated\`, or
\`Superseded by ADR-NNNN\`.

## Superseding

Do not edit a decision that turned out wrong — that erases the reasoning
someone may need. Write a new ADR, set the old one to
\`Superseded by ADR-NNNN\`, and link them both ways. The trail is the point.
`;

function mergeClaudeSettings() {
  const srcSettings = JSON.parse(
    readFileSync(join(SRC, '.claude/settings.json'), 'utf8'),
  );
  const dstPath = join(TARGET, '.claude/settings.json');

  if (!existsSync(dstPath)) {
    if (!DRY) {
      mkdirSync(dirname(dstPath), { recursive: true });
      writeFileSync(dstPath, `${JSON.stringify(srcSettings, null, 2)}\n`);
    }
    done.push('.claude/settings.json');
    return;
  }

  const dst = JSON.parse(readFileSync(dstPath, 'utf8'));
  dst.skillOverrides = { ...srcSettings.skillOverrides, ...dst.skillOverrides };
  dst.hooks ??= {};
  for (const [event, entries] of Object.entries(srcSettings.hooks ?? {})) {
    const existing = JSON.stringify(dst.hooks[event] ?? []);
    const missing = entries.filter(
      (e) => !existing.includes(JSON.stringify(e.hooks[0].command)),
    );
    dst.hooks[event] = [...(dst.hooks[event] ?? []), ...missing];
  }
  if (!DRY) writeFileSync(dstPath, `${JSON.stringify(dst, null, 2)}\n`);
  done.push(`.claude/settings.json ${paint('gray', '(merged)')}`);
}

function handleEslintConfig() {
  const dst = join(TARGET, 'eslint.config.mjs');
  if (!existsSync(dst)) {
    copyPath('eslint.config.mjs');
    return;
  }
  // Already ours from a previous run — leave it alone rather than depositing a
  // second copy beside it on every re-run.
  if (
    readFileSync(dst, 'utf8') ===
    readFileSync(join(SRC, 'eslint.config.mjs'), 'utf8')
  ) {
    skipped.push(`eslint.config.mjs ${paint('gray', '(already ours)')}`);
    return;
  }
  // The target has its own flat config. Leaving ours beside it as a second file
  // and asking for a manual merge was the worst option available: the rules get
  // copied, nothing loads them, and the gate reports green while enforcing
  // nothing — a silence that looks exactly like success.
  //
  // So keep their config verbatim under a new name and take over
  // `eslint.config.mjs` with a wrapper that spreads theirs and appends the
  // plugin. Nothing of theirs is parsed or rewritten, and `git diff` shows the
  // whole of what changed.
  if (!DRY) {
    const kept = 'eslint.config.project.mjs';
    if (!existsSync(join(TARGET, kept))) {
      cpSync(dst, join(TARGET, kept));
    }
    writeFileSync(dst, eslintWrapper(kept));
  }
  done.push(
    `eslint.config.mjs ${paint('gray', '(wrapped; yours kept as eslint.config.project.mjs)')}`,
  );
}

/**
 * A flat config that loads the project's own, then adds the custom rules.
 *
 * Spread rather than parsed: a flat config is an array at runtime whether it was
 * written as a literal or built by `tseslint.config()`, so this composes with
 * both without needing to understand either.
 */
function eslintWrapper(keptFile) {
  const rules = Object.keys(nestjsRuleNames())
    .map((name) => `      'nestjs/${name}': 'error',`)
    .join('\n');

  return `// Generated when the agent toolkit was exported into this project.
//
// Your original config is untouched in ./${keptFile} — edit that for anything
// project-specific. This file exists only to add the custom \`nestjs/*\` rules,
// which encode the conventions in .claude/skills/best-practices/.
//
// Existing violations are recorded in eslint-suppressions.json, so these bind
// new code only. Regenerate that with the lint:baseline script.
import base from './${keptFile}';
import nestjs from './tools/eslint-rules/index.mjs';

export default [
  ...(Array.isArray(base) ? base : [base]),
  {
    ignores: ['tools/**', 'scripts/**', 'dist/**', 'coverage/**'],
  },
  {
    plugins: { nestjs },
    linterOptions: {
      // A stale \`eslint-disable\` hides the fact that a rule now passes.
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
${rules}
    },
  },
];
`;
}

/** Rule names as the plugin exports them, so the list cannot drift. */
function nestjsRuleNames() {
  const src = readFileSync(join(SRC, 'tools/eslint-rules/index.mjs'), 'utf8');
  const names = {};
  for (const m of src.matchAll(/'([a-z][a-z0-9-]+)':/g)) names[m[1]] = true;
  return names;
}

/* ---------------------------------------------------------------------- run */

line();
line(
  paint(
    'bold',
    `  Export agent toolkit${DRY ? paint('yellow', '  [dry run]') : ''}`,
  ),
);
line(paint('gray', `  from ${SRC}`));
line(paint('gray', `  into ${TARGET}`));
line();

const problems = preflight();
if (problems.length) {
  for (const p of problems) line(`  ${paint('red', '✗')} ${p}`);
  line();
  process.exit(1);
}

copySkills();
for (const rel of PORTABLE) copyPath(rel);
mergeHuskyHooks();
handleEslintConfig();
scaffoldAdrPolicy();
mergeClaudeSettings();
const pkg = mergePackageJson();

/* ------------------------------------------------------------------- report */

line(paint('bold', `  Copied (${done.length})`));
for (const d of done) line(`    ${paint('green', '+')} ${d}`);

if (skipped.length) {
  line();
  line(
    paint(
      'bold',
      `  Skipped (${skipped.length}) ${paint('gray', '— pass --force to overwrite')}`,
    ),
  );
  for (const s of skipped) line(`    ${paint('gray', '·')} ${s}`);
}

line();
line(paint('bold', '  package.json'));
if (pkg.added.scripts.length)
  line(`    ${paint('green', '+')} scripts: ${pkg.added.scripts.join(', ')}`);
if (pkg.added.devDependencies.length)
  line(
    `    ${paint('green', '+')} devDeps: ${pkg.added.devDependencies.join(', ')}`,
  );
if (!pkg.added.scripts.length && !pkg.added.devDependencies.length)
  line(paint('gray', '    nothing to add'));
for (const conflict of pkg.conflicts)
  line(`    ${paint('yellow', '!')} ${conflict}`);

if (warned.length) {
  line();
  line(paint('bold', '  Needs your attention'));
  for (const w of warned) line(`    ${paint('yellow', '!')} ${w}`);
}

line();
line(paint('bold', '  Next steps in the target project'));
const PM = targetPackageManager(TARGET);
line(paint('cyan', `    cd ${relative(process.cwd(), TARGET) || '.'}`));
line(
  paint('cyan', `    ${PM} install`.padEnd(36)) +
    paint('gray', '# installs husky + eslint toolchain'),
);
// husky changed its activation command at v9: `husky install` became `husky`.
// Printing the wrong one prints a usage message and leaves the hooks off —
// silently, which is the worst way for a quality gate to be absent.
const huskyRange =
  JSON.parse(readFileSync(join(TARGET, 'package.json'), 'utf8')).devDependencies
    ?.husky ?? '';
const huskyCmd = major(huskyRange) >= 9 ? 'exec husky' : 'exec husky install';
line(
  paint('cyan', `    ${PM} ${huskyCmd}`.padEnd(36)) +
    paint('gray', '# activates the git hooks'),
);
for (const [file, cmd] of REGENERATE) {
  line(
    paint('cyan', `    ${PM} ${cmd}`.padEnd(36)) +
      paint('gray', `# regenerates ${file} — do NOT copy ours`),
  );
}
line(
  paint('cyan', `    ${PM} run verify`.padEnd(36)) +
    paint('gray', '# full gate; should pass once baselined'),
);
line();
line(
  paint('gray', '  If install stops on ') +
    paint('cyan', 'ERR_PNPM_IGNORED_BUILDS') +
    paint('gray', " (or npm's allow-scripts warning),"),
);
line(
  paint(
    'gray',
    '  a dependency wants to run an install script. Approve it once and record',
  ),
);
line(paint('gray', '  the answer, so the next person is not asked again.'));

line();
line(paint('bold', '  If you want it gone'));
line(
  paint('cyan', '    git checkout . && git clean -fd  ') +
    paint('gray', '# undoes this export completely'),
);
line();
line(
  paint(
    'gray',
    "  Then write the target's own CLAUDE.md / AGENTS.md, and read",
  ),
);
line(
  paint(
    'gray',
    '  .claude/skills/best-practices — it describes the boilerplate, so edit it',
  ),
);
line(paint('gray', '  to match how this project actually builds.'));
line();

if (DRY) line(paint('yellow', '  Dry run — nothing was written.\n'));
