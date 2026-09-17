#!/usr/bin/env node
/**
 * Interactive project generator for this boilerplate.
 *
 * Copies the template into a new folder, then removes every module the developer
 * did not pick — folders, `#region` blocks in shared files, and npm deps — using
 * the declarative footprint in `scripts/modules.manifest.mjs`.
 *
 *   node scripts/setup.mjs                       # ask everything
 *   node scripts/setup.mjs --name=my-api --yes   # defaults, no prompts
 *   node scripts/setup.mjs --modules=stripe,chat # explicit selection
 *   node scripts/setup.mjs --dry-run             # print the plan, write nothing
 *
 * Zero dependencies on purpose: this runs from a freshly-fetched tarball, before
 * anyone has installed anything.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import {
  MODULES,
  CORE_MODULES,
  COPY_EXCLUDE,
  ANCHORED_FILES,
  ORPHANS,
  BASELINES,
  EMAIL_PROVIDERS,
  LOCKFILE,
  resolveSelection,
} from './modules.manifest.mjs';

const TEMPLATE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const ESC = String.fromCharCode(27);
const c = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
  gray: `${ESC}[90m`,
  green: `${ESC}[32m`,
  yellow: `${ESC}[33m`,
  red: `${ESC}[31m`,
  cyan: `${ESC}[36m`,
};
const paint = (color, s) => `${c[color]}${s}${c.reset}`;
const line = (s = '') => process.stdout.write(`${s}\n`);

/* ---------------------------------------------------------------------- args */

const argv = process.argv.slice(2);
const flag = (name) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const DRY = Boolean(flag('dry-run'));
const YES = Boolean(flag('yes'));
const IN_PLACE = Boolean(flag('in-place'));
const NAME_ARG = typeof flag('name') === 'string' ? flag('name') : undefined;
const TARGET_ARG =
  typeof flag('target') === 'string' ? flag('target') : undefined;
const MODULES_ARG =
  typeof flag('modules') === 'string' ? flag('modules') : undefined;
const EMAIL_ARG = typeof flag('email') === 'string' ? flag('email') : undefined;

if (flag('help')) {
  line(`
  Usage: node scripts/setup.mjs [options]

    --name=<dir>        Project folder to create (prompted if omitted)
    --target=<path>     Absolute destination; overrides --name placement
    --modules=a,b,c     Select these optional modules, skip the picker
    --email=<provider>  Email provider to keep: brevo | ses | sendgrid
    --in-place          Convert this clone into the project, in place
    --yes               Accept defaults, ask nothing
    --dry-run           Print the plan and exit without writing
    --help              This text

  Optional modules: ${MODULES.map((m) => m.key).join(', ')}
  Email providers:  ${EMAIL_PROVIDERS.map((p) => p.key).join(', ')}
`);
  process.exit(0);
}

/* --------------------------------------------------------------- module picker */

/**
 * Arrow keys to move, space to toggle, enter to accept.
 *
 * Falls back to the defaults when stdin is not a TTY — which is what happens if
 * someone pipes this script into a shell instead of using process substitution.
 * Answering silently with defaults beats blocking forever on a read that will
 * never arrive, but say so, because a silent default is how people end up with
 * a project they did not choose.
 */
