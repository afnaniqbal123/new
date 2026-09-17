import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

/**
 * Local plugin implementing Impeccable's "no arbitrary values" intent for Tailwind:
 * flags className arbitrary values like `text-[#abc123]`, `w-[127px]`, `gap-[17px]`.
 * Components must reference design tokens (see AGENTS.md § Styling), never raw values.
 */
const impeccable = {
  rules: {
    'no-arbitrary-tailwind-values': {
      meta: {
        type: 'problem',
        docs: { description: 'Disallow arbitrary Tailwind values; use design tokens instead.' },
        schema: [],
        messages: {
          arbitrary:
            'Arbitrary Tailwind value "{{ value }}" is not allowed. Use a design token from src/index.css (@theme).',
        },
      },
      create(context) {
        const ARBITRARY = /(^|[\s:])[\w-]+-\[[^\]]+\]/;
        function check(node, raw) {
          if (typeof raw === 'string' && ARBITRARY.test(raw)) {
            context.report({ node, messageId: 'arbitrary', data: { value: raw.trim() } });
          }
        }
        return {
          JSXAttribute(node) {
            if (node.name.name !== 'className') return;
            const value = node.value;
            if (!value) return;
            if (value.type === 'Literal') check(value, value.value);
            if (value.type === 'JSXExpressionContainer' && value.expression.type === 'Literal') {
              check(value.expression, value.expression.value);
            }
          },
        };
      },
    },
  },
};

/**
 * Local plugin enforcing the role system's own folder-privacy rule: `src/components/<role>/`
 * is scoped to that role's own pages/components (AGENTS.md § Directory Map — "Components
 * scoped to one role's own pages... add at this level, mirrored by src/pages/<role>/").
 * Nothing outside `src/components/<role>/**` or `src/pages/<role>/**` may import from it.
 *
 * Deliberately generic instead of a per-role hardcoded list: it only excludes the small,
 * stable set of documented non-role "concern" folders under src/components/ (AGENTS.md rule
 * #1's own zero-lock-in exception list — common/auth/example/layouts) and treats every other
 * `src/components/<X>/` as role-private. This means adding a new role never touches this
 * file — AGENTS.md's own promise that adding a role "touches exactly three places" (roles.ts,
 * ProtectedRoutes.tsx, src/pages/<role>/) stays true; a hardcoded per-role allowlist here
 * would have silently added an undocumented fourth place to keep in sync.
 */
const roleBoundaries = {
  rules: {
    'no-cross-role-component-import': {
      meta: {
        type: 'problem',
        docs: {
          description:
            "Disallow importing from src/components/<role>/ outside that role's own components/pages.",
        },
        schema: [],
        messages: {
          crossRole:
            'Cannot import from "src/components/{{role}}/" here — that folder is private to the {{role}} role (only src/components/{{role}}/** and src/pages/{{role}}/** may import from it). See AGENTS.md § Directory Map.',
        },
      },
      create(context) {
        // Documented, stable non-role folders under src/components/ (AGENTS.md rule #1) —
        // never role-private, and this list doesn't grow when a role is added.
        // Folders under src/components/ that are *concerns*, not roles — the
        // rule treats every other folder there as private to a role of the
        // same name. Updated for BusinessOS: `example` was the boilerplate's
        // demo feature and no longer exists, while `catalog` and `landing` are
        // real concern folders per AGENTS.md § Directory Map ("a component that
        // isn't role-specific gets its own folder at components/<concern>/").
        const CONCERN_FOLDERS = new Set([
          'common',
          'auth',
          'layouts',
          'catalog',
          'landing',
          // `settings` is a concern, not a role: the settings page is reachable
          // by every role (`roles: 'all'`), and it is the *permission* inside
          // the page — not the route — that decides who may change anything.
          'settings',
        ]);
        const IMPORT_SOURCE = /(?:^|\/)src\/components\/([^/]+)\//;
        const filename = context.filename.replace(/\\/g, '/');

        function checkSource(node, source) {
          if (typeof source !== 'string') return;
          const match = IMPORT_SOURCE.exec(source);
          if (!match) return;
          const role = match[1];
          if (CONCERN_FOLDERS.has(role)) return;
          const ownedByRole =
            filename.includes(`/src/components/${role}/`) ||
            filename.includes(`/src/pages/${role}/`);
          if (ownedByRole) return;
          context.report({ node, messageId: 'crossRole', data: { role } });
        }

        return {
          ImportDeclaration(node) {
            checkSource(node, node.source.value);
          },
          ImportExpression(node) {
            if (node.source.type === 'Literal') checkSource(node, node.source.value);
          },
        };
      },
    },
  },
};

