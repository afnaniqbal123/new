/**
 * Rules enforcing DTO validation and Swagger visibility.
 * @see .claude/skills/best-practices/references/dtos-schemas.md
 */
import {
  CLASS_VALIDATOR_DECORATORS,
  SWAGGER_PROPERTY_DECORATORS,
  decoratorNames,
  isDtoFile,
} from '../lib/helpers.mjs';

/** A class is a DTO if it is named `*Dto` or lives in a `dto/` file. */
function isDtoClass(node, context) {
  const name = node.id?.name ?? '';
  if (name.endsWith('Dto')) return true;
  return isDtoFile(context) && name.length > 0;
}

/**
 * Instance fields only. Static members, methods and constructor params are not
 * request-body fields and are out of scope.
 */
function isValidatableField(member) {
  return (
    member.type === 'PropertyDefinition' &&
    !member.static &&
    member.value?.type !== 'ArrowFunctionExpression' &&
    member.value?.type !== 'FunctionExpression'
  );
}

function fieldName(member) {
  if (member.key.type === 'Identifier') return member.key.name;
  if (member.key.type === 'Literal') return String(member.key.value);
  return 'field';
}

export const requireApiProperty = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every DTO field needs @ApiProperty() so it appears in the Swagger contract the frontend reads.',
    },
    schema: [],
    messages: {
      missing:
        '`{{field}}` is missing @ApiProperty() — it will be invisible in Swagger, so frontend devs cannot discover it. Add @ApiProperty() (or @ApiPropertyOptional() for optional fields).',
    },
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!isDtoClass(node, context)) return;

        for (const member of node.body.body) {
          if (!isValidatableField(member)) continue;
          const names = decoratorNames(member);
          if (names.some((n) => SWAGGER_PROPERTY_DECORATORS.has(n))) continue;

          context.report({
            node: member.key,
            messageId: 'missing',
            data: { field: fieldName(member) },
          });
        }
      },
    };
  },
};

export const requireDtoValidation = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every DTO field needs a class-validator decorator; unvalidated input reaches the service layer.',
    },
    schema: [],
    messages: {
      missing:
        '`{{field}}` has no class-validator decorator, so its value is never validated. Add the right check (@IsString(), @IsEmail(), @IsOptional() + type, ...).',
    },
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!isDtoClass(node, context)) return;

        for (const member of node.body.body) {
          if (!isValidatableField(member)) continue;
          const names = decoratorNames(member);
          if (names.some((n) => CLASS_VALIDATOR_DECORATORS.has(n))) continue;

          context.report({
            node: member.key,
            messageId: 'missing',
            data: { field: fieldName(member) },
          });
        }
      },
    };
  },
};

export const dtoClassSuffix = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Classes declared in a dto/ folder must be named with a Dto suffix.',
    },
    schema: [],
    messages: {
      suffix:
        'Class `{{name}}` lives in a dto/ folder but is not named `{{name}}Dto`. DTO class names always end in `Dto`.',
    },
  },
  create(context) {
    if (!isDtoFile(context)) return {};

    return {
      ClassDeclaration(node) {
        const name = node.id?.name;
        if (!name || name.endsWith('Dto')) return;

        context.report({
          node: node.id,
          messageId: 'suffix',
          data: { name },
        });
      },
    };
  },
};
