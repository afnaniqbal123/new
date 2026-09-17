/**
 * Rules that hold the authentication architecture in place.
 *
 * The auth rewrite (issues #3-#10) collapsed several competing code paths
 * into one. Documentation alone will not keep it that way: the failure mode
 * is not someone disagreeing with the design, it is someone adding a second
 * verification call in a hurry and nobody noticing in review. These rules
 * make the regressions that actually happened before fail the build.
 *
 * @see docs/architecture/security/authentication.md
 * @see docs/adr/0001-authentication-boundaries.md
 */
import { filePath, isTestFile } from '../lib/helpers.mjs';

/**
 * The e2e tree. Fixtures there forge tokens on purpose — minting an expired,
 * wrong-issuer or wrong-purpose token is how the rules' subject gets proven.
 * `isTestFile` only covers `*.spec.ts`, so shared harnesses need this too.
 */
const E2E_SUPPORT_FILE = /\/test\//;

/**
 * Test code: any `*.spec.ts`, plus non-spec harnesses in the repo-root `test`
 * tree. A `test` folder nested inside `src` is application code and must not
 * inherit the exemption, which is what the `/src/` guard below rules out.
 */
function isTestSupport(context) {
  const path = filePath(context);
  if (isTestFile(context)) return true;
  return !path.includes('/src/') && E2E_SUPPORT_FILE.test(path);
}

/** The one file allowed to mint access tokens. */
const TOKEN_SERVICE = /\/src\/modules\/auth\/services\/token\.service\.ts$/;

/**
 * The one strategy allowed to verify a bearer credential. Deliberately this
 * exact file rather than `strategies/*` — a second strategy dropped into the
 * folder would otherwise inherit the exemption and become the second
 * verification path these rules exist to prevent.
 */
const ACCESS_STRATEGY_FILE =
  /\/src\/modules\/auth\/strategies\/jwt\.strategy\.ts$/;

/**
 * Verifying a token from an *external* issuer is a different trust boundary
 * and a legitimate use of the raw `jsonwebtoken` library: Apple's ID tokens
 * are signed by Apple and checked against Apple's JWKS, not by our secret.
 * Scoped to the one file that does it.
 */
const EXTERNAL_IDP_FILE = /\/src\/modules\/auth\/social-auth\.service\.ts$/;

/**
 * The access-authentication path: proving who a caller is, and authorizing
 * the role claim that comes with it. Everything here must run on verified
 * claims alone.
 */
const ACCESS_AUTH_FILE =
  /\/src\/(modules\/auth\/(strategies\/[^/]+\.strategy\.ts|guards\/[^/]+\.guard\.ts)|guards\/[^/]+\.ts)$/;

/**
 * The documented exception: tenant membership is per-user mutable state that
 * a short-lived token cannot speak for, so this guard reads it. Listed by
 * name so adding another database-reading guard is a deliberate act.
 */
const TENANT_GUARD_FILE =
  /\/src\/modules\/auth\/guards\/organization-access\.guard\.ts$/;

/**
 * Files allowed to name the organization header: the constant that declares
 * it, and the one guard that reads it to establish trusted tenant context.
 */
/**
 * The deprecated role path itself. These two files exist to be deprecated —
 * flagging their own definitions would be circular.
 */
const LEGACY_ROLE_OWNERS =
  /\/src\/modules\/auth\/(guards\/roles\.guard\.ts|decorator\/roles\.decorator\.ts)$/;

const ORGANIZATION_HEADER_OWNERS =
  /\/src\/modules\/auth\/(guards\/organization-access\.guard\.ts|constants\/auth\.constant\.ts)$/;

/** Methods that verify a credential, whatever library they come from. */
const VERIFY_METHODS = new Set(['verify', 'verifyAsync', 'decode']);

/** Methods that mint one. */
const SIGN_METHODS = new Set(['sign', 'signAsync']);

