/**
 * Rules enforcing the HTTP response envelope.
 * @see .claude/skills/best-practices/references/responses.md
 */
import {
  RAW_EXCEPTION_CLASSES,
  filePath,
  isTestFile,
} from '../lib/helpers.mjs';

const SERIALIZER_FUNCTIONS = new Set([
  'SerializeHttpResponse',
  'SerializeHttpError',
]);

/**
 * The serializer itself is the one place allowed to construct an HttpException —
 * that is its entire job.
 */
const SERIALIZER_IMPLEMENTATION = /\/src\/utils\/serializer\.ts$/;

/**
 * Environment validators run at ConfigModule load, before the app listens and
 * before any request exists. There is no response to put an envelope on — the
 * only correct outcome is a thrown error that stops the process, so the rule
 * does not apply here.
 */
const ENV_VALIDATION = /-env\.validation\.ts$/;

export const noRawHttpException = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Throw errors through SerializeHttpError so every error response keeps the { data, status, message } envelope.',
    },
    schema: [],
    messages: {
      rawThrow:
        'Do not throw `{{name}}` directly — the response will not match the { data, status, message } envelope. Use SerializeHttpError(null, HttpStatus.X, SOME_ERRORS.Y) instead.',
    },
  },
  create(context) {
    if (isTestFile(context)) return {};
    if (SERIALIZER_IMPLEMENTATION.test(filePath(context))) return {};
    if (ENV_VALIDATION.test(filePath(context))) return {};

    return {
      ThrowStatement(node) {
        const arg = node.argument;
        if (!arg || arg.type !== 'NewExpression') return;
        if (arg.callee.type !== 'Identifier') return;
        if (!RAW_EXCEPTION_CLASSES.has(arg.callee.name)) return;

        context.report({
          node: arg,
          messageId: 'rawThrow',
          data: { name: arg.callee.name },
        });
      },
    };
  },
};

export const noHardcodedMessage = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'The message passed to the serializer must come from an api-response enum, never an inline string.',
    },
    schema: [],
    messages: {
      inlineMessage:
        'User-facing message is hard-coded. Move it into an enum (e.g. AUTH_ERRORS / AUTH_SUCCESS) under a `constants/api-response/` folder and pass the enum member to {{fn}}().',
    },
  },
  create(context) {
    if (isTestFile(context)) return {};

    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        if (!SERIALIZER_FUNCTIONS.has(node.callee.name)) return;

        // Signature: (data, status, message)
        const message = node.arguments[2];
        if (!message) return;

        const isInlineString =
          (message.type === 'Literal' && typeof message.value === 'string') ||
          message.type === 'TemplateLiteral';

        if (!isInlineString) return;

        context.report({
          node: message,
          messageId: 'inlineMessage',
          data: { fn: node.callee.name },
        });
      },
    };
  },
};

export const returnSerializeHttpError = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A SerializeHttpError call must be returned, so the reader can see the branch terminates.',
    },
    schema: [],
    fixable: 'code',
    messages: {
      bareCall:
        "`return` this SerializeHttpError call. It throws, so control never reaches the next line — but a bare call reads like a branch that falls through, and the reader has to know the serializer's internals to tell the difference. `return SerializeHttpError(...)` makes the exit visible where it happens.",
    },
  },
  create(context) {
    if (isTestFile(context)) return {};
    if (SERIALIZER_IMPLEMENTATION.test(filePath(context))) return {};

    return {
      // Only a bare expression statement — `return`, `throw`, and uses as an
      // argument or in a ternary all already read as terminal.
      ExpressionStatement(node) {
        const call = node.expression;
        if (call?.type !== 'CallExpression') return;
        if (call.callee.type !== 'Identifier') return;
        if (call.callee.name !== 'SerializeHttpError') return;

        context.report({
          node: call,
          messageId: 'bareCall',
          fix: (fixer) => fixer.insertTextBefore(call, 'return '),
        });
      },
    };
  },
};
