---
name: security-audit
description: Run a full, end-to-end security audit and penetration test against a project folder — fingerprints the stack, researches current vulnerability classes and CVEs for what it finds, performs a deep static/data-flow audit, proposes a remediation plan that requires explicit user approval before any code changes, implements approved fixes, writes red-team-style regression tests proving each fix works, and produces a final report. Use this whenever the user asks to "audit", "pen-test", "security review", "harden", "find vulnerabilities in", or "check for security issues" in a codebase, repo, or project — web app, API, mobile app, CLI tool, infra-as-code, or smart contracts. Also use it if the user asks something narrower that's really a piece of this (e.g. "check my dependencies for known CVEs", "review this for OWASP Top 10 issues", "write pen-test-style tests for this fix") — run the relevant stage(s) rather than skipping to conversational advice.
---

# Security Audit & Remediation

An eight-stage pipeline: discover the project, gather stack-specific
research, audit deeply, plan fixes, get explicit approval, implement, prove
the fixes work with adversarial tests, and report. Each stage writes a file
so the process is resumable and the user can inspect (or override) any
step — this is not meant to be a black box that just returns a verdict.

**This skill is defensive.** It audits and hardens the user's own project.
Never produce ready-to-use attack tooling aimed at third-party or live
systems — test code stays scoped to reproducing findings against the
project under audit, in its own test suite.

**Never modify code without explicit user approval of that specific
change.** Stage 4's approval gate is mandatory, not a formality — treat it
the same way you'd treat confirmation before a destructive file operation.

## Setup: the workspace

