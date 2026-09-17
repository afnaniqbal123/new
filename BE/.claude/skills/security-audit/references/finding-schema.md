# Finding Schema & Severity Rubric

Every finding produced in Stage 3 gets stored through `scripts/findings_store.py`
so `findings.json` and `findings.md` never drift apart. This file documents
the fields and how to set them well.

## Fields

| Field            | Required | Notes                                                                                                                                                                     |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | yes      | `F-001`, `F-002`, ... sequential, never reused even if a finding is later marked invalid.                                                                                 |
| `title`          | yes      | One line, specific enough to distinguish from other findings. "SQL injection in search endpoint" not "Injection issue".                                                   |
| `category`       | yes      | One of: `injection`, `authn_authz`, `crypto`, `secrets`, `deserialization`, `path_traversal`, `ssrf`, `misconfiguration`, `dependency`, `iac`, `smart_contract`, `other`. |
| `severity`       | yes      | `critical` / `high` / `medium` / `low` / `info` — see rubric below.                                                                                                       |
| `location`       | yes      | `{"file": "...", "line": N, "function": "..."}`. Use the most precise location you actually verified — don't guess a line number.                                         |
| `description`    | yes      | What's wrong, in plain language.                                                                                                                                          |
| `exploitability` | yes      | The attack path: how does an attacker actually reach this and what do they gain? This is the part that separates a real finding from a linter warning — see below.        |
| `evidence`       | no       | Short code excerpts (a few lines, not whole files) that support the finding.                                                                                              |
| `citations`      | no       | Source for the vulnerability class or CVE, from Stage 2's research files. Traceable, not "trust me".                                                                      |
| `status`         | yes      | `open` → `plan_pending` → `approved`/`rejected` → `fixed` → `test_added` → `verified` (or `deferred` / `accepted_risk` at any point after `open`).                        |
| `fix_summary`    | no       | Filled in during Stage 5.                                                                                                                                                 |
| `test_summary`   | no       | Filled in during Stage 6/7.                                                                                                                                               |

## Writing a good `exploitability` field

This is the field that most distinguishes a real security audit from a
pattern-matching linter. Don't just restate the category ("this is a SQL
injection vulnerability"). Explain the actual path:

- **Where does attacker-controlled input enter?** (a request parameter, an
  uploaded file, an env var an attacker can influence, a value from another
  service)
- **What trust boundary does it cross without being checked?**
- **What does the attacker get?** (data read, data written, code execution,
  privilege escalation, denial of service, lateral movement)
- **What has to be true for this to actually work?** (auth required or not,
  specific config, a race condition, a particular input encoding)

If you can't articulate a plausible path, downgrade the severity and say so
explicitly rather than asserting exploitability you haven't reasoned through.
A hardcoded low-privilege API key in a public repo is different from the
same key with admin scope — the exploitability text is where that
difference shows up, not just the severity label.

## Severity rubric

Loosely CVSS-shaped but qualitative — don't compute a CVSS score, just reason
about these dimensions:

- **Critical** — remote, unauthenticated, leads to full compromise (RCE,
  full data exfiltration, auth bypass on an admin path, private key /
  credential exposure with broad scope).
- **High** — requires some precondition (authenticated-but-any-user, a
  specific config, local access) but still leads to serious impact (data
  breach of other users' data, privilege escalation, significant fund loss
  in a contract).
- **Medium** — real security weakness with limited blast radius, or a
  serious weakness that requires an unlikely precondition (e.g. an admin
  making a specific mistake, a narrow race window).
- **Low** — defense-in-depth gap, information disclosure with minor
  impact (verbose error messages, version banners), weak-but-not-broken
  crypto in a low-value context.
- **Info** — best-practice deviation with no direct exploit path found
  (missing security headers with no demonstrated impact, outdated
  dependency with no known CVE affecting the used code path).

When uncertain between two levels, pick the lower one and say what
additional information would raise it — don't round up to sound more
impressive, and don't round down to make the report shorter.

## Category-to-checklist map

Use this to know which `references/checklist-*.md` file backs a given
category:

| Category                                                                                     | Primary checklist(s)                                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `injection`, `authn_authz`, `crypto`, `secrets`, `deserialization`, `path_traversal`, `ssrf` | `checklist-common-cwe.md`, plus `checklist-web-api.md` if it's a web/API project |
| `misconfiguration`                                                                           | whichever stack-specific checklist applies, plus `checklist-common-cwe.md`       |
| `dependency`                                                                                 | `references/research-guidance.md` + Stage 2's `dependency-findings.md`           |
| `iac`                                                                                        | `checklist-iac.md`                                                               |
| `smart_contract`                                                                             | `checklist-smart-contract.md`                                                    |
| mobile-specific issues                                                                       | `checklist-mobile.md`                                                            |
| CLI/library-specific issues                                                                  | `checklist-cli-general.md`                                                       |
