# Final Report Template

Write `08-report.md` using this structure. Fill every section — if a
section is genuinely empty (e.g. no deferred items), say so explicitly
rather than omitting the heading.

```markdown
# Security Audit Report: <project name>

**Date:** <date>
**Scope:** <path audited>

## 1. Summary

2-4 sentences: what kind of project this is, headline numbers (N findings,
breakdown by severity, N fixed, N deferred), and the single most important
thing the user should know.

## 2. Methodology

- What was checked: which checklists applied (link to the ones used in
  `02-research/`) and why, based on Stage 1's discovery.
- What was explicitly out of scope and why (pull from
  `02-research/scope-notes.md`).
- How much of the codebase was reviewed (all of it / sampled — and if
  sampled, on what basis: entry points, largest files, highest-risk areas).
- Any tools that were unavailable and what that means for coverage (e.g.
  "cargo audit was not installed, so Rust dependency CVEs relied on manual
  web research only").

## 3. Findings

For each finding, in severity order (critical → info):

### <F-00X> - <title>

**Severity:** <severity> | **Category:** <category> | **Status:** <status>
**Location:** `<file:line>`

<description>

**Why it's exploitable:** <exploitability>

**Evidence:** <short excerpt if useful>

**Citations:** <sources>

**Resolution:** fixed in <commit/change reference> | deferred: <reason> |
accepted risk: <user's stated reason> | user declined: <if applicable>

(Generate this section from `findings.json` via
`scripts/findings_store.py render` rather than retyping by hand — copy the
rendered output in and add the Resolution line per finding.)

## 4. Changes Made

Diff-level summary, grouped by finding:

| Finding | File(s) changed | Summary of change                                      |
| ------- | --------------- | ------------------------------------------------------ |
| F-001   | `src/config.js` | Moved AWS key to env var, added `.env` to `.gitignore` |

## 5. New Tests Added

| Finding | Test file                      | What it verifies                                        | Result             |
| ------- | ------------------------------ | ------------------------------------------------------- | ------------------ |
| F-001   | `tests/test_config_secrets.py` | Fails if a hardcoded credential pattern is reintroduced | passed (attempt 1) |

## 6. Residual Risk & Recommendations

- Findings marked `deferred` or `accepted_risk`, with the reason.
- Anything flagged as needing manual review beyond this audit's automated
  scope (e.g. "business logic in the checkout flow should get a manual
  walkthrough — automated analysis can't fully verify pricing logic
  correctness").
- Anything the user explicitly declined to fix, and the resulting exposure
  stated plainly (not alarmist, not minimized).
- Suggested follow-up: re-run after the next dependency bump, consider a
  third-party audit before mainnet deploy (contracts) / before handling
  real user data (web apps), etc. — only if genuinely warranted, don't pad
  this with generic advice.
```

## Notes on tone

Report the good news too — if the codebase was already following a
practice well (parameterized queries throughout, secrets properly loaded
from env), it's fine to note that briefly in the summary. This isn't
required padding, but a report that reads as pure criticism when the
codebase was mostly solid misrepresents the actual risk posture.

Don't inflate finding counts by splitting one root cause into many
findings, and don't deflate them by merging genuinely distinct
vulnerabilities into one entry to make the number look smaller.
