/**
 * Builds the import graph of `src/` and derives the module graph from it.
 *
 * Deliberately a small deterministic scanner rather than a dependency-analysis
 * platform (see issue #15): the rules we need to enforce are about *which
 * module owns what*, and that question is answered by import paths alone.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
export const SRC_ROOT = join(REPO_ROOT, 'src');

const SOURCE = /\.ts$/;
const TEST = /\.(spec|e2e-spec)\.ts$/;

/** Every non-test TypeScript file under `src/`, as repo-relative paths. */
export function listSourceFiles(dir = SRC_ROOT, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, found);
    } else if (SOURCE.test(entry) && !TEST.test(entry)) {
      found.push(relative(REPO_ROOT, full));
    }
  }
  return found;
}

const IMPORT_PATTERNS = [
  /(?:^|\n)\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/g,
  /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** Raw specifiers imported by a file, in source order. */
export function readImports(file) {
  const text = readFileSync(join(REPO_ROOT, file), 'utf8');
  const specifiers = [];
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

/**
 * Resolve a specifier to a repo-relative source file, or `null` when it points
 * outside `src/` (a package, a JSON asset, a type-only node module).
 */
export function resolveSpecifier(fromFile, specifier, knownFiles) {
  let base;
  if (specifier.startsWith('src/')) {
    base = join(REPO_ROOT, specifier);
  } else if (specifier.startsWith('.')) {
    base = resolve(REPO_ROOT, dirname(fromFile), specifier);
  } else {
    return null;
  }

  const candidates = [
    `${base}.ts`,
    join(base, 'index.ts'),
    base.endsWith('.ts') ? base : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const rel = relative(REPO_ROOT, candidate);
    if (knownFiles.has(rel)) return rel;
  }
  return null;
}

/**
 * The module a file belongs to. Feature modules are `src/modules/<name>`;
 * everything directly under `src/` is shared application scaffolding.
 */
export function moduleOf(file) {
  const parts = file.split('/');
  if (parts[0] !== 'src') return null;
  if (parts[1] === 'modules') {
    // Stripe and PayPal are compound domains: the sub-feature is the unit of
    // ownership, but they share a base module.
    return `modules/${parts[2]}`;
  }
  return `src/${parts[1] ?? ''}`.replace(/\/$/, '');
}

/** File-level and module-level import graphs. */
export function buildGraph() {
  const files = listSourceFiles();
  const known = new Set(files);

  const fileEdges = new Map();
  const moduleEdges = new Map();

  for (const file of files) {
    const targets = new Set();
    for (const specifier of readImports(file)) {
      const resolved = resolveSpecifier(file, specifier, known);
      if (resolved && resolved !== file) targets.add(resolved);
    }
    fileEdges.set(file, targets);

    const from = moduleOf(file);
    if (!from) continue;
    if (!moduleEdges.has(from)) moduleEdges.set(from, new Map());
    for (const target of targets) {
      const to = moduleOf(target);
      if (!to || to === from) continue;
      if (!moduleEdges.get(from).has(to)) moduleEdges.get(from).set(to, []);
      moduleEdges.get(from).get(to).push({ file, target });
    }
  }

  return { files, fileEdges, moduleEdges };
}

/**
 * Hard ceiling on the search below. A codebase with this many distinct module
 * cycles has a structural problem that listing every one of them will not
 * help with, and the enumeration is combinatorial — a fully interconnected
 * set of a dozen modules exhausts the heap. Stopping with an honest "too
 * tangled to enumerate" beats hanging or crashing a git hook.
 */
const MAX_CYCLES = 200;

/** Paths explored before the search gives up, for the same reason. */
const MAX_PATH_STEPS = 200_000;

/**
 * Every elementary cycle in a graph, each reported once.
 *
 * A DFS from each node in turn, exploring paths rather than marking nodes
 * globally visited. A single shared `visited` set is the tempting shortcut
 * and it is wrong: once a node had been popped it would never be re-entered,
 * so `a->b, a->c, b->d, c->d, d->a` reported only the first of its two
 * cycles. A guardrail that silently misses cases is worse than none.
 *
 * `next < start` is what makes each cycle appear once rather than once per
 * member: by the time `start` is reached, every cycle containing a smaller
 * node has already been reported from that node's own pass.
 *
 * Returns `{ cycles, truncated }` — `truncated` means the limits above were
 * hit and the list is partial.
 */
export function findCycles(edges) {
  const cycles = new Map();
  let steps = 0;
  let truncated = false;

  const neighbours = (node) => {
    const value = edges.get(node);
    if (!value) return [];
    return value instanceof Map ? [...value.keys()] : [...value];
  };

  for (const start of [...edges.keys()].sort()) {
    if (truncated) break;

    const stack = [start];
    const onPath = new Set([start]);

    const walk = (node) => {
      for (const next of neighbours(node)) {
        // Checked per iteration, not once on entry: a nested call that hit a
        // limit must not let this frame record one more cycle on its way out.
        if (truncated) return;

        if (next === start) {
          // Tested *before* recording, so a graph with exactly MAX_CYCLES
          // reports a complete result rather than claiming truncation, and
          // the ceiling is never exceeded.
          if (cycles.size >= MAX_CYCLES) {
            truncated = true;
            return;
          }
          cycles.set(stack.join(' -> '), [...stack]);
          continue;
        }

        if (next < start || onPath.has(next)) continue;

        if (++steps > MAX_PATH_STEPS) {
          truncated = true;
          return;
        }

        stack.push(next);
        onPath.add(next);
        walk(next);
        onPath.delete(next);
        stack.pop();
      }
    };

    walk(start);
  }

  return { cycles: [...cycles.values()], truncated };
}
