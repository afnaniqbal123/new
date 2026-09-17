/**
 * Rules for Mongoose schema declarations.
 * @see .claude/skills/best-practices/references/dtos-schemas.md
 */
import { decoratorName, getProperty, isSchemaFile } from '../lib/helpers.mjs';

export const requireSchemaTimestamps = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Collections must record createdAt/updatedAt — pass { timestamps: true } to @Schema().',
    },
    schema: [],
    messages: {
      missing:
        '@Schema() is missing `{ timestamps: true }`, so this collection will have no createdAt/updatedAt and rows become impossible to order or audit.',
    },
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        const decorator = (node.decorators ?? []).find(
          (d) => decoratorName(d) === 'Schema',
        );
        if (!decorator) return;

        const expr = decorator.expression;
        const options =
          expr.type === 'CallExpression' ? expr.arguments[0] : undefined;

        // `@Schema({ _id: false })` declares an embedded subdocument, not a
        // collection. It has no documents of its own to order or audit, and
        // Mongoose does not maintain timestamps on one — so the rule's own
        // premise ("this collection") does not hold. See ADR 0006.
        const id = getProperty(options, '_id');
        if (
          id &&
          id.value.type === 'Literal' &&
          id.value.value === false
        ) {
          return;
        }

        const timestamps = getProperty(options, 'timestamps');

        if (
          timestamps &&
          timestamps.value.type === 'Literal' &&
          timestamps.value.value === true
        ) {
          return;
        }
        // An explicit `timestamps: false` is a deliberate opt-out, not an oversight.
        if (timestamps) return;

        context.report({ node: decorator, messageId: 'missing' });
      },
    };
  },
};

export const requireSchemaExports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A schema file must export the class, the compiled schema and the document type.',
    },
    schema: [],
    messages: {
      missing:
        'Schema file is missing {{missing}}. Every `*.schema.ts` exports three things: the class, `XxxSchema = SchemaFactory.createForClass(Xxx)`, and `export type XxxDocument = Xxx & Document`.',
    },
  },
  create(context) {
    if (!isSchemaFile(context)) return {};

    let hasSchemaConst = false;
    let hasDocumentType = false;
    let sawSchemaClass = false;
    let programNode = null;

    return {
      Program(node) {
        programNode = node;
      },
      ClassDeclaration(node) {
        if (
          (node.decorators ?? []).some((d) => decoratorName(d) === 'Schema')
        ) {
          sawSchemaClass = true;
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && /Schema$/.test(node.id.name)) {
          hasSchemaConst = true;
        }
      },
      TSTypeAliasDeclaration(node) {
        if (/Document$/.test(node.id.name)) hasDocumentType = true;
      },
      TSInterfaceDeclaration(node) {
        if (/Document$/.test(node.id.name)) hasDocumentType = true;
      },
      'Program:exit'() {
        if (!sawSchemaClass) return;

        const missing = [];
        if (!hasSchemaConst)
          missing.push('the compiled schema export (`XxxSchema`)');
        if (!hasDocumentType) missing.push('the document type (`XxxDocument`)');
        if (missing.length === 0) return;

        context.report({
          node: programNode,
          messageId: 'missing',
          data: { missing: missing.join(' and ') },
        });
      },
    };
  },
};