/**
 * Tracks how the raw `jsonwebtoken` package entered a file.
 *
 * Every import form has to be recognised, because each is an equally easy way
 * to end up with a second verification path:
 *   import * as jwt from 'jsonwebtoken'      -> namespaces
 *   import jwt from 'jsonwebtoken'           -> namespaces
 *   import { verify } from 'jsonwebtoken'    -> bareCalls
 *   const { verify } = require('jsonwebtoken')
 */
function trackJsonWebTokenImports(namespaces, bareCalls) {
  const remember = (local, imported) => {
    if (imported) bareCalls.set(local, imported);
    else namespaces.add(local);
  };

  return {
    ImportDeclaration(node) {
      if (node.source.value !== 'jsonwebtoken') return;
      for (const spec of node.specifiers) {
        if (spec.local?.type !== 'Identifier') continue;
        remember(
          spec.local.name,
          spec.type === 'ImportSpecifier' ? spec.imported.name : null,
        );
      }
    },
    VariableDeclarator(node) {
      const init = node.init;
      const isRequire =
        init?.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        init.callee.name === 'require' &&
        init.arguments[0]?.value === 'jsonwebtoken';
      if (!isRequire) return;

      if (node.id.type === 'Identifier') {
        namespaces.add(node.id.name);
        return;
      }
      if (node.id.type === 'ObjectPattern') {
        for (const prop of node.id.properties) {
          if (prop.type === 'Property' && prop.value.type === 'Identifier') {
            remember(prop.value.name, prop.key.name);
          }
        }
      }
    },
  };
}

/**
 * Does this call invoke one of `methods` on something that mints or checks
 * JWTs — Nest's injected `JwtService`, or the raw `jsonwebtoken` package in
 * any of its import forms?
 *
 * Receivers are matched by name rather than by type on purpose: these rules
 * have to work in the editor, without a full type program behind them.
 */
function isTokenLibraryCall(node, methods, namespaces, bareCalls) {
  const callee = node.callee;

  // verify(...) — named import or destructured require
  if (callee.type === 'Identifier') {
    const imported = bareCalls.get(callee.name);
    return Boolean(imported && methods.has(imported));
  }

  if (callee.type !== 'MemberExpression') return false;
  const { object, property } = callee;
  if (property.type !== 'Identifier' || !methods.has(property.name)) {
    return false;
  }

  // this.jwtService.x(...)
  if (
    object.type === 'MemberExpression' &&
    object.property.type === 'Identifier'
  ) {
    return /^jwt(Service)?$/i.test(object.property.name);
  }

  // jwtService.x(...) or jwt.x(...)
  if (object.type === 'Identifier') {
    return /^jwtService$/i.test(object.name) || namespaces.has(object.name);
  }

  return false;
}

export const noDirectJwtVerify = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Access tokens are verified in exactly one place — the Passport JWT strategy.',
    },
    schema: [],
    messages: {
      directVerify:
        'Do not verify or decode a JWT here — with JwtService or the jsonwebtoken package. Access tokens are verified only by JwtStrategy, which pins algorithm, issuer, audience and token purpose. A second verification path is how one of them ends up more permissive than the other. See docs/architecture/security/authentication.md.',
    },
  },
  create(context) {
    if (isTestSupport(context)) return {};
    const path = filePath(context);
    if (ACCESS_STRATEGY_FILE.test(path)) return {};
    // Verification only: `no-direct-jwt-sign` still applies here, because
    // nothing in this file has any business minting our own tokens.
    if (EXTERNAL_IDP_FILE.test(path)) return {};

    const namespaces = new Set();
    const bareCalls = new Map();

    return {
      ...trackJsonWebTokenImports(namespaces, bareCalls),
      CallExpression(node) {
        if (isTokenLibraryCall(node, VERIFY_METHODS, namespaces, bareCalls)) {
          context.report({ node, messageId: 'directVerify' });
        }
      },
    };
  },
};

