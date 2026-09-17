/**
 * Guard rail checks against things that must never enter git history.
 *
 * These run first and on the *staged blob*, because unlike a lint error a
 * leaked credential cannot be undone by a follow-up commit — once it is in the
 * history it must be rotated.
 */
import { isTextFile, stagedContent, stagedSize } from '../lib/git.mjs';

/** Opt-out for the rare legitimate match, e.g. a documented example key. */
const ALLOW_MARKER = 'quality-gate:allow';

const MAX_FILE_BYTES = 1024 * 1024; // 1 MB

/**
 * High-confidence credential patterns only. A secret scanner that cries wolf
 * gets disabled, so anything that could plausibly match ordinary source code
 * is deliberately excluded.
 */
const SECRET_PATTERNS = [
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: 'private key block',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/,
  },
  { name: 'Stripe live secret key', re: /\b(?:sk|rk)_live_[0-9a-zA-Z]{16,}/ },
  { name: 'OpenAI API key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/ },
  {
    name: 'GitHub personal access token',
    re: /\bgh[pousr]_[0-9A-Za-z]{30,}\b/,
  },
  { name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    name: 'database URI with inline password',
    re: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s:'"/]+:[^\s@'"]{6,}@/,
  },
  {
    name: 'hard-coded JWT',
    re: /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/,
  },
];

const CONFLICT_MARKER = /^(<{7}|={7}|>{7})(?:\s|$)/;

const DOCS =
  '.claude/skills/best-practices/references/enums-constants-config.md';

/**
 * @param {{ staged: string[] }} input
 * @returns {{ findings: Array<object> }}
 */
export function run({ staged }) {
  const findings = [];

  for (const file of staged) {
    // --- Environment files -------------------------------------------------
    const base = file.split('/').pop();
    if (/^\.env/.test(base) && base !== '.env.example') {
      findings.push({
        file,
        message: `\`${file}\` contains real environment values and must never be committed.`,
        hint: `Run: git restore --staged ${file}   — then document the keys (without values) in .env.example`,
        docs: DOCS,
      });
      continue;
    }

    // --- Build output ------------------------------------------------------
    if (/^(dist|build|coverage|node_modules)\//.test(file)) {
      findings.push({
        file,
        message: `\`${file}\` is generated output and should not be tracked in git.`,
        hint: `Run: git restore --staged ${file.split('/')[0]}`,
      });
      continue;
    }

    // --- Oversized blobs ---------------------------------------------------
    const size = stagedSize(file);
    if (size > MAX_FILE_BYTES) {
      const mb = (size / (1024 * 1024)).toFixed(1);
      findings.push({
        file,
        message: `\`${file}\` is ${mb} MB. Large binaries bloat every future clone of this repository.`,
        hint: 'Upload it to S3 (the media module already does this) and reference the URL instead.',
      });
      continue;
    }

    if (!isTextFile(file)) continue;

    const content = stagedContent(file);
    if (!content) continue;

    const lines = content.split('\n');

    // --- Merge conflict markers -------------------------------------------
    for (let i = 0; i < lines.length; i += 1) {
      if (CONFLICT_MARKER.test(lines[i])) {
        findings.push({
          file,
          line: i + 1,
          message:
            'Unresolved merge conflict marker — this file will not compile.',
          hint: 'Finish resolving the conflict, then stage the file again.',
        });
        break;
      }
    }

    // --- Credentials -------------------------------------------------------
    if (base === '.env.example') continue;

    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i];
      if (text.includes(ALLOW_MARKER)) continue;

      for (const { name, re } of SECRET_PATTERNS) {
        if (!re.test(text)) continue;

        findings.push({
          file,
          line: i + 1,
          message: `Looks like a hard-coded ${name}. Committing it leaks the credential to everyone with repository access, permanently.`,
          hint: 'Move the value into your .env file, add the key to the CONFIG enum, and read it via ConfigService.get(). If this is genuinely not a secret, append the comment `quality-gate:allow` to the line.',
          docs: DOCS,
        });
        break;
      }
    }
  }

  return { findings };
}
