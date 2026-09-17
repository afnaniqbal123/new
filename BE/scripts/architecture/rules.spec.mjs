/**
 * The architecture checker's own tests.
 *
 * A gate nobody verifies is a gate that quietly stops catching things — which
 * is exactly what happened to an earlier version of the auth lint rules. These
 * run against synthetic graphs rather than the repo, so they assert the rule
 * logic itself and cannot be made to pass by changing application code.
 *
 * Run with: node --test scripts/architecture/rules.spec.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RULES } from './rules.mjs';

const rule = (name) => RULES.find((r) => r.name === name).run;

/** Minimal stand-ins for what buildGraph() produces. */
function graph({
  fileEdges = {},
  moduleEdges = {},
  files = [],
  imports = {},
  sources = {},
}) {
  return {
    fileEdges: new Map(
      Object.entries(fileEdges).map(([k, v]) => [k, new Set(v)]),
    ),
    moduleEdges: new Map(
      Object.entries(moduleEdges).map(([from, tos]) => [
        from,
        new Map(Object.entries(tos).map(([to, edges]) => [to, edges])),
      ]),
    ),
    files,
    readImports: (file) => imports[file] ?? [],
    readFile: (file) => sources[file] ?? '',
  };
}

describe('module-cycle', () => {
  const run = rule('module-cycle');

  it('reports a two-module cycle', () => {
    const found = run(
      graph({
        moduleEdges: {
          'modules/a': { 'modules/b': [{ file: 'a.ts', target: 'b.ts' }] },
          'modules/b': { 'modules/a': [{ file: 'b.ts', target: 'a.ts' }] },
        },
      }),
    );

    assert.equal(found.length, 1);
    assert.match(found[0].detail, /modules\/a -> modules\/b -> modules\/a/);
  });

  it('reports a longer cycle', () => {
    const found = run(
      graph({
        moduleEdges: {
          'modules/a': { 'modules/b': [{ file: 'a.ts', target: 'b.ts' }] },
          'modules/b': { 'modules/c': [{ file: 'b.ts', target: 'c.ts' }] },
          'modules/c': { 'modules/a': [{ file: 'c.ts', target: 'a.ts' }] },
        },
      }),
    );

    assert.equal(found.length, 1);
  });

  it('accepts a one-directional dependency', () => {
    const found = run(
      graph({
        moduleEdges: {
          'modules/a': { 'modules/b': [{ file: 'a.ts', target: 'b.ts' }] },
          'modules/b': {},
        },
      }),
    );

    assert.equal(found.length, 0);
  });

  it('names the import that forms each edge', () => {
    const found = run(
      graph({
        moduleEdges: {
          'modules/a': {
            'modules/b': [{ file: 'src/a/x.ts', target: 'src/b/y.ts' }],
          },
          'modules/b': {
            'modules/a': [{ file: 'src/b/y.ts', target: 'src/a/x.ts' }],
          },
        },
      }),
    );

    assert.match(found[0].path, /src\/a\/x\.ts/);
    assert.match(found[0].path, /src\/b\/y\.ts/);
  });
});

describe('foreign-schema-import', () => {
  const run = rule('foreign-schema-import');

  it('reports one module importing another’s schema', () => {
    const found = run(
      graph({
        files: ['src/modules/user/user.schema.ts'],
        fileEdges: {
          'src/modules/chat/chat.service.ts': [
            'src/modules/user/user.schema.ts',
          ],
        },
      }),
    );

    assert.equal(found.length, 1);
    assert.equal(found[0].rule, 'foreign-schema-import');
  });

  it('allows a module importing its own schema', () => {
    const found = run(
      graph({
        files: ['src/modules/chat/schemas/chat-room.schema.ts'],
        fileEdges: {
          'src/modules/chat/chat.service.ts': [
            'src/modules/chat/schemas/chat-room.schema.ts',
          ],
        },
      }),
    );

    assert.equal(found.length, 0);
  });

  /**
   * The property that makes the baseline a ratchet: two files breaking the
   * same rule are two entries, so baselining one cannot license the other.
   */
  it('keys each importing file separately', () => {
    const found = run(
      graph({
        files: ['src/modules/user/user.schema.ts'],
        fileEdges: {
          'src/modules/chat/a.ts': ['src/modules/user/user.schema.ts'],
          'src/modules/chat/b.ts': ['src/modules/user/user.schema.ts'],
        },
      }),
    );

    assert.equal(found.length, 2);
    assert.notEqual(found[0].key, found[1].key);
  });
});

