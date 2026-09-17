import { isAbsolute, join, relative } from 'path';

import * as ts from 'typescript';

/**
 * `nest-cli.json` sets `deleteOutDir`, so every `nest start` wipes the output
 * directory. TypeScript's incremental build cache records what has already been
 * emitted — so a cache living outside that directory survives the wipe, tells
 * tsc there is nothing left to emit, and leaves the output empty. The build then
 * reports "Found 0 errors" and the app dies on `Cannot find module dist/main`,
 * which reads like a broken build rather than a stale cache.
 *
 * Keeping the cache inside the directory it describes makes the two impossible
 * to disagree. These tests pin that, because the failure it prevents is silent
 * and its error message points nowhere near the cause.
 *
 * The config is read through the TypeScript API rather than `JSON.parse`, which
 * matters for three reasons: `nest build` compiles with `tsconfig.build.json`,
 * not `tsconfig.json`, so checking the latter alone would miss an override in
 * the file that actually governs the build; the API follows the `extends` chain
 * for us; and it resolves both paths to absolute, so containment is a real path
 * comparison rather than string arithmetic that `dist/../elsewhere` walks
 * straight out of.
 */

const REPO_ROOT = join(__dirname, '..');

/** The config `nest build` and `nest start` actually compile with. */
const BUILD_CONFIG = 'tsconfig.build.json';

function effectiveCompilerOptions(configFile: string): ts.CompilerOptions {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    join(REPO_ROOT, configFile),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (d) => {
        throw new Error(ts.flattenDiagnosticMessageText(d.messageText, ' '));
      },
    },
  );
  if (!parsed) throw new Error(`Could not read ${configFile}`);
  return parsed.options;
}

/** True when `child` is the same path as `parent`, or sits underneath it. */
function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

describe('build configuration', () => {
  const options = effectiveCompilerOptions(BUILD_CONFIG);

  const nestCli = JSON.parse(
    ts.sys.readFile(join(REPO_ROOT, 'nest-cli.json')) ?? '{}',
  ) as { compilerOptions?: { deleteOutDir?: boolean } };

  it('wipes the output directory on every start', () => {
    // The premise of the test below. If this ever becomes false the cache is
    // free to live anywhere, and that test should be reconsidered rather than
    // quietly left passing.
    expect(nestCli.compilerOptions?.deleteOutDir).toBe(true);
  });

  it('builds incrementally', () => {
    // Asserted rather than skipped over: a test that returns early when the
    // option is absent would go green in exactly the configuration where the
    // next test stops meaning anything.
    expect(options.incremental).toBe(true);
  });

  it('keeps the incremental build cache inside the output directory', () => {
    expect(options.outDir).toBeDefined();
    expect(options.tsBuildInfoFile).toBeDefined();

    expect(
      isInside(options.outDir as string, options.tsBuildInfoFile as string),
    ).toBe(true);
  });
});
