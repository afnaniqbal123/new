/**
 * Architectural rules checked against the import graph.
 *
 * Each rule encodes a decision from `docs/architecture/module-architecture.md`. They are
 * deliberately few and deliberately mechanical: a rule that fires on
 * legitimate code teaches people to route around the gate, which is worse
 * than having no gate. Nothing here measures class length, method count or
 * constructor arity — those push agents to satisfy a metric rather than write
 * simple code.
 */
import { findCycles, moduleOf } from './graph.mjs';

const DOCS = 'docs/architecture/module-architecture.md';

/**
 * Packages that belong to exactly one module. Anything wrapping a third party
 * is a boundary: if two modules import the same SDK, neither owns it.
 */
const PROVIDER_PACKAGES = {
  stripe: 'modules/stripe',
  '@paypal/paypal-server-sdk': 'modules/paypal',
  '@paypal/checkout-server-sdk': 'modules/paypal',
  '@aws-sdk/client-s3': 'modules/media',
  '@aws-sdk/lib-storage': 'modules/media',
  '@aws-sdk/s3-request-presigner': 'modules/media',
  '@getbrevo/brevo': 'modules/email',
  '@sendgrid/mail': 'modules/email',
  '@aws-sdk/client-ses': 'modules/email',
  handlebars: 'modules/email',
  '@onesignal/node-onesignal': 'modules/onesignal',
  openai: 'modules/platform-assistant',
  'socket.io': 'modules/chat',
  jsonwebtoken: 'modules/auth',
  'jwks-rsa': 'modules/auth',
  'passport-jwt': 'modules/auth',
  bcrypt: 'modules/auth',
  otplib: 'modules/auth',
};

/** A file that defines a Mongoose schema. */
const SCHEMA_FILE = /\.schema\.ts$/;

/**
 * Folders under `src/` that everything may import from, and which must
 * therefore import from no feature module.
 *
 * Listed explicitly rather than inferred: `src/scripts` also sits at this
 * level but is exempt, because seeding and maintenance scripts are
 * applications in their own right and may reach into modules. Add a new
 * shared folder here when you create one.
 */
const SHARED_ROOTS = ['utils', 'types', 'constants', 'guards'];

/** Source text with comments removed, so a rule cannot fire on prose. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * The package a specifier belongs to. `stripe/lib/stripe` and
 * `@aws-sdk/client-s3/dist-types/S3Client` are the same dependency as their
 * roots — matching the specifier verbatim let either walk straight past the
 * rule.
 */
function packageRoot(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('src/')) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * `key` identifies one *site*, not one kind of violation. Keying on the rule
 * and the offending file means an existing exception cannot be inherited by a
 * new file that happens to break the same rule — which is what makes the
 * baseline a ratchet rather than a blanket permission.
 */
/**
 * Files that expose a schema, including any that merely re-export one.
 *
 * Matching filenames alone let a one-line `export { User } from
 * './user.schema'` launder a foreign schema straight past the rule.
 */
function schemaSurfaces(files, readFile) {
  const surfaces = new Set(files.filter((f) => SCHEMA_FILE.test(f)));

  // Covers `export { X } from`, `export type { X } from`, `export * from` and
  // `export * as N from`. Comments are stripped first, so a commented-out
  // re-export is not mistaken for a live one.
  const REEXPORT =
    /export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s*from\s*['"][^'"]*\.schema['"]/;

  for (const file of files) {
    if (surfaces.has(file)) continue;
    if (REEXPORT.test(stripComments(readFile(file)))) {
      surfaces.add(file);
    }
  }

  return surfaces;
}

function violation(rule, detail, path, expected, site) {
  return {
    rule,
    key: `${rule}:${site ?? detail}`,
    detail,
    path,
    expected,
  };
}

/** New dependency cycles between modules. */
function moduleCycles({ moduleEdges }) {
  const { cycles, truncated } = findCycles(moduleEdges);

  if (truncated) {
    // Never silently truncate: an incomplete list that looks complete is how
    // a guardrail stops being one.
    console.error(
      `  Note: cycle search stopped at ${cycles.length} results — the module graph is too interconnected to enumerate fully. Fix these first, then re-run.`,
    );
  }

  return cycles.map((cycle) => {
    const loop = [...cycle, cycle[0]];
    const detail = loop.join(' -> ');
    const path = loop
      .map((mod, i) => {
        const next = loop[i + 1];
        if (!next) return null;
        const edge = moduleEdges.get(mod)?.get(next)?.[0];
        return edge ? `    ${edge.file}\n      imports ${edge.target}` : null;
      })
      .filter(Boolean)
      .join('\n');

    return violation(
      'module-cycle',
      detail,
      path,
      `Modules must not depend on each other. Break the cycle by moving the shared code to whichever module owns it, or record the exception in ${DOCS}. forwardRef() hides the cycle; it does not resolve it.`,
    );
  });
}

/** One module importing another's Mongoose schema. */
function foreignSchemaImports({ fileEdges, files, readFile }) {
  const found = [];
  const surfaces = schemaSurfaces(files, readFile);

  for (const [file, targets] of fileEdges) {
    const from = moduleOf(file);
    if (!from?.startsWith('modules/')) continue;

    for (const target of targets) {
      if (!surfaces.has(target)) continue;
      const to = moduleOf(target);
      if (!to || to === from || !to.startsWith('modules/')) continue;

      found.push(
        violation(
          'foreign-schema-import',
          `${from} -> ${to} (${target.split('/').pop()})`,
          `    ${file}\n      imports ${target}`,
          `A module should reach another module's data through its exported service, not its schema. If a direct read is genuinely right, document it in ${DOCS}.`,
          `${file} -> ${target}`,
        ),
      );
    }
  }

  return found;
}

