import globals from 'globals';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * Accessibility-only ESLint config, used by the dedicated "Accessibility" stage of
 * the pre-commit gate. It runs the STRICT jsx-a11y ruleset independently so a11y is
 * enforced even if the main config were ever weakened. See AGENTS.md § Accessibility.
 */
export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'build', 'coverage', '**/*.stories.tsx'] },
  {
    files: ['src/**/*.{jsx,tsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    languageOptions: {
      parser: tseslint.parser,
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // The plugin's strict preset promotes every WCAG-relevant rule to an error.
    rules: jsxA11y.flatConfigs.strict.rules,
  }
);