export const noDirectJwtSign = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Access tokens are minted in exactly one place — TokenService.',
    },
    schema: [],
    messages: {
      directSign:
        'Do not sign a JWT here — with JwtService or the jsonwebtoken package. TokenService is the only signer, so the claims a token carries and the options it is signed with cannot drift from what JwtStrategy verifies. Inject TokenService and call signAccessToken().',
    },
  },
  create(context) {
    if (isTestSupport(context)) return {};
    if (TOKEN_SERVICE.test(filePath(context))) return {};

    const namespaces = new Set();
    const bareCalls = new Map();

    return {
      ...trackJsonWebTokenImports(namespaces, bareCalls),
      CallExpression(node) {
        if (isTokenLibraryCall(node, SIGN_METHODS, namespaces, bareCalls)) {
          context.report({ node, messageId: 'directSign' });
        }
      },
    };
  },
};

export const noDbInAccessAuth = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Authentication and role authorization run on verified claims, never on a database read.',
    },
    schema: [],
    messages: {
      modelInAuth:
        'Do not inject a Mongoose model into the access-authentication path. Every protected request would inherit a database round trip, and a database outage would become an authentication outage for tokens that are otherwise perfectly valid. Put the claim in the access token instead, or do the lookup in a separate authorization guard. See docs/adr/0001-authentication-boundaries.md.',
    },
  },
  create(context) {
    if (isTestSupport(context)) return {};
    const path = filePath(context);
    if (!ACCESS_AUTH_FILE.test(path)) return {};
    if (TENANT_GUARD_FILE.test(path)) return {};

    const flag = (node) => context.report({ node, messageId: 'modelInAuth' });

    return {
      Decorator(node) {
        const expr = node.expression;
        if (expr.type !== 'CallExpression') return;
        if (expr.callee.type !== 'Identifier') return;

        // @InjectModel(User.name)
        if (expr.callee.name === 'InjectModel') return flag(node);

        // @Inject(getModelToken('User')) — the same thing spelled longhand
        if (
          expr.callee.name === 'Inject' &&
          expr.arguments.some(
            (arg) =>
              arg.type === 'CallExpression' &&
              arg.callee.type === 'Identifier' &&
              arg.callee.name === 'getModelToken',
          )
        ) {
          return flag(node);
        }
      },

      // A constructor parameter typed `Model<...>` reaches the collection
      // however the token was injected.
      TSTypeReference(node) {
        if (
          node.typeName.type === 'Identifier' &&
          node.typeName.name === 'Model'
        ) {
          flag(node);
        }
      },
    };
  },
};

export const noLegacyAuthGuard = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'The custom JwtAuthGuard was replaced by the global JwtAccessGuard.',
    },
    schema: [],
    messages: {
      legacyGuard:
        '`JwtAuthGuard` no longer exists — it verified tokens by hand and loaded the user on every request. Routes are authenticated by default via the global JwtAccessGuard; mark intentionally anonymous routes with @Public().',
    },
  },
  create(context) {
    if (isTestSupport(context)) return {};

    return {
      Identifier(node) {
        if (node.name === 'JwtAuthGuard') {
          context.report({ node, messageId: 'legacyGuard' });
        }
      },
    };
  },
};

export const noRawOrganizationHeader = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A caller-supplied organization id is input, not authorization.',
    },
    schema: [],
    messages: {
      rawHeader:
        'Do not read the organization header here. It is an assertion by the caller — on its own it proves no membership. Apply OrganizationAccessGuard and read the authorized value with @GetOrganizationId().',
    },
  },
  create(context) {
    if (isTestSupport(context)) return {};
    if (ORGANIZATION_HEADER_OWNERS.test(filePath(context))) return {};

    return {
      Literal(node) {
        if (
          typeof node.value === 'string' &&
          node.value.toLowerCase() === 'x-organization-id'
        ) {
          context.report({ node, messageId: 'rawHeader' });
        }
      },
    };
  },
};

