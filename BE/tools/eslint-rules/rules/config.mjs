/**
 * Rules for configuration access and import hygiene.
 * @see .claude/skills/best-practices/references/enums-constants-config.md
 * @see .claude/skills/best-practices/references/architecture.md
 */
import path from 'node:path';
import {
  filePath,
  isBootstrapFile,
  isScriptFile,
  isTestFile,
} from '../lib/helpers.mjs';

export const noProcessEnv = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Read configuration through ConfigService so every key is declared once in the CONFIG enum.',
    },
    schema: [],
    messages: {
      processEnv:
        'Do not read `process.env` here — the key is undeclared and unvalidated. Add it to the CONFIG enum in src/constants/config.constant.ts and read it with `this.configService.get<string>(CONFIG.KEY)`.',
    },
  },
  create(context) {
    // main.ts and app.module.ts run before the DI container exists; scripts and
    // tests are outside the request lifecycle entirely.
    if (
      isBootstrapFile(context) ||
      isScriptFile(context) ||
      isTestFile(context)
    ) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || node.object.name !== 'process')
          return;
        if (node.computed) {
          if (node.property.type !== 'Literal' || node.property.value !== 'env')
            return;
        } else if (
          node.property.type !== 'Identifier' ||
          node.property.name !== 'env'
        ) {
          return;
        }

        context.report({ node, messageId: 'processEnv' });
      },
    };
  },
};

/** Top-level folders under `src/` that every module shares. */
const SHARED_ROOTS = ['constants', 'decorator', 'guards', 'types', 'utils'];

export const noCrossModuleRelativeImport = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Import shared code with absolute `src/...` paths so moving a module never breaks it.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      useAbsolute:
        'Relative import `{{source}}` climbs out of this module into shared code. Use the absolute path `{{suggestion}}` instead.',
    },
  },
  create(context) {
    const current = filePath(context);
    const srcIndex = current.lastIndexOf('/src/');
    if (srcIndex === -1) return {};

    // Only feature modules can cross a module boundary. Files sitting directly
    // under `src/` are siblings of the shared folders, so `./constants/...`
    // there is correct, not a violation.
    if (!/\/src\/modules\//.test(current)) return {};

    const srcRoot = current.slice(0, srcIndex + '/src'.length);
    const fromDir = path.posix.dirname(current);

    function check(node) {
      const source = node.source;
      if (!source || typeof source.value !== 'string') return;
      if (!source.value.startsWith('.')) return;

      const resolved = path.posix.normalize(
        path.posix.join(fromDir, source.value),
      );
      if (!resolved.startsWith(`${srcRoot}/`)) return;

      const fromSrc = resolved.slice(srcRoot.length + 1);
      const topFolder = fromSrc.split('/')[0];
      if (!SHARED_ROOTS.includes(topFolder)) return;

      const suggestion = `src/${fromSrc}`;
      context.report({
        node: source,
        messageId: 'useAbsolute',
        data: { source: source.value, suggestion },
        fix: (fixer) => fixer.replaceText(source, `'${suggestion}'`),
      });
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  },
};