async function pickModules() {
  if (MODULES_ARG !== undefined) {
    const wanted = MODULES_ARG.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const unknown = wanted.filter((w) => !MODULES.some((m) => m.key === w));
    if (unknown.length) {
      line(paint('red', `  Unknown module(s): ${unknown.join(', ')}`));
      line(
        paint('gray', `  Available: ${MODULES.map((m) => m.key).join(', ')}`),
      );
      process.exit(2);
    }
    return wanted;
  }

  const defaults = MODULES.filter((m) => m.default).map((m) => m.key);
  if (YES) return defaults;
  if (!process.stdin.isTTY) {
    line(
      paint(
        'yellow',
        '  Not a TTY — using default module selection. Run interactively to choose.',
      ),
    );
    return defaults;
  }

  const chosen = new Set(defaults);
  let cursor = 0;

  // Width of the longest key across both lists, so the two columns line up.
  const KEY_WIDTH =
    Math.max(...[...CORE_MODULES, ...MODULES].map((m) => m.key.length)) + 2;

  let printed = 0;

  /**
   * One screen of the picker.
   *
   * Two details that are easy to get wrong and look like garbage on screen:
   * every line is erased before it is rewritten (moving the cursor up does not
   * clear what is already there, so a shorter line leaves the tail of the
   * longer one behind); and padding happens on the raw key, never on the
   * painted string — `padEnd` counts the invisible ANSI bytes, which is what
   * makes a highlighted row come out narrower than its neighbours.
   */
  const render = (first) => {
    if (!first) process.stdout.write(`${ESC}[${printed}A`);
    printed = 0;
    const put = (text = '') => {
      process.stdout.write(`${ESC}[2K${text}\n`);
      printed += 1;
    };

    put(paint('bold', '  Which modules do you want?'));
    put(paint('gray', '  ↑↓ move · space toggle · enter accept'));
    put();

    // Core first, shown ticked and locked. Listing them as unticked boxes would
    // invite unticking something the project cannot be built without; omitting
    // them entirely makes the project look like only what you chose.
    for (const m of CORE_MODULES) {
      put(
        `    ${paint('green', '◉')} ${paint('gray', m.key.padEnd(KEY_WIDTH))}` +
          `${paint('gray', m.label)}  ${paint('gray', '(always included)')}`,
      );
    }
    put();

    for (const [i, m] of MODULES.entries()) {
      const box = chosen.has(m.key) ? paint('green', '◉') : paint('gray', '○');
      const pointer = i === cursor ? paint('cyan', '›') : ' ';
      const key = m.key.padEnd(KEY_WIDTH);
      put(
        `  ${pointer} ${box} ${i === cursor ? paint('bold', key) : key}` +
          paint('gray', m.label),
      );
    }
  };

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  render(true);

  await new Promise((done) => {
    const onKey = (_str, key) => {
      if (key.name === 'up')
        cursor = (cursor - 1 + MODULES.length) % MODULES.length;
      else if (key.name === 'down') cursor = (cursor + 1) % MODULES.length;
      else if (key.name === 'space') {
        const key_ = MODULES[cursor].key;
        chosen.has(key_) ? chosen.delete(key_) : chosen.add(key_);
      } else if (key.name === 'return') {
        process.stdin.off('keypress', onKey);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        return done();
      } else if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        line();
        line(paint('gray', '  Cancelled.'));
        process.exit(130);
      }
      render(false);
    };
    process.stdin.on('keypress', onKey);
  });

  line();
  return [...chosen];
}

/**
 * Single-select sibling of `pickModules`.
 *
 * Providers are alternatives, not additions — `EMAIL_PROVIDER` activates one at
 * runtime — so this offers a radio, and enter takes whatever the cursor is on.
 */