export const noManualBearerParsing = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'The Authorization header is parsed by Passport, not by hand.',
    },
    schema: [],
    messages: {
      manualParse:
        'Do not read the Authorization header directly. Hand-rolled bearer parsing is what the old guard did, and it is where the token-purpose check went missing. Let JwtStrategy extract and verify the credential.',
    },
  },
  create(context) {
    if (isTestSupport(context)) return {};
    if (ACCESS_STRATEGY_FILE.test(filePath(context))) return {};

    const flag = (node) => context.report({ node, messageId: 'manualParse' });

    return {
      // request.headers.authorization
      MemberExpression(node) {
        if (
          node.property.type === 'Identifier' &&
          node.property.name === 'authorization' &&
          node.object.type === 'MemberExpression' &&
          node.object.property.type === 'Identifier' &&
          node.object.property.name === 'headers'
        ) {
          flag(node);
        }
      },
      // headers['authorization']
      Literal(node) {
        if (
          typeof node.value === 'string' &&
          node.value.toLowerCase() === 'authorization' &&
          node.parent?.type === 'MemberExpression' &&
          node.parent.computed
        ) {
          flag(node);
        }
      },
    };
  },
};

export const oneAccessStrategy = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'There is exactly one access-JWT strategy, and it lives in jwt.strategy.ts.',
    },
    schema: [],
    messages: {
      extraStrategy:
        'A second Passport JWT strategy makes two answers possible to "is this token valid?". Extend JwtStrategy, or if you genuinely need a separate credential type, write an ADR first — this is an architecture change, not a refactor. See docs/adr/0001-authentication-boundaries.md.',
    },
  },
  create(context) {
    if (isTestSupport(context)) return {};
    if (ACCESS_STRATEGY_FILE.test(filePath(context))) return {};

    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'PassportStrategy'
        ) {
          return;
        }

        // Only JWT-bearing strategies collide with the access path; an OAuth
        // or local strategy authenticates something else entirely.
        const source = context.sourceCode ?? context.getSourceCode();
        const usesJwtStrategy = source
          .getText()
          .includes("from 'passport-jwt'");

        if (usesJwtStrategy) {
          context.report({ node, messageId: 'extraStrategy' });
        }
      },
    };
  },
};

export const noParallelAuthorization = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Business authorization is expressed as permissions, not role checks scattered across routes.',
    },
    schema: [],
    messages: {
      legacyRoles:
        "`@Roles()` / `RolesGuard` are deprecated (ADR 0003). A role at the route cannot express a rule about the record, and copies the policy into every controller that repeats the list. Declare `@RequirePermissions({ action, subject })` and put the role logic in that module's policy — see docs/guides/permissions.md.",
      roleComparison:
        'Do not branch on a role inside a service. "Who may do this?" then has as many answers as there are call sites. Take an `AppAbility` and use `AuthorizationService.assertCan()` — see docs/architecture/security/authorization.md.',
    },
  },
  create(context) {
    if (isTestFile(context)) return {};
    const path = filePath(context);
    if (LEGACY_ROLE_OWNERS.test(path)) return {};
    // The test tree is not application code. Harnesses there build stand-in
    // policies and deliberately exercise the deprecated path to prove it
    // still behaves; `isTestFile` only covers *.spec.ts, not the fixtures
    // beside them.
    if (/\/test\//.test(path)) return {};

    // Policies are exactly where roles belong.
    const isPolicy = /\/policies\/[^/]+\.policy\.ts$/.test(path);

    return {
      Identifier(node) {
        if (node.name !== 'RolesGuard' && node.name !== 'Roles') return;
        // `Roles` is a common word; only flag the decorator application.
        if (node.name === 'Roles' && node.parent?.type !== 'CallExpression') {
          return;
        }
        context.report({ node, messageId: 'legacyRoles' });
      },

      // `user.role === USER_ROLES.X` outside a policy.
      BinaryExpression(node) {
        if (isPolicy) return;
        if (node.operator !== '===' && node.operator !== '!==') return;

        const mentionsRoleEnum = (side) =>
          side?.type === 'MemberExpression' &&
          side.object?.type === 'Identifier' &&
          /_ROLES$/.test(side.object.name);

        if (mentionsRoleEnum(node.right) || mentionsRoleEnum(node.left)) {
          context.report({ node, messageId: 'roleComparison' });
        }
      },
    };
  },
};
