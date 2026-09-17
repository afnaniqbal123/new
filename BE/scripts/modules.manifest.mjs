/**
 * Declarative footprint of every optional module, used by `scripts/setup.mjs`
 * to remove what a new project did not ask for.
 *
 * What makes a module optional is not how big it is — it is whether anything
 * other than `app.module.ts` imports it. That was measured against the real
 * import graph (`scripts/architecture/graph.mjs`), not guessed:
 *
 *   auth           <- imported by 6 modules
 *   user           <- imported by 5
 *   media          <- imported by auth, email, user
 *   email          <- imported by auth, user
 *   authorization  <- imported by stripe, user
 *
 * Those five are listed in CORE_MODULES and cannot be deselected. Offering them
 * as checkboxes would be a lie: unticking `email` breaks the OTP flow inside
 * `auth`, and the generated project would not compile. If one of them ever does
 * need to be optional, the fix is to decouple it first and move it down here —
 * not to add a checkbox that produces a broken project.
 *
 * Removal works in three passes, all driven by this file:
 *   1. delete `folders` and `files`
 *   2. strip `// #region <region> ... // #endregion <region>` blocks
 *      (and the `# #region` variant in .env / YAML)
 *   3. prune `deps` from package.json
 *
 * Every dep listed below was checked to be used ONLY by its own module, so
 * pruning it cannot strand an import somewhere else.
 */

/**
 * Always present. Shown on the module screen but not selectable, so it is clear
 * what a generated project gets for free rather than looking like it ships with
 * only the boxes that were ticked.
 */
export const CORE_MODULES = [
  {
    key: 'auth',
    label: 'JWT access/refresh, OTP, password reset, Google sign-in',
  },
  { key: 'user', label: 'User accounts and profile management' },
  { key: 'authorization', label: 'CASL policies and permission guards' },
  { key: 'email', label: 'Transactional email (Brevo) + Handlebars templates' },
  { key: 'media', label: 'S3 upload/download and presigned URLs' },
];

/**
 * @typedef {object} ModuleEntry
 * @property {string}   key       Selection key, also the `--modules=` name.
 * @property {string}   label     One line shown in the wizard.
 * @property {boolean}  default   Ticked when the wizard opens.
 * @property {string[]} folders   Directories deleted when deselected.
 * @property {string[]} [files]   Individual files deleted when deselected.
 * @property {string}   region    Anchor tag paired with `// #region <tag>`.
 * @property {string[]} deps      package.json dependencies to prune.
 * @property {string[]} [dependsOn] Keys that must also be selected.
 * @property {string[]} [requiredBy] Keys that break without this one.
 */

/** @type {ModuleEntry[]} */
export const MODULES = [
  {
    key: 'stripe',
    label: 'Stripe — cards, invoices, payments, subscriptions, webhooks',
    default: true,
    folders: ['src/modules/stripe'],
    region: 'module:stripe',
    deps: ['stripe'],
  },
  {
    key: 'paypal',
    label: 'PayPal — invoices, payments, subscriptions, webhooks',
    default: false,
    folders: ['src/modules/paypal'],
    region: 'module:paypal',
    // Talks to PayPal over plain HTTP; there is no SDK to prune.
    deps: [],
  },
  {
    key: 'chat',
    label: 'Realtime chat (Socket.IO gateway, rooms, messages)',
    default: false,
    folders: ['src/modules/chat'],
    region: 'module:chat',
    deps: ['@nestjs/websockets', '@nestjs/platform-socket.io', 'socket.io'],
  },
  {
    key: 'notifications',
    label: 'In-app notifications (feed, read state, preferences)',
    default: true,
    folders: ['src/modules/notifications'],
    region: 'module:notifications',
    deps: [],
    requiredBy: ['onesignal'],
  },
  {
    key: 'onesignal',
    label: 'Push notifications via OneSignal',
    default: false,
    folders: ['src/modules/onesignal'],
    region: 'module:onesignal',
    deps: ['@onesignal/node-onesignal'],
    dependsOn: ['notifications'],
  },
  {
    key: 'platform-assistant',
    label: 'AI assistant (OpenAI, conversation store, context files)',
    default: false,
    folders: ['src/modules/platform-assistant'],
    region: 'module:platform-assistant',
    deps: ['openai'],
  },
];

/**
 * Transactional email providers. Exactly one survives generation.
 *
 * Unlike modules these are alternatives, not additions: `EMAIL_PROVIDER` picks
 * one at runtime, so shipping the other two only means carrying SDKs the
 * project never calls. `email` itself is core and always present — this chooses
 * how it sends, not whether it exists.
 */
