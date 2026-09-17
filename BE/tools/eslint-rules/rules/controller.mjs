/**
 * Rules keeping controllers thin, documented and consistently authenticated.
 * @see .claude/skills/best-practices/references/controllers-services.md
 * @see .claude/skills/best-practices/references/swagger.md
 */
import {
  AUTH_GUARDS,
  decoratorName,
  decoratorNames,
  findDecorator,
  hasDecorator,
  isControllerFile,
} from '../lib/helpers.mjs';

function isController(node) {
  return hasDecorator(node, 'Controller');
}

/** Does this @UseGuards(...) decorator reference an authenticating guard? */
function guardsAuthentication(decorator) {
  const expr = decorator.expression;
  if (expr.type !== 'CallExpression') return false;
  return expr.arguments.some(
    (arg) => arg.type === 'Identifier' && AUTH_GUARDS.has(arg.name),
  );
}

export const requireApiTags = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every controller must be grouped under an @ApiTags() heading in Swagger.',
    },
    schema: [],
    messages: {
      missing:
        '`{{name}}` has no @ApiTags() — its endpoints land in Swagger’s ungrouped "default" section. Add @ApiTags(\'{{suggestion}}\') on the class.',
    },
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!isController(node)) return;
        if (hasDecorator(node, 'ApiTags')) return;

        const name = node.id?.name ?? 'This controller';
        context.report({
          node: node.id ?? node,
          messageId: 'missing',
          data: {
            name,
            suggestion: name.replace(/Controller$/, '') || 'Feature',
          },
        });
      },
    };
  },
};

export const requireApiBearerAuth = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Guarded endpoints must declare @ApiBearerAuth() so Swagger sends the token when testing them.',
    },
    schema: [],
    messages: {
      missing:
        '{{target}} is protected by a guard but has no @ApiBearerAuth(), so Swagger will call it without a token and always get 401. Add @ApiBearerAuth() above the HTTP method decorator.',
    },
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!isController(node)) return;

        const classHasBearer = hasDecorator(node, 'ApiBearerAuth');
        const classGuard = (node.decorators ?? []).find(
          (d) => decoratorName(d) === 'UseGuards' && guardsAuthentication(d),
        );

        if (classGuard && !classHasBearer) {
          context.report({
            node: classGuard,
            messageId: 'missing',
            data: { target: `\`${node.id?.name ?? 'This controller'}\`` },
          });
        }

        // Class-level @ApiBearerAuth() covers every method, so only inspect
        // methods when the class does not already declare it.
        if (classHasBearer) return;

        for (const member of node.body.body) {
          if (member.type !== 'MethodDefinition') continue;
          if (member.kind === 'constructor') continue;

          const methodGuard = (member.decorators ?? []).find(
            (d) => decoratorName(d) === 'UseGuards' && guardsAuthentication(d),
          );
          if (!methodGuard) continue;
          if (decoratorNames(member).includes('ApiBearerAuth')) continue;

          const name =
            member.key.type === 'Identifier'
              ? `\`${member.key.name}()\``
              : 'This endpoint';
          context.report({
            node: methodGuard,
            messageId: 'missing',
            data: { target: name },
          });
        }
      },
    };
  },
};

export const noDbInController = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Controllers must delegate to services; database models belong in the service layer.',
    },
    schema: [],
    messages: {
      injectedModel:
        'Controllers must stay thin — `{{param}}` injects a database model directly. Move the query into the matching service and call that instead.',
    },
  },
  create(context) {
    if (!isControllerFile(context)) return {};

    return {
      MethodDefinition(node) {
        if (node.kind !== 'constructor') return;

        for (const param of node.value.params) {
          const target =
            param.type === 'TSParameterProperty' ? param.parameter : param;
          const decorators = [
            ...(param.decorators ?? []),
            ...(target.decorators ?? []),
          ];
          const injectsModel = decorators.some(
            (d) => decoratorName(d) === 'InjectModel',
          );

          const typeName =
            target.typeAnnotation?.typeAnnotation?.typeName?.name ??
            target.typeAnnotation?.typeAnnotation?.typeName?.right?.name;
          const isModelType = typeName === 'Model';

          if (!injectsModel && !isModelType) continue;

          context.report({
            node: param,
            messageId: 'injectedModel',
            data: {
              param: target.name ?? target.key?.name ?? 'constructor parameter',
            },
          });
        }
      },
    };
  },
};

export const noRawRequestDecorator = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Use the typed param decorators (@GetUser, @GetOrganizationId) instead of reaching into the raw request.',
    },
    schema: [],
    messages: {
      rawRequest:
        "Do not use @{{name}}() in a controller — it leaks Express types into the API layer and skips typing. Use @GetUser(), @GetUser('id') or @GetOrganizationId() instead.",
    },
  },
  create(context) {
    if (!isControllerFile(context)) return {};

    return {
      MethodDefinition(node) {
        if (node.kind === 'constructor') return;

        for (const param of node.value.params) {
          const decorator =
            findDecorator(param, 'Req') ?? findDecorator(param, 'Request');
          if (!decorator) continue;

          context.report({
            node: decorator,
            messageId: 'rawRequest',
            data: { name: decoratorName(decorator) },
          });
        }
      },
    };
  },
};
