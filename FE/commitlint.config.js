/** Conventional Commits — copied from FE_QUALITY_GATE_SETUP.md Phase 7. */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'refactor', // Code refactor
        'perf', // Performance improvement
        'test', // Add/update tests
        'docs', // Documentation
        'style', // Code style (formatting, semicolons)
        'build', // Build system
        'ci', // CI configuration
        'chore', // Dependencies, tooling
      ],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
  },
};
