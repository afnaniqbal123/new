/**
 * Shared AST helpers for the local `nestjs` ESLint plugin.
 *
 * These rules encode the conventions documented in
 * `.claude/skills/best-practices/`. Keep them conservative: a rule that fires
 * on legitimate code trains developers to reach for `--no-verify`, which
 * defeats the entire gate.
 */

/** Decorator names that come from `@nestjs/swagger` and are not validation. */
export const SWAGGER_PROPERTY_DECORATORS = new Set([
  'ApiProperty',
  'ApiPropertyOptional',
  'ApiHideProperty',
]);

/**
 * class-validator decorators. Used to prove a DTO field is actually validated.
 * Not exhaustive by design — it covers everything this codebase uses plus the
 * common long tail. `Allow` is class-validator's explicit "no rules" escape
 * hatch and counts as validated.
 */
export const CLASS_VALIDATOR_DECORATORS = new Set([
  'Allow',
  'Equals',
  'NotEquals',
  'IsDefined',
  'IsOptional',
  'IsEmpty',
  'IsNotEmpty',
  'IsIn',
  'IsNotIn',
  'IsBoolean',
  'IsDate',
  'IsString',
  'IsNumber',
  'IsInt',
  'IsArray',
  'IsEnum',
  'IsObject',
  'IsNotEmptyObject',
  'IsDivisibleBy',
  'IsPositive',
  'IsNegative',
  'Min',
  'Max',
  'MinDate',
  'MaxDate',
  'IsBooleanString',
  'IsDateString',
  'IsNumberString',
  'Contains',
  'NotContains',
  'IsAlpha',
  'IsAlphanumeric',
  'IsDecimal',
  'IsAscii',
  'IsBase64',
  'IsByteLength',
  'IsCreditCard',
  'IsCurrency',
  'IsEmail',
  'IsFQDN',
  'IsFullWidth',
  'IsHalfWidth',
  'IsVariableWidth',
  'IsHexColor',
  'IsHexadecimal',
  'IsMacAddress',
  'IsIP',
  'IsPort',
  'IsISBN',
  'IsISIN',
  'IsISO8601',
  'IsJSON',
  'IsJWT',
  'IsLowercase',
  'IsMobilePhone',
  'IsPhoneNumber',
  'IsMongoId',
  'IsMultibyte',
  'IsSurrogatePair',
  'IsUrl',
  'IsUUID',
  'IsUppercase',
  'Length',
  'MinLength',
  'MaxLength',
  'Matches',
  'IsMilitaryTime',
  'IsHash',
  'IsISSN',
  'IsDateString',
  'IsBooleanString',
  'IsNumberString',
  'IsInstance',
  'ValidateNested',
  'ValidateIf',
  'ValidatePromise',
  'ArrayContains',
  'ArrayNotContains',
  'ArrayNotEmpty',
  'ArrayMinSize',
  'ArrayMaxSize',
  'ArrayUnique',
  'IsLatLong',
  'IsLatitude',
  'IsLongitude',
  'IsStrongPassword',
]);

/** Nest's built-in HTTP exception classes plus the raw JS error types. */
export const RAW_EXCEPTION_CLASSES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'HttpException',
  'BadRequestException',
  'UnauthorizedException',
  'NotFoundException',
  'ForbiddenException',
  'NotAcceptableException',
  'RequestTimeoutException',
  'ConflictException',
  'GoneException',
  'PayloadTooLargeException',
  'UnsupportedMediaTypeException',
  'UnprocessableEntityException',
  'InternalServerErrorException',
  'NotImplementedException',
  'BadGatewayException',
  'ServiceUnavailableException',
  'GatewayTimeoutException',
  'PreconditionFailedException',
]);

/** Guards that imply the endpoint is authenticated and needs a bearer token. */
export const AUTH_GUARDS = new Set([
  'JwtAuthGuard',
  'RolesGuard',
  'ConfiguredAuthGuard',
]);

/**
 * Resolve a decorator's name, handling both `@Foo` and `@Foo(...)` forms as
 * well as namespaced `@ns.Foo()`.
 * @returns {string|null}
 */
export function decoratorName(decorator) {
  const expr = decorator.expression;
  if (!expr) return null;
  const callee = expr.type === 'CallExpression' ? expr.callee : expr;
  if (callee.type === 'Identifier') return callee.name;
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return null;
}

/** All decorator names attached to a node, in source order. */
export function decoratorNames(node) {
  return (node.decorators ?? []).map(decoratorName).filter(Boolean);
}

/** Does `node` carry a decorator named `name` (string) or in `name` (Set)? */
export function hasDecorator(node, name) {
  const names = decoratorNames(node);
  return typeof name === 'string'
    ? names.includes(name)
    : names.some((n) => name.has(n));
}

/** Find the decorator node named `name`, or undefined. */
export function findDecorator(node, name) {
  return (node.decorators ?? []).find((d) => decoratorName(d) === name);
}

/** POSIX-style path of the file being linted, relative to the project root. */
export function filePath(context) {
  return context.filename.split('\\').join('/');
}

/** Basename of the file being linted. */
export function fileName(context) {
  return filePath(context).split('/').pop();
}

/** Is this a test file (unit or e2e)? Rules generally relax inside tests. */
export function isTestFile(context) {
  return /\.(spec|e2e-spec|test)\.ts$/.test(filePath(context));
}

/** Is this a standalone script rather than application code? */
export function isScriptFile(context) {
  return /\/src\/scripts\//.test(filePath(context));
}

/**
 * Bootstrap files run before the Nest DI container exists, so they are allowed
 * to read `process.env` directly.
 */
export function isBootstrapFile(context) {
  return /\/src\/(main|app\.module)\.ts$/.test(filePath(context));
}

/** Is this a Nest controller file? */
export function isControllerFile(context) {
  return /\.controller\.ts$/.test(filePath(context));
}

/** Is this a Mongoose schema file? */
export function isSchemaFile(context) {
  return /\.schema\.ts$/.test(filePath(context));
}

/** Does this file live in a `dto/` folder or end in `.dto.ts`? */
export function isDtoFile(context) {
  const p = filePath(context);
  return /\/dto\//.test(p) || /\.dto\.ts$/.test(p);
}

/** Read an object-literal property by key name. */
export function getProperty(objectExpression, key) {
  if (!objectExpression || objectExpression.type !== 'ObjectExpression')
    return undefined;
  return objectExpression.properties.find(
    (p) =>
      p.type === 'Property' &&
      ((p.key.type === 'Identifier' && p.key.name === key) ||
        (p.key.type === 'Literal' && p.key.value === key)),
  );
}

/** Walk up to the enclosing ClassDeclaration/ClassExpression, if any. */
export function enclosingClass(node) {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'ClassDeclaration' ||
      current.type === 'ClassExpression'
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}