describe('provider-sdk-leak', () => {
  const run = rule('provider-sdk-leak');

  it('reports an SDK used outside its owning module', () => {
    const found = run(
      graph({
        files: ['src/modules/user/user.service.ts'],
        imports: { 'src/modules/user/user.service.ts': ['stripe'] },
      }),
    );

    assert.equal(found.length, 1);
    assert.match(found[0].expected, /modules\/stripe/);
  });

  it('allows the owning module to use it', () => {
    const found = run(
      graph({
        files: ['src/modules/stripe/stripe.service.ts'],
        imports: { 'src/modules/stripe/stripe.service.ts': ['stripe'] },
      }),
    );

    assert.equal(found.length, 0);
  });

  it('ignores packages it does not police', () => {
    const found = run(
      graph({
        files: ['src/modules/user/user.service.ts'],
        imports: { 'src/modules/user/user.service.ts': ['lodash', 'rxjs'] },
      }),
    );

    assert.equal(found.length, 0);
  });
});

describe('app-module-composition-only', () => {
  const run = rule('app-module-composition-only');

  it('allows importing feature modules', () => {
    const found = run(
      graph({
        fileEdges: {
          'src/app.module.ts': [
            'src/modules/auth/auth.module.ts',
            'src/modules/chat/chat.module.ts',
          ],
        },
      }),
    );

    assert.equal(found.length, 0);
  });

  it('reports a business service wired straight into AppModule', () => {
    const found = run(
      graph({
        fileEdges: {
          'src/app.module.ts': [
            'src/modules/chat/services/chat-room.service.ts',
          ],
        },
      }),
    );

    assert.equal(found.length, 1);
    assert.equal(found[0].rule, 'app-module-composition-only');
  });
});

describe('foreign-schema-import — re-export laundering', () => {
  const run = rule('foreign-schema-import');

  /**
   * A one-line `export { User } from './user.schema'` used to walk the rule
   * straight past, because it matched target *filenames* rather than what a
   * file actually exposes.
   */
  it('follows a schema re-exported through another file', () => {
    const found = run(
      graph({
        files: [
          'src/modules/user/user.schema.ts',
          'src/modules/user/launder.ts',
        ],
        sources: {
          'src/modules/user/launder.ts':
            "export { User } from './user.schema';",
        },
        fileEdges: {
          'src/modules/chat/chat.service.ts': ['src/modules/user/launder.ts'],
        },
      }),
    );

    assert.equal(found.length, 1);
  });

  it('leaves an ordinary re-export alone', () => {
    const found = run(
      graph({
        files: ['src/modules/user/helpers.ts'],
        sources: {
          'src/modules/user/helpers.ts': "export { thing } from './thing';",
        },
        fileEdges: {
          'src/modules/chat/chat.service.ts': ['src/modules/user/helpers.ts'],
        },
      }),
    );

    assert.equal(found.length, 0);
  });
});

describe('shared-folder-purity', () => {
  const run = rule('shared-folder-purity');

  it('reports a shared folder reaching into a feature module', () => {
    const found = run(
      graph({
        fileEdges: {
          'src/utils/thing.ts': ['src/modules/auth/auth.service.ts'],
        },
      }),
    );

    assert.equal(found.length, 1);
  });

  // The first version hardcoded utils/types/constants and missed this one.
  it('covers src/guards too', () => {
    const found = run(
      graph({
        fileEdges: {
          'src/guards/validation.ts': ['src/modules/chat/chat.module.ts'],
        },
      }),
    );

    assert.equal(found.length, 1);
  });

  it('allows shared folders to import each other', () => {
    const found = run(
      graph({
        fileEdges: { 'src/utils/a.ts': ['src/constants/b.ts'] },
      }),
    );

    assert.equal(found.length, 0);
  });

  it('leaves feature modules alone', () => {
    const found = run(
      graph({
        fileEdges: {
          'src/modules/chat/chat.service.ts': [
            'src/modules/user/user.service.ts',
          ],
        },
      }),
    );

    assert.equal(found.length, 0);
  });
});

describe('controller-cross-module-service', () => {
  const run = rule('controller-cross-module-service');

  it('reports a controller importing another module’s service', () => {
    const found = run(
      graph({
        fileEdges: {
          'src/modules/media/media.controller.ts': [
            'src/modules/user/user.service.ts',
          ],
        },
      }),
    );

    assert.equal(found.length, 1);
  });

  // Services were the only target matched at first; a gateway is the same
  // kind of reach into another module's internals.
  it('reports a controller importing another module’s gateway', () => {
    const found = run(
      graph({
        fileEdges: {
          'src/modules/media/media.controller.ts': [
            'src/modules/chat/chat.gateway.ts',
          ],
        },
      }),
    );

    assert.equal(found.length, 1);
  });

  it('allows a controller to use its own module’s service', () => {
    const found = run(
      graph({
        fileEdges: {
          'src/modules/chat/chat.controller.ts': [
            'src/modules/chat/services/chat-room.service.ts',
          ],
        },
      }),
    );

    assert.equal(found.length, 0);
  });

  /** Guards and decorators are another module's contract, not its internals. */
  it('allows a controller to use another module’s guard', () => {
    const found = run(
      graph({
        fileEdges: {
          'src/modules/user/user.controller.ts': [
            'src/modules/auth/guards/roles.guard.ts',
          ],
        },
      }),
    );

    assert.equal(found.length, 0);
  });
});