/** A provider SDK imported outside the module that owns it. */
function providerSdkLeakage({ files, readImports }) {
  const found = [];

  for (const file of files) {
    const from = moduleOf(file);
    for (const specifier of readImports(file)) {
      const owner = PROVIDER_PACKAGES[packageRoot(specifier)];
      if (!owner || owner === from) continue;

      found.push(
        violation(
          'provider-sdk-leak',
          `${specifier} in ${from}`,
          `    ${file}\n      imports '${specifier}'`,
          `'${specifier}' belongs to ${owner}. Call that module's exported service instead of talking to the SDK directly.`,
          `${file} -> ${specifier}`,
        ),
      );
    }
  }

  return found;
}

/** `AppModule` composes modules; it does not hold business providers. */
function appModuleComposition({ fileEdges }) {
  const appModule = 'src/app.module.ts';
  const targets = fileEdges.get(appModule);
  if (!targets) return [];

  const found = [];
  for (const target of targets) {
    const isModule = target.endsWith('.module.ts');
    const isAppLocal = target.startsWith('src/app.');
    const isConstants = target.startsWith('src/constants/');
    // Startup env validators are wired through ConfigModule.forRoot({ validate })
    // and so can only be imported here. This was written as one filename when
    // `auth` was the only such gate; it names the category now that `email`
    // has one too. Same category `nestjs/no-raw-http-exception` already
    // recognises, by the same suffix.
    const isEnvValidation = /-env\.validation\.ts$/.test(target);
    if (isModule || isAppLocal || isConstants || isEnvValidation) continue;

    found.push(
      violation(
        'app-module-composition-only',
        target,
        `    ${appModule}\n      imports ${target}`,
        `AppModule composes feature modules. Move this into the module that owns it. See ${DOCS}.`,
      ),
    );
  }

  return found;
}

/**
 * Rule 7: the shared folders under `src/` are dependency-free.
 *
 * They are the one place everything may import from, so anything they import
 * becomes a dependency of the whole application. That is how a "shared
 * helpers" folder turns into a second, undeclared core.
 */
function sharedFolderPurity({ fileEdges }) {
  const found = [];

  for (const [file, targets] of fileEdges) {
    if (!SHARED_ROOTS.some((dir) => file.startsWith(`src/${dir}/`))) continue;

    for (const target of targets) {
      if (!target.startsWith('src/modules/')) continue;

      found.push(
        violation(
          'shared-folder-purity',
          `${file} -> ${moduleOf(target)}`,
          `    ${file}\n      imports ${target}`,
          `Shared folders must not depend on a feature module. Move this code into the module that owns it — that is why the request-context decorators live in modules/auth. See ${DOCS}.`,
          `${file} -> ${target}`,
        ),
      );
    }
  }

  return found;
}

/**
 * Rule 1: a controller calls services in its own module.
 *
 * Reaching straight into another module's service from a controller means the
 * boundary is in the wrong place — the behaviour belongs to whichever module
 * owns the outcome, and should be reached through its service from there.
 */
function controllerCrossModuleService({ fileEdges }) {
  const found = [];

  // A controller may borrow another module's *contract* — guards, decorators,
  // DTOs, constants, types. What it may not do is reach into how that module
  // works: its services, gateway, or internal helpers.
  const INTERNAL = /(\.service\.ts|\.gateway\.ts|\/utils\/|\/services\/)/;

  for (const [file, targets] of fileEdges) {
    if (!file.endsWith('.controller.ts')) continue;
    const from = moduleOf(file);
    if (!from?.startsWith('modules/')) continue;

    for (const target of targets) {
      if (!INTERNAL.test(target)) continue;
      const to = moduleOf(target);
      if (!to || to === from || !to.startsWith('modules/')) continue;

      found.push(
        violation(
          'controller-cross-module-service',
          `${from} controller -> ${to} service`,
          `    ${file}\n      imports ${target}`,
          `Controllers call services in their own module. Delegate to a service in ${from} that depends on ${to}, rather than orchestrating across modules in the transport layer. See ${DOCS}.`,
          `${file} -> ${target}`,
        ),
      );
    }
  }

  return found;
}

/**
 * Rule 6: `forwardRef()` is an escape hatch, not an architecture.
 *
 * Each use is a cycle someone decided to keep. Recording them makes that
 * decision visible and stops the count creeping upward unnoticed.
 */
function forwardRefUsage({ files, readFile }) {
  const found = [];

  // Every file, not just modules: `@Inject(forwardRef(() => XService))` inside
  // a provider is the more common escape hatch and was previously invisible.
  for (const file of files) {
    const text = stripComments(readFile(file));
    const matches = text.match(/forwardRef\(\s*\(\)\s*=>\s*(\w+)/g) ?? [];

    for (const match of matches) {
      const target = match.split('=>')[1].trim();
      found.push(
        violation(
          'forward-ref',
          `${file} -> ${target}`,
          `    ${file}\n      forwardRef(() => ${target})`,
          `forwardRef hides a circular module dependency rather than resolving it. Prefer removing the cycle; if it must stay, document it in ${DOCS}.`,
          `${file} -> ${target}`,
        ),
      );
    }
  }

  return found;
}

export const RULES = [
  { name: 'module-cycle', run: moduleCycles },
  { name: 'foreign-schema-import', run: foreignSchemaImports },
  { name: 'provider-sdk-leak', run: providerSdkLeakage },
  { name: 'app-module-composition-only', run: appModuleComposition },
  { name: 'shared-folder-purity', run: sharedFolderPurity },
  {
    name: 'controller-cross-module-service',
    run: controllerCrossModuleService,
  },
  { name: 'forward-ref', run: forwardRefUsage },
];