export default tseslint.config(
  // A flat-config object only acts as a true *global* ignore when `ignores`
  // is its sole key — bundled with `linterOptions` (below) it silently
  // stopped being global, which is how a stale local build (dist/, dist-e2e/)
  // ended up getting linted as if it were source. Keep this object
  // ignores-only.
  {
    ignores: [
      'node_modules',
      'dist',
      'dist-e2e',
      'build',
      '.husky',
      '*.min.js',
      'src/mocks/browser-worker/**',
      // Generated MSW service worker.
      'public/mockServiceWorker.js',
      // Playwright's own run output (see .gitignore).
      'test-results',
      'playwright-report',
      'blob-report',
      '.playwright',
      // Vendored agent-skill installs (`npx impeccable install`) — gitignored, not
      // boilerplate source; see .gitignore for the full list.
      '.claude/skills/impeccable/**',
      '.cursor/skills/**',
      '.cursor/agents/**',
      '.github/skills/**',
      '.github/agents/**',
      '.github/hooks/**',
    ],
  },
  {
    // Bypassing a rule inline is itself a policy violation. Change the central config
    // with a documented rationale instead of weakening enforcement at the call site.
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },

  // Base JS + TS (type-checked) sets. `strictTypeChecked` (not `recommendedTypeChecked`)
  // is the strongest maintained preset typescript-eslint ships — see AGENTS.md §
  // The Quality Gate for the audit that confirmed this repo is clean against it.
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,

  // Maintained "recommended" flat config (not the newer, still-experimental
  // "recommended-latest" React Compiler rule set) — replaces hand-maintained
  // react-hooks rules so new rules the plugin adds are picked up automatically.
  reactHooks.configs.flat.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      'react-refresh': reactRefresh,
      impeccable,
    },
    rules: {
      // Start from maintained React and Hooks presets, then apply repository-specific
      // strictness/compatibility overrides below. This avoids hand-maintaining rule lists.
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.flat.recommended.rules,

      // ---- React best practices ----
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'error',
      'react/no-unescaped-entities': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-comment-textnodes': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/no-children-prop': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-deprecated': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/require-render-return': 'error',
      'react/self-closing-comp': 'error',
      'react/button-has-type': 'error',
      'react/no-array-index-key': 'error',
      // Vercel react-best-practices `rendering-conditional-render`: `cond && <Jsx/>` can
      // leak a rendered "0"/NaN when `cond` isn't already boolean. Autofixable to a
      // ternary. See docs/vercel-react-best-practices-classification.md.
      'react/jsx-no-leaked-render': 'error',

      // ---- Hooks ----
      // The maintained preset owns the rule set; dependency correctness is promoted
      // from its warning default to a blocking error for this boilerplate.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // ---- Accessibility (WCAG 2.1 AA gate) ----
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'warn',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-props': 'error',

      // ---- TypeScript strictness ----
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // Boilerplate must be a clean example of its own rules: no escape hatches.
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Default options allow `@ts-expect-error` with a description; AGENTS.md bans
      // it unconditionally (§ Never Do), so require every variant to be banned —
      // this makes ESLint a strict superset of guard-rails.mjs's old regex check,
      // which is why that check was removed (see guard-rails.mjs's own comment).
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false },
      ],
      // React Router's documented 404 pattern is `throw new Response(...)` from a
      // loader (isRouteErrorResponse checks for that exact shape, not `instanceof Error`).
      '@typescript-eslint/only-throw-error': [
        'error',
        { allow: [{ from: 'lib', name: 'Response' }] },
      ],
      // strictTypeChecked's default bans every non-string type in a template
      // expression, including numbers — but `${count}` always stringifies to a
      // sensible, unambiguous value (unlike objects/any/nullish, which stay banned).
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],

      // ---- Guard rails ----
      'no-console': 'error',
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      // Named function expressions (e.g. forwardRef(function Input(){})) are allowed
      // because they give components a stable displayName.
      'prefer-arrow-callback': ['warn', { allowNamedFunctions: true }],
      'no-unused-vars': 'off',

      // ---- Impeccable (styling) ----
      'impeccable/no-arbitrary-tailwind-values': 'error',
    },
  },

  // Role-folder privacy (AGENTS.md § Directory Map) — scoped to src/ only, since the
  // violation this guards against (importing a role's private component from outside
  // that role) can only ever originate from app source, never test/tooling files.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { roleBoundaries },
    rules: {
      'roleBoundaries/no-cross-role-component-import': 'error',
    },
  },

  // Fast-refresh correctness is only meaningful for component modules.
  {
    files: ['src/components/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },

  // Ambient declaration files legitimately declare empty augmentation interfaces.
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
    },
  },

  // Hardcoded user-facing text is enforced inside rendered components AND the page
  // wrappers that embed them — a literal typed directly into a `<Name>Page.tsx` route
  // wrapper is exactly as much a violation of AGENTS.md's "no hardcoded strings" rule
  // as one inside the feature component it renders.
  {
    files: ['src/components/**/*.tsx', 'src/pages/**/*.tsx'],
    rules: {
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: true,
          ignoreProps: true,
          // Typographic glyphs and punctuation, not copy — nothing here is
          // translatable. Each is either decorative (and aria-hidden at its
          // use site) or a separator between two already-translated strings.
          // Real sentences still have to come from i18n.
          allowedStrings: ['·', '—', '/', '|', '✓', '×', '“', '”', ':'],
          noAttributeStrings: false,
        },
      ],
    },
  },

  // MSW mocks: relax a couple of rules that fight fixture ergonomics.
  {
    files: ['src/mocks/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      'react/jsx-no-literals': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },

  // Test files: the hardcoded-text rule exists to keep *shipped* UI copy out of
  // i18n's reach, not to force test fixtures/assertions (button labels, typed
  // values, expected strings) through translation keys.
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'react/jsx-no-literals': 'off',
    },
  },

  // Playwright e2e specs/fixtures: not React code (no JSX, no hooks) — but
  // Playwright's own fixture API takes a callback parameter literally named
  // `use`, which react-hooks/rules-of-hooks pattern-matches as if it were
  // React's use() and flags as misplaced. False positive specific to this
  // naming collision, not a real violation.
  {
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  // Node-land config & scripts (not part of the app TS project → no type-checked rules).
  {
    files: ['**/*.{js,mjs,cjs}', 'scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },

  prettier
);
