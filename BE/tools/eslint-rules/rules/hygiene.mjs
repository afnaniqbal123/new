/**
 * General hygiene rules — things that must never reach `main`.
 * @see .claude/skills/best-practices/references/architecture.md
 * @see .claude/skills/best-practices/references/testing-tooling.md
 */
import { fileName, filePath } from '../lib/helpers.mjs';

export const noBarrelFile = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'This codebase imports concrete files; barrel files are not used.',
    },
    schema: [],
    messages: {
      barrel:
        'Barrel files (`index.ts`) are not used in this codebase — they hide dependencies and slow the TypeScript build. Import the concrete file directly and delete this one.',
    },
  },
  create(context) {
    if (fileName(context) !== 'index.ts') return {};
    if (!/\/src\//.test(filePath(context))) return {};

    return {
      Program(node) {
        context.report({ node, messageId: 'barrel' });
      },
    };
  },
};

const FOCUS_METHODS = new Set(['only']);
const FOCUS_ALIASES = new Set(['fdescribe', 'fit']);
const TEST_FUNCTIONS = new Set(['describe', 'it', 'test', 'context']);

export const noFocusedTests = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A focused test silently skips the rest of the suite in CI.',
    },
    schema: [],
    messages: {
      focused:
        'Focused test (`{{name}}`) committed — CI would silently skip every other test in this file. Remove the `.only` / `f` prefix before committing.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;

        if (callee.type === 'Identifier' && FOCUS_ALIASES.has(callee.name)) {
          context.report({
            node: callee,
            messageId: 'focused',
            data: { name: callee.name },
          });
          return;
        }

        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          TEST_FUNCTIONS.has(callee.object.name) &&
          callee.property.type === 'Identifier' &&
          FOCUS_METHODS.has(callee.property.name)
        ) {
          context.report({
            node: callee,
            messageId: 'focused',
            data: { name: `${callee.object.name}.${callee.property.name}` },
          });
        }
      },
    };
  },
};
