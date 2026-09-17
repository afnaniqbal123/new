# Common Vulnerability Classes (Cross-Cutting)

These apply to almost any codebase that processes external input or handles
credentials, regardless of stack. Start here, then layer on the
stack-specific checklist (`checklist-web-api.md`, `checklist-iac.md`, etc.)
for anything Stage 1 flagged as relevant.

For each category: what to look for, and where attacker-controlled data
typically enters.

## 1. Injection (CWE-89, CWE-78, CWE-943, CWE-90)

- **SQL/NoSQL injection**: string-concatenated or f-string-built queries
  using request data, form input, or config values that could be
  attacker-influenced. Look for query-builder calls that accept raw strings
  instead of parameterized/prepared statements.
- **Command injection**: `subprocess`, `os.system`, `exec`, backticks, or
  shell=True calls where any part of the command includes external input.
- **LDAP/XPath/template injection**: similar pattern — external input
  reaching a query/template language without escaping.
- Trace backwards from the injection point to confirm the input is actually
  externally reachable, not just theoretically attacker-shaped.

## 2. Authentication & Authorization Flaws (CWE-287, CWE-862, CWE-863)

- Missing auth checks on routes/handlers that mutate data or return
  sensitive data (compare against sibling routes that _do_ check).
- Authorization checks that verify authentication but not ownership
  ("is logged in" but not "is logged in AND owns this resource" — classic
  IDOR/BOLA).
- Client-side-only authorization (a check that can be bypassed by calling
  the API directly).
- Predictable or non-expiring session tokens, JWT `alg: none` acceptance,
  JWT signature not actually verified.
- Privilege escalation paths: can a low-privilege role reach an
  admin-only code path by manipulating a role parameter, a mass-assignment
  field, or a direct object reference?

## 3. Cryptographic Issues (CWE-327, CWE-330, CWE-326)

- Use of broken/weak algorithms (MD5, SHA1 for anything security-relevant,
  DES, ECB mode) for passwords, tokens, or signatures.
- Passwords hashed without a proper KDF (bcrypt/scrypt/argon2/PBKDF2) —
  plain SHA-256 of a password is not acceptable.
- Predictable "randomness" for security-relevant values (session IDs,
  password reset tokens, API keys) generated with a non-CSPRNG
  (`Math.random()`, `random.random()`, `rand()`).
- Hardcoded IVs, reused nonces, keys derived from predictable seeds.

## 4. Secrets in Code (CWE-798)

- API keys, DB credentials, private keys, signing secrets committed as
  string literals, in `.env` files checked into git, or in CI config.
- Distinguish real secrets from placeholders/examples (`sk_test_...` in a
  README vs. a live-looking key in application code) — don't flag obvious
  documentation examples as findings, but do check whether they follow a
  format that suggests a real key was pasted in by mistake.
- Secrets that end up in git history even if since removed from HEAD
  (worth a note in `exploitability`, since `git log` still exposes them).

## 5. Insecure Deserialization (CWE-502)

- `pickle.loads`, `yaml.load` (not `safe_load`), PHP `unserialize`, Java
  `ObjectInputStream.readObject`, `.NET BinaryFormatter` — on data that
  originates outside the trust boundary.
- Deserialization of JWTs/cookies without validating structure before
  trusting claims.

## 6. Path Traversal (CWE-22)

- File paths built by concatenating a base directory with user-supplied
  input without normalizing/validating against `../` or absolute-path
  overrides.
- Archive extraction ("zip slip") that writes files using paths from
  inside the archive without validation.

## 7. Server-Side Request Forgery (CWE-918)

- Any server-side HTTP/TCP call where the destination host or URL is
  wholly or partially attacker-controlled (webhooks, "fetch this image
  URL" features, PDF/screenshot generators, URL preview features).
- Check whether internal/metadata addresses (169.254.169.254, localhost,
  RFC1918 ranges) are blocked or reachable.

## 8. Misconfiguration (CWE-16, CWE-1188)

- Debug mode / verbose error pages enabled in what looks like a production
  config.
- Permissive CORS (`Access-Control-Allow-Origin: *` combined with
  credentialed requests).
- Default credentials left in place, admin panels reachable without extra
  protection.
- Directory listing enabled, `.git`/`.env` served by the web server.

## 9. Race Conditions (CWE-362)

- Check-then-act patterns on shared state (balance checks before
  decrementing, "check if exists" before creating) without locking or
  atomic operations, especially in payment/inventory/auth-token logic.

## 10. Insufficient Input Validation / Mass Assignment (CWE-20, CWE-915)

- Frameworks that auto-bind request bodies to models/structs — check
  whether privileged fields (`is_admin`, `role`, `balance`) can be set via
  the same bulk-assignment path as user-editable fields.

---

When you find something in one of these categories, don't just cite the
CWE number and move on — write the actual exploitability reasoning per
`references/finding-schema.md`. The CWE number tells the reader what class
of bug it is; your reasoning tells them whether it matters in _this_
codebase.