async function pickEmailProvider() {
  const fallback =
    EMAIL_PROVIDERS.find((p) => p.default)?.key ?? EMAIL_PROVIDERS[0].key;

  if (EMAIL_ARG !== undefined) {
    if (!EMAIL_PROVIDERS.some((p) => p.key === EMAIL_ARG)) {
      line(paint('red', `  Unknown email provider: ${EMAIL_ARG}`));
      line(
        paint(
          'gray',
          `  Available: ${EMAIL_PROVIDERS.map((p) => p.key).join(', ')}`,
        ),
      );
      process.exit(2);
    }
    return EMAIL_ARG;
  }
  if (YES || !process.stdin.isTTY) return fallback;

  let cursor = Math.max(
    0,
    EMAIL_PROVIDERS.findIndex((p) => p.key === fallback),
  );
  const KEY_WIDTH = Math.max(...EMAIL_PROVIDERS.map((p) => p.key.length)) + 2;
  let printed = 0;

  const render = (first) => {
    if (!first) process.stdout.write(`${ESC}[${printed}A`);
    printed = 0;
    const put = (text = '') => {
      process.stdout.write(`${ESC}[2K${text}\n`);
      printed += 1;
    };

    put(paint('bold', '  How should this project send email?'));
    put(paint('gray', '  ↑↓ move · enter accept'));
    put();
    for (const [i, prov] of EMAIL_PROVIDERS.entries()) {
      const dot = i === cursor ? paint('green', '◉') : paint('gray', '○');
      const pointer = i === cursor ? paint('cyan', '›') : ' ';
      const key = prov.key.padEnd(KEY_WIDTH);
      put(
        `  ${pointer} ${dot} ${i === cursor ? paint('bold', key) : key}` +
          paint('gray', prov.label),
      );
    }
    put();
    put(
      paint('gray', '  The other implementations are removed, SDKs included.'),
    );
  };

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  render(true);

  await new Promise((done) => {
    const onKey = (_str, key) => {
      if (key.name === 'up')
        cursor = (cursor - 1 + EMAIL_PROVIDERS.length) % EMAIL_PROVIDERS.length;
      else if (key.name === 'down')
        cursor = (cursor + 1) % EMAIL_PROVIDERS.length;
      else if (key.name === 'return') {
        process.stdin.off('keypress', onKey);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        return done();
      } else if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        line();
        line(paint('gray', '  Cancelled.'));
        process.exit(130);
      }
      render(false);
    };
    process.stdin.on('keypress', onKey);
  });

  line();
  return EMAIL_PROVIDERS[cursor].key;
}

async function askName() {
  if (NAME_ARG) return NAME_ARG;
  if (YES || !process.stdin.isTTY) return 'my-api';
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('  Project name (my-api): ')).trim();
  rl.close();
  return answer || 'my-api';
}

/* ------------------------------------------------------------------- removal */

/**
 * Drop `#region <tag> ... #endregion <tag>` blocks, for both the `//` form used
 * in TypeScript and the `#` form used in .env and YAML.
 *
 * Unbalanced anchors are a hard error rather than a best-effort strip: silently
 * deleting to end-of-file would produce a project that fails to build with no
 * hint why.
 */
export function stripRegions(text, tags) {
  let out = text;
  for (const tag of tags) {
    const open = new RegExp(
      `^[ \\t]*(?://|#) #region ${escapeRe(tag)}[ \\t]*$`,
    );
    const close = new RegExp(
      `^[ \\t]*(?://|#) #endregion ${escapeRe(tag)}[ \\t]*$`,
    );
    const kept = [];
    let depth = 0;
    for (const l of out.split('\n')) {
      if (open.test(l)) {
        depth += 1;
        continue;
      }
      if (close.test(l)) {
        if (depth === 0) throw new Error(`#endregion ${tag} without #region`);
        depth -= 1;
        continue;
      }
      if (depth === 0) kept.push(l);
    }
    if (depth !== 0) throw new Error(`#region ${tag} was never closed`);
    out = kept.join('\n');
  }
  // Collapse the runs of blank lines that removal leaves behind, including the
  // one left stranded before a closing brace — Prettier rejects that, and a
  // generated project that fails its own formatter on line one is not a good
  // first impression.
  return out
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n\n+(\s*[}\])])/g, '\n$1')
    .replace(/\n{2,}$/, '\n');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Non-overlapping occurrences of a literal needle. */
function countMatches(haystack, needle) {
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count += 1;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

/** Copy the template, skipping anything in COPY_EXCLUDE at any depth. */
function copyTemplate(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    if (COPY_EXCLUDE.has(entry)) continue;
    const src = join(from, entry);
    const dst = join(to, entry);
    if (statSync(src).isDirectory()) copyTemplate(src, dst);
    else cpSync(src, dst);
  }
}

/**
 * Where the project lands when no `--target` was given.
 *
 * Normally that is a folder in the current directory. The exception is running
 * from inside a clone of the template itself — the "clone it, then run the
 * wizard" path — where the natural reading of `my-api` is a project beside the
 * clone, not one buried inside it. Nesting it there would leave the new project
 * carrying the template's `.git`, its own copy inside its parent's `src`, and a
 * generated project that is a subdirectory of the boilerplate forever.
 */
