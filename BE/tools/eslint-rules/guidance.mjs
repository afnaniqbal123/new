/**
 * Rule → developer guidance.
 *
 * The lint message says what is wrong; this map says where to read more. The
 * pre-commit reporter joins the two so a blocked commit always points at the
 * document that explains the convention, instead of just a rule id.
 */
const SKILL = '.claude/skills/best-practices/references';

export const RULE_GUIDANCE = {
  'nestjs/no-raw-http-exception': `${SKILL}/responses.md`,
  'nestjs/no-hardcoded-message': `${SKILL}/enums-constants-config.md`,
  'nestjs/require-api-property': `${SKILL}/dtos-schemas.md`,
  'nestjs/require-dto-validation': `${SKILL}/dtos-schemas.md`,
  'nestjs/dto-class-suffix': `${SKILL}/naming.md`,
  'nestjs/require-api-tags': `${SKILL}/swagger.md`,
  'nestjs/require-api-bearer-auth': `${SKILL}/swagger.md`,
  'nestjs/no-db-in-controller': `${SKILL}/controllers-services.md`,
  'nestjs/no-raw-request-decorator': `${SKILL}/guards-auth.md`,
  'nestjs/require-schema-timestamps': `${SKILL}/dtos-schemas.md`,
  'nestjs/require-schema-exports': `${SKILL}/dtos-schemas.md`,
  'nestjs/no-process-env': `${SKILL}/enums-constants-config.md`,
  'nestjs/no-cross-module-relative-import': `${SKILL}/architecture.md`,
  'nestjs/no-barrel-file': `${SKILL}/architecture.md`,
  'nestjs/no-focused-tests': `${SKILL}/testing-tooling.md`,
};

/**
 * Plain-English explanations for the stock rules that fire most often, so the
 * pre-commit report never shows a bare rule id the developer has to look up.
 */
export const STOCK_RULE_HINTS = {
  'no-console':
    'Use the Nest `Logger` (`private readonly logger = new Logger(X.name)`) so output is structured and can be silenced per environment.',
  'no-debugger': 'Remove the `debugger` statement before committing.',
  '@typescript-eslint/no-floating-promises':
    'Add `await` (or `void` if you deliberately do not want to wait) — an unawaited promise swallows its errors.',
  '@typescript-eslint/no-misused-promises':
    'This async function is used where a sync one is expected; its rejection would go unhandled.',
  '@typescript-eslint/await-thenable':
    'You are awaiting something that is not a promise — usually a missing call or a wrong type.',
  '@typescript-eslint/no-unused-vars':
    'Delete the unused binding, or prefix it with `_` if it must stay for signature reasons.',
  '@typescript-eslint/no-unnecessary-type-assertion':
    'The `as` cast does nothing here — TypeScript already knows the type. Remove it.',
  '@typescript-eslint/unbound-method':
    'Pass `() => obj.method()` instead of `obj.method` so `this` stays bound.',
  'prettier/prettier':
    'Formatting only — this is fixed automatically, no action needed.',
  quotes: 'Use single quotes — fixed automatically, no action needed.',
  eqeqeq: 'Use `===` / `!==`; loose equality coerces types and hides bugs.',
  'prefer-const': 'This binding is never reassigned — declare it `const`.',
  'no-var': 'Use `const` or `let`; `var` is function-scoped and leaks.',
};