Before Stage 1, create `.security-audit/` inside the project directory (or
ask the user for an alternate location if the project is read-only or
they'd rather keep it out of the repo):

```
.security-audit/
  state.json              # current stage, per-finding approval state, retry counts
  01-discovery.md
  02-research/
    checklist-<stack>.md  # copied + trimmed from this skill's references/
    dependency-findings.md
    scope-notes.md
  findings.json            # source of truth, managed via scripts/findings_store.py
  03-findings.md           # rendered from findings.json
  04-plan.md
  05-changes.md
  06-tests.md
  07-test-runs/
    attempt-1.log
    attempt-2.log ...
  08-report.md
```

**Resuming:** if `.security-audit/` already exists, read `state.json` and
the most recent stage file before doing anything else — don't restart from
Stage 1 unless the user asks for a fresh audit or the codebase has changed
substantially since the last run.

## Stage 1 — Project Discovery

Run `scripts/discover.py <project_dir>` for cheap raw signal (languages,
manifests, entry-point candidates, auth/secret/CI config files, rough
size). Then **read the actual files it points at** — the script's job is
to tell you where to look, not to draw conclusions.

Write `01-discovery.md` covering:

- What kind of project this is (or, if genuinely mixed/ambiguous, say so —
  don't force a single label onto a monorepo with three different
  services).
- Languages, frameworks, package managers, build tools.
- Entry points: servers, CLI commands, API routes, cloud functions,
  contract addresses/deployment scripts — whatever applies.
- Dependency manifests/lockfiles present.
- Existing auth, secrets, networking, and CI/CD configuration you found.
- Rough size/complexity (file count, LOC estimate, monorepo vs. single
  service) — this informs the sampling strategy in Stage 3.
- **Which threat surfaces are plausibly relevant and which clearly aren't**
  (a static CLI tool doesn't need SSRF/CSRF checks; an internal tool with
  no auth system doesn't need an authn/authz deep-dive on login — though it
  may still need one on authorization between its own operations). This
  judgment call drives Stage 2's checklist selection, so be explicit about
  your reasoning, not just a yes/no list.

## Stage 2 — Dynamic Resource Gathering & Self-Update

Don't run a fixed generic checklist against every project. Based on
Stage 1:

1. **Select checklists.** Copy the relevant file(s) from this skill's
   `references/` into `.security-audit/02-research/checklist-<stack>.md` —
   `checklist-common-cwe.md` always applies; add `checklist-web-api.md`,
   `checklist-mobile.md`, `checklist-iac.md`, `checklist-smart-contract.md`,
   `checklist-cli-general.md` per what Stage 1 found. Trim sections that
   Stage 1 ruled out, and add a one-line note on _why_ if it's not obvious.

2. **Dependency CVE research.** Run `scripts/dep_audit.py <project_dir>`
   to extract dependency versions and run any native audit tool already
   installed (npm audit, pip-audit, cargo audit, etc.). Follow
   `references/research-guidance.md` for how to prioritize and cite the
   targeted web searches for anything the native tools missed. Write
   `.security-audit/02-research/dependency-findings.md`.

3. **Framework footguns.** For the main framework(s) at the detected
   version, search for known insecure defaults / security advisories (not
   necessarily CVE-numbered) per `references/research-guidance.md`. Fold
   findings into the same dependency-findings file or a short addendum.

4. **Record what you skipped.** Write
   `.security-audit/02-research/scope-notes.md` listing categories/
   checklists deliberately not applied and why — this feeds Stage 8's
   methodology section and keeps the audit's scope honest.

Do this stage even for small projects — the point isn't volume of
research, it's making sure Stage 3 works from current, project-specific
material instead of guessing from training data about what the "current"
CVE landscape looks like.

## Stage 3 — Deep Security Audit

Work from the trimmed checklists in `02-research/`, not the raw
`references/` files (those are generic; the trimmed copies are scoped to
this project).

**Sampling strategy for large codebases:** don't try to load the whole
repo into context. Prioritize in this order: (1) entry points identified in
Stage 1, (2) files touching auth/secrets/crypto/networking, (3) files
handling file I/O or external process calls, (4) everything else, sampled
by size/complexity if time-constrained. Say explicitly in `findings.md`'s
intro what was fully reviewed vs. sampled.

For each area, reason about **data flow and trust boundaries** — where
does external input enter, what checks does it pass through (or not)
before reaching a sensitive sink? Pattern-matching for risky function
calls is a starting point, not the finding itself; the finding is whether
that call is actually reachable with attacker-controlled data.

Record every finding via `scripts/findings_store.py add` using the schema
in `references/finding-schema.md` (fields, severity rubric, and — most
importantly — how to write a real `exploitability` argument instead of
restating the category). After adding findings, run
`scripts/findings_store.py render --out .security-audit/03-findings.md` to
keep the markdown view in sync.

If a finding's exploitability is genuinely ambiguous (can't confirm the
input is reachable, or reachability depends on a deployment detail you
can't verify from the code), say so in the finding and lower the severity
accordingly rather than asserting confidently either way.

## Stage 4 — Remediation Plan + Approval Gate

Write `.security-audit/04-plan.md`: for each open finding, what will
change, why (the specific risk it mitigates — tie back to the
exploitability reasoning), and exactly where (file/line/function). Group
related changes together, and flag anything high-risk, breaking, or
requiring a judgment call the user should weigh in on (e.g. "this requires
rotating a credential that other services may depend on" or "fixing this
changes the API response shape for existing clients").

**Then stop and ask the user for approval before changing anything.**
Present the plan in the conversation (not just the file) as a numbered
list keyed to finding IDs, and ask them to approve all, approve a subset
by ID, or reject/defer specific items. Record their response in
`state.json` and update each finding's `status` to `approved`, `rejected`,
or `deferred` accordingly via `scripts/findings_store.py update`.

Do not proceed to Stage 5 for any finding that isn't `approved`. If the
user approves nothing, stop here and skip to a lightweight version of
Stage 8 that just reports findings with no changes made.

## Stage 5 — Implementation

For each `approved` finding, make the minimal change that addresses it —
resist the urge to refactor beyond the fix's scope, since a larger diff is
harder for the user to review and more likely to introduce regressions.
Update the finding's `status` to `fixed` and its `fix_summary` field.
Append a one-line entry to `.security-audit/05-changes.md` per change made.

## Stage 6 — Pen-Test / Unit Tests on Fixed Areas

For every `fixed` finding, write a targeted test that would have caught
it: it should **fail against the pre-fix behavior and pass against the
fix**. Make the exploit attempt realistic for the finding's category
(injection payload, auth-bypass attempt, path traversal attempt, malformed/
boundary input) but keep it scoped to this project's own test suite —
these are regression tests proving a fix, not standalone attack scripts.

Add tests using whatever framework Stage 1 identified (pytest, jest,
rspec, go test, cargo test, forge/hardhat test, etc.) so they live
alongside the project's existing tests rather than in a separate,
easily-ignored location. Update the finding's `status` to `test_added` and
its `test_summary` field. Log what was added in
`.security-audit/06-tests.md`.

## Stage 7 — Test Execution Loop

Run the project's full test suite (existing + newly added) via
`scripts/test_runner.py --project-dir <dir> --attempt <N> --log-dir
.security-audit/07-test-runs` (pass `--command` if auto-detection picks
the wrong thing). If everything passes, mark those findings `verified`.

If something fails: read the log, refine the fix or the test (a failing
new test might mean the fix is incomplete; a failing _old_ test might mean
the fix caused a regression), and re-run as the next attempt. **Cap this
at 3 attempts per finding.** If still failing after 3, mark the finding
`deferred`, write a clear note in `07-test-runs/` explaining what was
tried and why it didn't resolve, and move on — don't loop indefinitely or
leave the user without a status update.

Don't proceed to Stage 8 until every `approved` finding is either
`verified` or `deferred`-with-explanation.

## Stage 8 — Final Report

Only after Stage 7 completes. Follow `references/report-template.md`
exactly — it defines the required sections (summary, methodology, full
findings list, diff-level change summary, new tests and results, residual
risk/recommendations). Generate the findings section from
`scripts/findings_store.py render` rather than retyping findings by hand.
Write to `.security-audit/08-report.md` and let the user know it's ready
plus give them the top-line numbers directly in the conversation (don't
make them open the file to learn there were 2 criticals).

## Cross-cutting principles (apply at every stage)

- **Audit trail over conversation.** If you find yourself explaining a
  decision only in the chat and not in a file, write it down too — the
  point of the staged files is that someone (including future-you, resuming
  later) can reconstruct the reasoning without replaying the conversation.
- **Uncertainty is a finding, not a gap to paper over.** If the project
  type, a dependency's exploitability, or a fix's completeness is
  ambiguous, say so explicitly rather than asserting confidence you don't
  have.
- **Traceable research.** Every claim backing a finding's severity or
  existence should cite its source (from Stage 2's research files) so the
  user can verify it independently.
- **Incremental on large codebases.** Never try to load an entire large
  repo into context at once — sample and prioritize by attack surface (see
  Stage 3), and say what was and wasn't reviewed.
- **Reference files reference table:**

| File                                     | When to read it                                           |
| ---------------------------------------- | --------------------------------------------------------- |
| `references/checklist-common-cwe.md`     | Always, in Stage 2                                        |
| `references/checklist-web-api.md`        | Stage 1 found a web app / API                             |
| `references/checklist-mobile.md`         | Stage 1 found Android/iOS/Flutter/RN                      |
| `references/checklist-iac.md`            | Stage 1 found Terraform/K8s/CloudFormation/Docker         |
| `references/checklist-smart-contract.md` | Stage 1 found Solidity/Vyper contracts                    |
| `references/checklist-cli-general.md`    | Stage 1 found a CLI tool / library with no network server |
| `references/finding-schema.md`           | Stage 3, before recording any finding                     |
| `references/research-guidance.md`        | Stage 2, for dependency/CVE/footgun research              |
| `references/report-template.md`          | Stage 8                                                   |

- **Scripts reference table:**

| Script                      | Stage | Purpose                                                   |
| --------------------------- | ----- | --------------------------------------------------------- |
| `scripts/discover.py`       | 1     | Fingerprint the project (raw signal only)                 |
| `scripts/dep_audit.py`      | 2     | Extract dependencies, run native audit tools              |
| `scripts/findings_store.py` | 3–8   | Add/update/list/render findings.json ↔ findings.md        |
| `scripts/test_runner.py`    | 7     | Detect and run the project's test suite, log each attempt |