/** True when this script is running from a clone of the template itself. */
function isTemplateRoot() {
  return (
    existsSync(join(TEMPLATE_ROOT, '.boilerplate-template')) &&
    (process.cwd() === TEMPLATE_ROOT ||
      process.cwd().startsWith(`${TEMPLATE_ROOT}/`))
  );
}

/** Uncommitted tracked changes, ignoring untracked files. */
function isDirty(dir) {
  const res = spawnSync(
    'git',
    ['status', '--porcelain', '--untracked-files=no'],
    { cwd: dir, encoding: 'utf8' },
  );
  return res.status === 0 && res.stdout.trim().length > 0;
}

function resolveDefaultTarget(name) {
  const insideTemplate = isTemplateRoot();

  return insideTemplate
    ? join(dirname(TEMPLATE_ROOT), name)
    : resolve(process.cwd(), name);
}

/* ---------------------------------------------------------------------- main */

async function main() {
  line();
  line(
    paint('bold', '  NestJS boilerplate setup') +
      (DRY ? paint('yellow', '  [dry run]') : ''),
  );
  line(paint('gray', `  template: ${TEMPLATE_ROOT}`));
  line();

  // In place, the folder is already chosen — it is the one we are standing in,
  // and asking for a name would only be asking what to call `package.json`.
  const name = IN_PLACE
    ? (NAME_ARG ?? basename(TEMPLATE_ROOT))
    : await askName();
  if (name.includes('/') || name === '.' || name === '..') {
    line(paint('red', `  Project name must be a single folder name: ${name}`));
    process.exit(2);
  }

  if (IN_PLACE && !isTemplateRoot()) {
    line(
      paint(
        'red',
        '  --in-place only works inside a clone of the boilerplate itself.',
      ),
    );
    process.exit(2);
  }

  // Rewriting the clone is the one destructive mode here, so it is gated on a
  // clean tree: `git checkout . && git clean -fd` then puts the template back
  // exactly, and a fresh clone already satisfies it.
  if (IN_PLACE && !DRY && isDirty(TEMPLATE_ROOT)) {
    line(paint('red', '  Working tree has uncommitted changes.'));
    line(paint('gray', '    Commit or stash first, so this stays undoable.'));
    process.exit(1);
  }

  const target = IN_PLACE
    ? TEMPLATE_ROOT
    : TARGET_ARG
      ? isAbsolute(TARGET_ARG)
        ? TARGET_ARG
        : resolve(process.cwd(), TARGET_ARG)
      : resolveDefaultTarget(name);

  if (!IN_PLACE && existsSync(target) && readdirSync(target).length > 0) {
    line(paint('red', `  Target already exists and is not empty: ${target}`));
    process.exit(1);
  }

  const picked = await pickModules();
  const { selected, added } = resolveSelection(picked);
  const dropped = MODULES.filter((m) => !selected.has(m.key));

  const emailProvider = await pickEmailProvider();
  const droppedProviders = EMAIL_PROVIDERS.filter(
    (prov) => prov.key !== emailProvider,
  );

  for (const { need, because } of added) {
    line(paint('yellow', `  + ${need} kept — ${because} depends on it`));
  }

  // Verify every anchor the manifest promises actually exists, before any
  // writing. A renamed region would otherwise silently leave dead code behind.
  const tags = [...dropped, ...droppedProviders].map((entry) => entry.region);
  for (const rel of ANCHORED_FILES) {
    const file = join(TEMPLATE_ROOT, rel);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const tag of tags) {
      // Count, don't merely detect: two opens and one close reads as "both
      // present" and would slip through to stripRegions, which throws only
      // after the template has already been copied — leaving a half-built
      // project behind that a rerun then refuses to overwrite.
      const opens = countMatches(text, `#region ${tag}`);
      const closes = countMatches(text, `#endregion ${tag}`);
      if (opens !== closes) {
        line(
          paint(
            'red',
            `  Unbalanced anchors in ${rel}: ${opens} × #region ${tag}, ${closes} × #endregion`,
          ),
        );
        process.exit(1);
      }
    }
  }

  line(paint('bold', '  Plan'));
  line(
    `    ${paint('green', 'keep')}   ${[...selected].sort().join(', ') || '(none)'}`,
  );
  line(
    `    ${paint('red', 'drop')}   ${dropped.map((m) => m.key).join(', ') || '(none)'}`,
  );
  line(
    paint('gray', `    core   ${CORE_MODULES.map((m) => m.key).join(', ')}`),
  );
  line(
    `    ${paint('cyan', 'email')}  sends via ${paint('bold', emailProvider)}` +
      paint(
        'gray',
        droppedProviders.length
          ? ` — removing ${droppedProviders.map((x) => x.key).join(', ')}`
          : '',
      ),
  );
  line();
  line(paint('gray', `    into   ${target}`));
  line();

  if (DRY) {
    line(paint('yellow', '  Dry run — nothing written.'));
    line();
    return;
  }

  // In place there is nothing to copy: the removal passes below run against the
  // clone itself. The template markers go, because this folder is a project now.
  if (IN_PLACE) {
    for (const rel of ['.boilerplate-template', 'create.sh']) {
      rmSync(join(target, rel), { force: true });
    }
  } else {
    copyTemplate(TEMPLATE_ROOT, target);
  }

  const removed = [];
  for (const m of [...dropped, ...droppedProviders]) {
    for (const rel of [...(m.folders ?? []), ...(m.files ?? [])]) {
      const p = join(target, rel);
      if (existsSync(p)) {
        rmSync(p, { recursive: true, force: true });
        removed.push(rel);
      }
    }
  }

  for (const rel of ANCHORED_FILES) {
    const file = join(target, rel);
    if (!existsSync(file)) continue;
    writeFileSync(file, stripRegions(readFileSync(file, 'utf8'), tags));
  }

  // Point EMAIL_PROVIDER at what was actually kept. Leaving the template's
  // default would hand the project an env file naming a provider whose
  // implementation was just deleted — and the factory refuses to boot on that.
  const envPath = join(target, '.env.example');
  if (existsSync(envPath)) {
    writeFileSync(
      envPath,
      readFileSync(envPath, 'utf8')
        .replace(/^EMAIL_PROVIDER=.*$/m, `EMAIL_PROVIDER=${emailProvider}`)
        // Naming providers that were just deleted would be an invitation to set
        // a value the factory refuses to boot on.
        .replace(
          /^# EMAIL_PROVIDER_CHOICES$/m,
          `# Available in this build: ${emailProvider}`,
        ),
    );
  }

  // Prune the debt ledgers of entries pointing at code that no longer exists.
  // Left alone they are merely stale; but `architecture:check` reports baselined
  // items that no longer occur and tells you to shrink the file, so a generated
  // project would open with a chore it did not create.
  const removedPrefixes = dropped.flatMap((m) => [
    ...(m.folders ?? []),
    ...(m.files ?? []),
  ]);
  const pointsAtRemoved = (text) =>
    removedPrefixes.some((prefix) => text.includes(prefix));

  for (const { file, shape } of BASELINES) {
    const p = join(target, file);
    if (!existsSync(p)) continue;
    const data = JSON.parse(readFileSync(p, 'utf8'));
    if (shape === 'keys') {
      for (const key of Object.keys(data)) {
        if (pointsAtRemoved(key)) delete data[key];
      }
    } else {
      data.accepted = data.accepted.filter(
        (e) => !pointsAtRemoved(`${e.key} ${e.detail ?? ''}`),
      );
    }
    writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  }

  // package.json: prune deps, drop orphaned scripts, rename the project.
  const pkgPath = join(target, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = name;
  const prunedDeps = [];
  for (const m of [...dropped, ...droppedProviders]) {
    for (const dep of m.deps ?? []) {
      if (pkg.dependencies?.[dep]) {
        delete pkg.dependencies[dep];
        prunedDeps.push(dep);
      }
    }
  }
  // `src/modules/email/meta.json` lists the module's SDKs and nothing reads it,
  // so it drifts silently. Prune it with the same list rather than leave a file
  // claiming the project depends on providers that were just deleted.
  const metaPath = join(target, 'src/modules/email/meta.json');
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    for (const dep of prunedDeps) delete meta.dependencies?.[dep];
    writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  }

  for (const orphan of ORPHANS) {
    if (orphan.needsAnyOf.some((k) => selected.has(k))) continue;
    const p = join(target, orphan.file);
    if (existsSync(p)) {
      rmSync(p, { force: true });
      removed.push(orphan.file);
    }
    if (orphan.script && pkg.scripts?.[orphan.script]) {
      delete pkg.scripts[orphan.script];
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  // A lockfile that disagrees with package.json is worse than none: the copied
  // CI runs `pnpm install --frozen-lockfile`, which fails outright rather than
  // reconciling. See LOCKFILE in the manifest.
  const lockPath = join(target, LOCKFILE);
  const lockfileDropped = prunedDeps.length > 0 && existsSync(lockPath);
  if (lockfileDropped) rmSync(lockPath, { force: true });

  /* ------------------------------------------------------------- the report */

  line(
    paint(
      'bold',
      IN_PLACE ? `  Converted this clone into ${name}` : `  Created ${name}`,
    ),
  );
  if (removed.length) {
    line();
    line(paint('bold', `  Removed (${removed.length})`));
    for (const r of removed) line(`    ${paint('red', '-')} ${r}`);
  }
  if (prunedDeps.length) {
    line();
    line(paint('bold', '  Pruned dependencies'));
    line(`    ${paint('red', '-')} ${prunedDeps.join(', ')}`);
  }

  if (lockfileDropped) {
    line();
    line(paint('bold', '  Lockfile'));
    line(
      `    ${paint('yellow', '!')} ${LOCKFILE} removed — it still pinned the pruned packages.`,
    );
    line(
      paint(
        'gray',
        '      The first `pnpm install` writes a correct one. Commit it.',
      ),
    );
  }

  if (IN_PLACE) {
    line();
    line(paint('bold', '  One thing to change'));
    line(paint('gray', '    This folder still points at the boilerplate:'));
    line(paint('cyan', '    git remote set-url origin <your-new-repo>'));
  }

  line();
  line(paint('bold', '  Next steps'));
  if (!IN_PLACE) line(paint('cyan', `    cd ${name}`));
  line(
    paint('cyan', '    pnpm install'.padEnd(36)) +
      paint(
        'gray',
        lockfileDropped
          ? '# writes a fresh lockfile; activates git hooks'
          : '# also activates the git hooks',
      ),
  );
  line(
    paint('cyan', '    cp .env.example .env'.padEnd(36)) +
      paint('gray', '# then fill in the values'),
  );
  line(
    paint('cyan', '    pnpm run verify'.padEnd(36)) +
      paint('gray', '# proves the removal left a working project'),
  );

  line();
  line(
    paint('gray', '    If install stops on ') +
      paint('cyan', 'ERR_PNPM_IGNORED_BUILDS') +
      paint('gray', ', a dependency added an'),
  );
  line(
    paint(
      'gray',
      '    install script the template has not ruled on. Run `pnpm approve-builds`,',
    ),
  );
  line(
    paint(
      'gray',
      '    then record the answer in pnpm-workspace.yaml so nobody is asked twice.',
    ),
  );
  line();

  line();
  line(
    paint(
      'gray',
      '  `verify` is the check that matters here: it type-checks and lints the',
    ),
  );
  line(
    paint(
      'gray',
      '  generated project, so a bad removal fails loudly now rather than later.',
    ),
  );
  line();
}

// Importable for tests; only runs the wizard when invoked directly.
if (process.argv[1] && resolve(process.argv[1]).endsWith('setup.mjs')) {
  await main();
}