describe('forward-ref', () => {
  const run = rule('forward-ref');

  it('reports forwardRef in a module', () => {
    const found = run(
      graph({
        files: ['src/modules/user/user.module.ts'],
        sources: {
          'src/modules/user/user.module.ts':
            'imports: [forwardRef(() => AuthModule)]',
        },
      }),
    );

    assert.equal(found.length, 1);
  });

  // Only `*.module.ts` was scanned at first, so the more common provider-level
  // escape hatch was invisible.
  it('reports forwardRef inside a service', () => {
    const found = run(
      graph({
        files: ['src/modules/media/media.service.ts'],
        sources: {
          'src/modules/media/media.service.ts':
            '@Inject(forwardRef(() => UserService)) private u: UserService',
        },
      }),
    );

    assert.equal(found.length, 1);
  });

  it('ignores forwardRef mentioned only in a comment', () => {
    const found = run(
      graph({
        files: ['src/modules/user/user.module.ts'],
        sources: {
          'src/modules/user/user.module.ts':
            '// Not a forwardRef(() => AuthModule): there is no cycle here.\nimports: [AuthModule]',
        },
      }),
    );

    assert.equal(found.length, 0);
  });
});

describe('findCycles bounds', () => {
  it('finds both cycles when two share a tail', async () => {
    const { findCycles } = await import('./graph.mjs');
    const edges = new Map([
      ['a', new Set(['b', 'c'])],
      ['b', new Set(['d'])],
      ['c', new Set(['d'])],
      ['d', new Set(['a'])],
    ]);

    const { cycles, truncated } = findCycles(edges);

    assert.equal(cycles.length, 2);
    assert.equal(truncated, false);
  });

  /**
   * Disjoint 2-cycles give an exact, predictable count, which is what pins
   * the boundary down. The first version reported truncation at exactly the
   * limit and could exceed it by one on the way out of a nested call.
   */
  const disjointPairs = (n) => {
    const edges = new Map();
    for (let i = 0; i < n; i++) {
      const a = `a${String(i).padStart(4, '0')}`;
      const b = `b${String(i).padStart(4, '0')}`;
      edges.set(a, new Set([b]));
      edges.set(b, new Set([a]));
    }
    return edges;
  };

  it('reports a complete result at exactly the limit', async () => {
    const { findCycles } = await import('./graph.mjs');

    const { cycles, truncated } = findCycles(disjointPairs(200));

    assert.equal(cycles.length, 200);
    assert.equal(truncated, false);
  });

  it('never exceeds the limit, and says so when it stops', async () => {
    const { findCycles } = await import('./graph.mjs');

    const { cycles, truncated } = findCycles(disjointPairs(201));

    assert.equal(cycles.length, 200);
    assert.equal(truncated, true);
  });

  it('gives up rather than exhausting the heap on a dense graph', async () => {
    const { findCycles } = await import('./graph.mjs');
    const nodes = Array.from({ length: 12 }, (_, i) => `n${i}`);
    const dense = new Map(
      nodes.map((n) => [n, new Set(nodes.filter((m) => m !== n))]),
    );

    const { cycles, truncated } = findCycles(dense);

    assert.equal(truncated, true);
    assert.ok(cycles.length <= 200);
  });
});

describe('foreign-schema-import — re-export forms', () => {
  const run = rule('foreign-schema-import');

  const laundered = (source) =>
    run(
      graph({
        files: [
          'src/modules/user/user.schema.ts',
          'src/modules/user/surface.ts',
        ],
        sources: { 'src/modules/user/surface.ts': source },
        fileEdges: {
          'src/modules/chat/chat.service.ts': ['src/modules/user/surface.ts'],
        },
      }),
    );

  it('follows `export type { X } from`', () => {
    assert.equal(
      laundered("export type { User } from './user.schema';").length,
      1,
    );
  });

  it('follows `export * from`', () => {
    assert.equal(laundered("export * from './user.schema';").length, 1);
  });

  it('follows `export * as N from`', () => {
    assert.equal(laundered("export * as S from './user.schema';").length, 1);
  });

  // The sibling rule stripped comments; this one did not.
  it('ignores a re-export that is commented out', () => {
    assert.equal(
      laundered("// export { User } from './user.schema';\nexport const x = 1;")
        .length,
      0,
    );
  });
});