export const EMAIL_PROVIDERS = [
  {
    key: 'brevo',
    label: 'Brevo — the default; one API key (EMAIL_API_KEY)',
    default: true,
    region: 'emailProvider:brevo',
    files: [
      'src/modules/email/providers/brevo-email.provider.ts',
      'src/modules/email/providers/brevo-email.provider.spec.ts',
    ],
    deps: ['@getbrevo/brevo'],
  },
  {
    key: 'ses',
    label: 'AWS SES — reuses your AWS_* credentials; sender must be verified',
    default: false,
    region: 'emailProvider:ses',
    files: [
      'src/modules/email/providers/ses-email.provider.ts',
      'src/modules/email/providers/ses-email.provider.spec.ts',
    ],
    deps: ['@aws-sdk/client-ses'],
  },
  {
    key: 'sendgrid',
    label: 'SendGrid — SENDGRID_API_KEY, with its own sender override',
    default: false,
    region: 'emailProvider:sendgrid',
    files: [
      'src/modules/email/providers/sendgrid-email.provider.ts',
      'src/modules/email/providers/sendgrid-email.provider.spec.ts',
    ],
    deps: ['@sendgrid/mail'],
  },
];

/** Files that carry `#region` anchors, checked by the wizard before it edits. */
export const ANCHORED_FILES = [
  'src/app.module.ts',
  'src/modules/email/enums/email-provider.enum.ts',
  'src/modules/email/constants/config.ts',
  'src/modules/email/providers/email-provider.factory.ts',
  'src/constants/config.constant.ts',
  'src/scripts/seed.ts',
  '.env.example',
];

/** Never copied into a generated project. */
export const COPY_EXCLUDE = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.env',
  '.setup-backup',
  // Marks the template itself; a generated project is not a template.
  '.boilerplate-template',
  // The remote entry point for fetching the template — meaningless once fetched.
  'create.sh',
  // Stale incremental-build cache; several MB describing a build of the
  // template's file list, which is not the generated project's file list.
  'tsconfig.build.tsbuildinfo',
]);

/**
 * The lockfile pins the template's dependency set. Prune a module's deps out of
 * package.json and the two disagree, which `pnpm install --frozen-lockfile` --
 * what the copied CI workflow runs -- rejects outright:
 *
 *   ERR_PNPM_OUTDATED_LOCKFILE  specifiers in the lockfile don't match ...
 *
 * Rewriting pnpm's lockfile by hand is not something to attempt, so when deps
 * were pruned the generated project ships without one and the first
 * `pnpm install` writes a correct one. When nothing was pruned the lockfile
 * still matches, and keeping it preserves the exact versions the template was
 * tested against.
 */
export const LOCKFILE = 'pnpm-lock.yaml';

/**
 * Debt ledgers that ARE copied, then pruned of entries for removed paths.
 *
 * Copying these looks wrong at first — they are this repo's debt. But a
 * generated project is this repo's code, so it inherits the debt with it: drop
 * the ledgers and 46 suppressed files plus a baselined auth<->user cycle come
 * back as errors, and a project nobody has touched yet fails its own quality
 * gate on the first commit. Pruning keeps them honest as modules are removed.
 */
export const BASELINES = [
  { file: 'eslint-suppressions.json', shape: 'keys' },
  { file: 'architecture-baseline.json', shape: 'accepted' },
];

/**
 * Files that only make sense while at least one of `needsAnyOf` survives.
 *
 * `seed.ts` is the case this exists for: its notifications and stripe halves are
 * both region-tagged, but strip both and the file is left importing `Model` and
 * `getModelToken` for nothing — which fails lint, in a generated project the
 * developer has not touched yet. Deleting the file is the honest outcome.
 */
export const ORPHANS = [
  {
    file: 'src/scripts/seed.ts',
    needsAnyOf: ['notifications', 'stripe'],
    // package.json script to drop alongside it.
    script: 'seed',
  },
];

/** Look up a module entry by key. */
export function moduleByKey(key) {
  return MODULES.find((m) => m.key === key);
}

/**
 * Expand a selection so it satisfies every `dependsOn`, and report what was
 * pulled in. Silently adding a dependency is worse than saying so — the user
 * ticked `onesignal` and would otherwise wonder why `notifications` survived.
 */
export function resolveSelection(keys) {
  const selected = new Set(keys);
  const added = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...selected]) {
      for (const need of moduleByKey(key)?.dependsOn ?? []) {
        if (!selected.has(need)) {
          selected.add(need);
          added.push({ need, because: key });
          changed = true;
        }
      }
    }
  }
  return { selected, added };
}
