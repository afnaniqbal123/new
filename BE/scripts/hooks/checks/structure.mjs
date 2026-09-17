/**
 * Repo-layout conventions that have no AST to hang a lint rule on: file names,
 * folder contents, and per-module documentation.
 *
 * Everything here is scoped to files the commit *adds*. Renaming a legacy file
 * is a deliberate decision, not something a commit hook should force on a
 * developer who only touched one line inside it.
 *
 * @see .claude/skills/best-practices/references/naming.md
 * @see .claude/skills/best-practices/references/architecture.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../lib/git.mjs';

const NAMING_DOCS = '.claude/skills/best-practices/references/naming.md';
const ARCH_DOCS = '.claude/skills/best-practices/references/architecture.md';

/** kebab-case, with dotted qualifiers: `chat-message.schema.ts`. */
const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Folder → required filename suffix. A file in `dto/` that is not a `.dto.ts`
 * is either misplaced or misnamed; both make the module harder to navigate.
 */
const FOLDER_SUFFIX = {
  dto: '.dto.ts',
  schemas: '.schema.ts',
  guards: '.guard.ts',
  strategies: '.strategy.ts',
  enums: '.enum.ts',
  decorator: '.decorator.ts',
  decorators: '.decorator.ts',
};

/** Folders whose contents are free-form by design. */
const UNCONSTRAINED_FOLDERS = new Set([
  'constants',
  'types',
  'utils',
  'interfaces',
  'config',
  'context',
  'providers',
  'stores',
  'conversation',
  'services',
  'api-response',
  'scripts',
]);

function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

/**
 * @param {{ added: string[] }} input
 * @returns {{ findings: Array<object> }}
 */
export function run({ added }) {
  const findings = [];
  const newModules = new Set();

  for (const file of added) {
    if (!file.startsWith('src/')) continue;

    const segments = file.split('/');
    const base = segments[segments.length - 1];
    const parentFolder = segments[segments.length - 2];

    // --- Folder naming -----------------------------------------------------
    for (const folder of segments.slice(1, -1)) {
      if (KEBAB_SEGMENT.test(folder)) continue;
      findings.push({
        file,
        message: `Folder \`${folder}/\` is not kebab-case.`,
        hint: `Rename it to \`${toKebab(folder)}/\`.`,
        docs: NAMING_DOCS,
      });
      break;
    }

    if (!base.endsWith('.ts')) continue;

    // --- File naming -------------------------------------------------------
    const stem = base.replace(/\.ts$/, '');
    const badSegment = stem.split('.').find((s) => !KEBAB_SEGMENT.test(s));
    if (badSegment) {
      findings.push({
        file,
        message: `File name \`${base}\` is not kebab-case.`,
        hint: `Rename it to \`${stem.split('.').map(toKebab).join('.')}.ts\`.`,
        docs: NAMING_DOCS,
      });
    }

    // --- Folder / suffix agreement ----------------------------------------
    // Only feature modules. The base layout under `src/` is fixed by the
    // generator and documents its own filenames (e.g. `src/guards/validation.ts`
    // holds the global ValidationPipe, not a CanActivate guard).
    const requiredSuffix = file.startsWith('src/modules/')
      ? FOLDER_SUFFIX[parentFolder]
      : undefined;

    if (
      requiredSuffix &&
      !base.endsWith(requiredSuffix) &&
      !base.endsWith('.spec.ts') &&
      !UNCONSTRAINED_FOLDERS.has(parentFolder)
    ) {
      findings.push({
        file,
        message: `Files in \`${parentFolder}/\` must be named \`*${requiredSuffix}\` — \`${base}\` is not.`,
        hint: `Rename it to \`${stem.split('.')[0]}${requiredSuffix}\`, or move it out of \`${parentFolder}/\`.`,
        docs: NAMING_DOCS,
      });
    }

    // --- New feature modules need documentation ---------------------------
    const moduleMatch = file.match(
      /^(src\/modules\/[^/]+)\/[^/]+\.module\.ts$/,
    );
    if (moduleMatch) newModules.add(moduleMatch[1]);
  }

  for (const moduleDir of newModules) {
    const readme = path.join(REPO_ROOT, moduleDir, 'README.md');
    if (fs.existsSync(readme)) continue;

    findings.push({
      file: `${moduleDir}/README.md`,
      message: `New module \`${moduleDir.split('/').pop()}\` has no README.md. Every feature module documents its purpose and public API.`,
      hint: `Create ${moduleDir}/README.md describing what the module does and which endpoints/providers it exposes.`,
      docs: ARCH_DOCS,
    });
  }

  return { findings };
}
