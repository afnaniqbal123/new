#!/usr/bin/env node
/**
 * Static contract check over every `src/i18n/locales/<lng>/common.json` file that
 * exists — not just `en` — per `src/i18n/index.ts`'s own instructions for adding a
 * language ("copy `locales/en/common.json` ... keys must match exactly"). Two checks:
 *
 * 1. **Orphaned keys** — a key defined in a locale file but never referenced anywhere
 *    in `src/`. Flags dead weight left behind after a refactor or a rename that only
 *    updated the call site. This is deliberately the *opposite* direction from "does
 *    every `t('KEY')` call resolve to a real key" — that direction is already fully
 *    covered by `check:types`: i18next's own TypeScript integration (the
 *    `CustomTypeOptions`/`resources` module augmentation in `src/i18n/index.ts`) makes
 *    every literal `t()`/`i18n.t()` call a hard compile error against a nonexistent
 *    key (verified directly: a typo'd key in a real component fails `tsc -b`
 *    immediately). A check duplicating that would have no real job.
 *
 *    A key isn't only read via a literal `t('KEY')` call — `ProtectedRoutes.tsx`'s
 *    `nav: { labelKey: 'NAV_DASHBOARD' }` stores a `TranslationKey`-typed literal that
 *    `RoleLayout.tsx` reads dynamically later (`t(item.labelKey)`), never as a literal
 *    `t()` call at all. So this scans for the key's literal quoted string appearing
 *    anywhere in `src/` (comments stripped), not specifically inside a `t(...)` call —
 *    the standard approach unused-i18n-key tooling uses, and the only one that covers
 *    every real usage shape in this codebase.
 *
 * 2. **Cross-locale key parity** — every non-`en` locale's key *set* must exactly
 *    match `en`'s (`en` is the source of truth: `src/i18n/index.ts`'s own
 *    `fallbackLng: 'en'` and its "translate the values, keep every key identical"
 *    instruction for adding a language). A locale missing a key `en` has, or carrying
 *    an extra key `en` doesn't, is a real correctness bug — i18next would silently
 *    fall back to `en`'s string (masking a forgotten translation) or ship dead weight,
 *    neither of which check #1 alone would catch on its own locale (an extra key that
 *    happens to also appear elsewhere as a literal — e.g. a copy-paste of an `en` key
 *    left untranslated in another locale's JSON *value* — wouldn't necessarily be
 *    "unused" by check #1's definition, since the key name itself might still be
 *    referenced from `en`'s own call sites).
 *
 * Static/regex scan only, deliberately — no new dependency, matching this repo's
 * existing `check:*-contract` scripts (see hardening-contract.mjs's own reasoning).
 * Only `en` exists today, but this runs the full glob regardless — silently covering
 * zero locales if only one exists is exactly the bug this generalization fixes.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const LOCALES_DIR = 'src/i18n/locales';
const LOCALE_BASENAME = 'common.json';
const SOURCE_OF_TRUTH_LNG = 'en';
const SCAN_ROOT = 'src';
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);

function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function listSourceFiles(dir) {
  const entries = readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!SCAN_EXTENSIONS.has(extname(entry.name))) continue;
    // node:fs's recursive readdir reports `parentPath` relative to the dir passed in
    // (absolute here, since `dir` below is already joined with ROOT).
    const relativeParent = entry.parentPath.slice(join(ROOT, dir).length + 1);
    files.push(relativeParent ? join(dir, relativeParent, entry.name) : join(dir, entry.name));
  }
  return files;
}

function findLocales() {
  if (!existsSync(join(ROOT, LOCALES_DIR))) return [];
  const entries = readdirSync(join(ROOT, LOCALES_DIR), { withFileTypes: true });
  const locales = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = join(LOCALES_DIR, entry.name, LOCALE_BASENAME);
    if (existsSync(join(ROOT, file))) locales.push({ lng: entry.name, file });
  }
  return locales.sort((a, b) => a.lng.localeCompare(b.lng));
}

function readLocaleKeys(file) {
  const data = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  return Object.keys(data);
}

function findOrphanedKeys(keys, sourceContents) {
  const orphaned = [];
  for (const key of keys) {
    const pattern = new RegExp(`(['"])${key}\\1`);
    const isReferenced = sourceContents.some((content) => pattern.test(content));
    if (!isReferenced) orphaned.push(key);
  }
  return orphaned;
}

function main() {
  const locales = findLocales();
  if (locales.length === 0) {
    console.error(
      `✗ i18n-key-contract — no locale files found under ${LOCALES_DIR}/*/${LOCALE_BASENAME}`
    );
    process.exit(1);
  }

  const keysByLng = new Map();
  for (const { lng, file } of locales) {
    try {
      keysByLng.set(lng, new Set(readLocaleKeys(file)));
    } catch (error) {
      console.error(`✗ i18n-key-contract — ${file} is not valid JSON: ${String(error)}`);
      process.exit(1);
    }
  }

  const failures = [];

  // Check 1: orphaned keys, per locale.
  const sourceContents = listSourceFiles(SCAN_ROOT).map((file) =>
    stripComments(readFileSync(join(ROOT, file), 'utf8'))
  );
  for (const { lng, file } of locales) {
    const keys = keysByLng.get(lng);
    const orphaned = findOrphanedKeys(keys, sourceContents);
    for (const key of orphaned) {
      failures.push(
        `${file}: orphaned key "${key}" — defined but never referenced anywhere in src/`
      );
    }
  }

  // Check 2: cross-locale key parity against the source-of-truth language.
  const sourceKeys = keysByLng.get(SOURCE_OF_TRUTH_LNG);
  if (!sourceKeys) {
    failures.push(
      `${LOCALES_DIR}/${SOURCE_OF_TRUTH_LNG}/${LOCALE_BASENAME} is missing — every other locale is checked against it, see src/i18n/index.ts's own fallbackLng`
    );
  } else {
    for (const { lng, file } of locales) {
      if (lng === SOURCE_OF_TRUTH_LNG) continue;
      const keys = keysByLng.get(lng);
      const missing = [...sourceKeys].filter((key) => !keys.has(key));
      const extra = [...keys].filter((key) => !sourceKeys.has(key));
      for (const key of missing) {
        failures.push(
          `${file}: missing key "${key}" — present in ${SOURCE_OF_TRUTH_LNG}/${LOCALE_BASENAME}, not here`
        );
      }
      for (const key of extra) {
        failures.push(
          `${file}: extra key "${key}" — not present in ${SOURCE_OF_TRUTH_LNG}/${LOCALE_BASENAME} (keys must match exactly, see src/i18n/index.ts)`
        );
      }
    }
  }

  if (failures.length > 0) {
    console.error(
      `✗ i18n-key-contract — ${failures.length} problem(s) across ${locales.length} locale(s):`
    );
    for (const f of failures) console.error(`    - ${f}`);
    console.error(`\nSee AGENTS.md § Internationalization.\n`);
    process.exit(1);
  }

  console.log(
    `✓ i18n-key-contract — ${locales.length} locale(s) checked (${locales.map((l) => l.lng).join(', ')}): no orphaned keys, key sets match ${SOURCE_OF_TRUTH_LNG}.`
  );
}

main();
