# Stage 2 Research Guidance

The bundled checklists (`checklist-*.md`) cover _classes_ of vulnerability
and don't go stale. Dependency versions and framework advisories do go
stale, so that's the one place Stage 2 should reach for a live web search
rather than relying only on what's bundled — see the note below on scope.

## What to do with `scripts/dep_audit.py` output

1. Run it first. It parses manifests into a flat dependency list and runs
   whatever native audit tool is already on PATH (`npm audit`, `pip-audit`,
   `cargo audit`, `bundle-audit`, `govulncheck`). Those catch anything
   already in a local vulnerability DB for free — no need to re-research
   those by hand, just carry the results into `dependency-findings.md`.
2. For dependencies the native tool _didn't_ run for (tool missing) or that
   look high-exposure (directly reachable from an entry point identified in
   Stage 1, e.g. the web framework itself, an auth library, a
   deserialization library) — do a targeted web search per dependency:
   `<package name> <version> CVE`, or `<package name> security advisory`.
3. Prioritize. Don't research all 200 transitive dependencies. Rank by:
   direct (not transitive) dependency, presence in an entry-point's request
   path (auth, parsing, templating, crypto libraries first), and whether
   the native audit tool already flagged something nearby.

## Sourcing

Prefer, in this order:

1. The official advisory database for the ecosystem (npm: GitHub Security
   Advisories / `npm audit`; Python: PyPA Advisory Database / `pip-audit`;
   Rust: RustSec; Go: Go Vulnerability Database).
2. NVD (nvd.nist.gov) for the canonical CVE record.
3. The project's own GitHub Security Advisories / release notes / CHANGELOG
   for "fixed a security issue" language, especially for versions between
   the one in use and latest.
4. Vendor blog posts or third-party writeups only as corroboration, not as
   the primary citation.

Record the source in `citations` for every dependency finding — a bare "CVE
exists" claim without a link/identifier isn't verifiable by the user later.
Use the CVE ID (`CVE-2023-XXXXX`) or GHSA ID (`GHSA-xxxx-xxxx-xxxx`) as the
citation text where available.

## Framework footguns (not always CVEs)

Some real risks are "insecure by default" design choices that never get a
CVE assigned because they're documented, intended behavior that's easy to
misuse — e.g. a framework's dev-mode debugger being importable in
production, an ORM's default query builder allowing raw SQL if you're not
careful, a serializer defaulting to permissive type resolution. These are
worth a quick search: `<framework> <version> security best practices` or
`<framework> insecure defaults`. Cite the official docs page where the
footgun is documented, since that's more durable than a blog post.

## Writing `dependency-findings.md`

One entry per dependency worth noting (skip entries with nothing found —
don't pad the file with "no known issues" for every package):

```markdown
## express 4.16.0

- **Native audit**: not flagged by `npm audit` (lockfile absent — audit did
  not run; flagging for manual research since it's the primary web
  framework).
- **Web research**: no CVE found directly against 4.16.0's core, but note
  that 4.16.0 predates several dependency updates addressing ReDoS issues
  in `qs` (a transitive dependency) — recommend upgrading to a current 4.x
  patch release rather than treating this as a single CVE-backed finding.
- **Citation**: GHSA-hrpp-h998-j3pp (qs ReDoS), express changelog for 4.x
- **Recommended action**: bump to latest 4.x, re-run `npm audit`.
```

Then, for anything severe enough to be a real finding (not just "bump the
version"), create a proper entry via `scripts/findings_store.py` in Stage 3
with `category: dependency`, citing this file.

## Skipping categories explicitly

Stage 2 should also produce a short "not researched / not applicable"
section in `02-research/scope-notes.md` explaining what was deliberately
skipped and why (e.g. "no mobile checklist pulled in — project has no
Android/iOS code", "smart contract checklist not applicable"). This keeps
the final report's methodology section honest about scope, per Stage 8.
