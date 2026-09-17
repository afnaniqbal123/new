/**
 * Blocking, measurable bundle-size budget — separate from Vite's own
 * `chunkSizeWarningLimit` (vite.config.ts), which stays advisory. This is the
 * enforced gate: `pnpm check:build-budget`, wired into `pnpm verify` right
 * after `check:build` (see AGENTS.md § Quality Gate and § Performance Budget).
 *
 * `@size-limit/file` reads the already-built files — no re-bundle — so it
 * works directly against Vite's real `dist/assets/` output. `gzip: true` on
 * every check: that is what actually crosses the wire, and it matches the
 * figure Vite's own build log reports.
 *
 * ## Why the total budget was raised, and the entry budget was not
 *
 * BusinessOS added a marketing landing page with a three.js hero
 * (CONTEXT.md D15) and a charting dashboard. Both are real, deliberate growth,
 * and both are **lazy route chunks** — so the number that actually governs
 * first paint for a signed-in user, the entry bundle, did not grow at all. It
 * is currently *below* the boilerplate's own baseline, because removing the
 * example feature took more out than the app shell put in.
 *
 * The landing chunk is pinned by its own check rather than being absorbed
 * into the total. That way "the marketing page got heavier" and "the app got
 * heavier" are two different failures with two different owners, instead of
 * one number that someone raises again without reading.
 *
 * Note on three.js: switching from `import * as THREE` to named imports made
 * no measurable difference (verified — 129.10 kB either way). Its core is a
 * single interconnected graph, so there is little for a bundler to drop. The
 * named imports are kept as the better default, not as a size win.
 */
export default [
  {
    name: 'Entry bundle (dist/assets/index-*.js)',
    path: 'dist/assets/index-*.js',
    gzip: true,
    // Every visitor downloads this on first load, lazy routes aside — the one
    // number with the most direct effect on real users. Measured at
    // 136.13 kB gzip; the limit is left at the boilerplate's original 195 kB
    // rather than being tightened to the new figure, so ordinary app growth
    // has room before anyone has to think about it.
    limit: '195 kB',
  },
  {
    name: 'Landing page chunk (three.js hero)',
    path: 'dist/assets/LandingPage-*.js',
    gzip: true,
    // Loaded only by signed-out visitors to "/" — never by the app itself.
    // Measured at 129.10 kB gzip, almost entirely three.js. 145 kB gives
    // headroom for copy and layout changes while still failing loudly if a
    // second 3D library or a texture pack appears.
    limit: '145 kB',
  },
  {
    name: 'Total JS (dist/assets/*.js)',
    path: 'dist/assets/*.js',
    gzip: true,
    // Entry + every lazy route and vendor chunk. Measured at 489.73 kB gzip,
    // of which ~129 kB is the landing page's three.js and ~104 kB is recharts
    // on the dashboard. 560 kB is that baseline plus ~15% — enough that a
    // dependency bump does not trip it, tight enough that a heavy library
    // imported eagerly still does.
    limit: '560 kB',
  },
];
