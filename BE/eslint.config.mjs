import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import nestjs from './tools/eslint-rules/index.mjs';

export default tseslint.config(
  {
    // Tooling that runs on plain Node, outside the TypeScript program.
    ignores: [
      'eslint.config.mjs',
      'tools/**',
      'scripts/**',
      'dist/**',
      'coverage/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 5,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      nestjs,
    },
    linterOptions: {
      // A stale `eslint-disable` hides the fact that a rule now passes.
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Error rather than warn so existing occurrences can be captured in the
      // suppressions baseline; ESLint only suppresses errors, and a warning
      // that nothing can suppress would block commits on legacy files.
      '@typescript-eslint/no-unsafe-argument': 'error',
      'no-useless-catch': 'off',
      'no-case-declarations': 'off',
      // avoidEscape: without it, this rule and Prettier's quote-escaping
      // heuristic fight forever on any string containing an apostrophe
      // (e.g. "don't", "I'm") — one flips it to double quotes to avoid
      // escaping, the other flips it back to single.
      quotes: ['error', 'single', { avoidEscape: true }],

      // ---------------------------------------------------------------
      // Correctness — these catch real, shipped-to-production bugs.
      // ---------------------------------------------------------------
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      eqeqeq: ['error', 'smart'],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'error',

      // ---------------------------------------------------------------
      // Project conventions — see .claude/skills/best-practices/
      // ---------------------------------------------------------------
      'nestjs/no-raw-http-exception': 'error',
      'nestjs/no-hardcoded-message': 'error',
      'nestjs/return-serialize-http-error': 'error',
      'nestjs/require-api-property': 'error',
      'nestjs/require-dto-validation': 'error',
      'nestjs/dto-class-suffix': 'error',
      'nestjs/require-api-tags': 'error',
      'nestjs/require-api-bearer-auth': 'error',
      'nestjs/no-db-in-controller': 'error',
      'nestjs/no-raw-request-decorator': 'error',
      'nestjs/require-schema-timestamps': 'error',
      'nestjs/require-schema-exports': 'error',
      'nestjs/no-process-env': 'error',
      'nestjs/no-cross-module-relative-import': 'error',
      'nestjs/no-barrel-file': 'error',
      'nestjs/no-focused-tests': 'error',

      // ---------------------------------------------------------------
      // Auth architecture — see docs/architecture/security/authentication.md and
      // docs/adr/0001-authentication-boundaries.md. These exist because the
      // patterns they ban were all real code in this repo before M1.
      // ---------------------------------------------------------------
      'nestjs/no-direct-jwt-verify': 'error',
      'nestjs/no-direct-jwt-sign': 'error',
      'nestjs/no-db-in-access-auth': 'error',
      'nestjs/no-legacy-auth-guard': 'error',
      'nestjs/no-raw-organization-header': 'error',
      'nestjs/no-manual-bearer-parsing': 'error',
      'nestjs/no-parallel-authorization': 'error',
      'nestjs/one-access-strategy': 'error',
    },
  },
  {
    // Bootstrap and one-off scripts legitimately write to stdout.
    files: ['src/main.ts', 'src/scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Tests assert on internals and mock aggressively; the strictest typed
    // rules produce noise there without catching real defects.
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);
