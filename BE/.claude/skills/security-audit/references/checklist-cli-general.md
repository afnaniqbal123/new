# CLI Tools & General-Purpose Libraries Checklist

Use when Stage 1 finds a CLI tool, standalone script, or library with no
network-facing server component. Web-specific classes (XSS, CSRF, SSRF via
HTTP handlers) are usually irrelevant here — don't force them in. Focus
instead on local trust-boundary issues: what happens when this tool
processes a file, argument, or environment variable it doesn't control.

## A. Argument & Environment Injection

- Building a shell command from CLI arguments or config-file values with
  string concatenation instead of an argument array (see common-cwe #1) —
  especially risky in wrapper scripts that shell out to `git`, `curl`,
  `tar`, `ssh`, etc. with data from a config file or remote source.
- Environment variables trusted without validation for security-relevant
  decisions (e.g. a `DEBUG=true` env var that disables auth checks, honored
  even in what's meant to be a locked-down environment).

## B. File Handling

- Path traversal via filenames from user input, config files, or archive
  contents (see common-cwe #6) — for CLI tools, this often shows up as
  "the tool writes output next to the input file" without validating the
  input path stays within an expected directory.
- Symlink handling: does the tool follow symlinks when reading/writing in
  a way that could be abused (TOCTOU race, writing through a symlink an
  attacker planted to overwrite an unrelated file)?
- Insecure temp file creation: predictable temp file names in a
  world-writable directory (`/tmp/toolname-output`) instead of
  `mkstemp`/`tempfile.NamedTemporaryFile`-style unique, permission-scoped
  files.
- World-readable permissions on files containing secrets the tool writes
  (config files with API keys, cached credentials).

## C. Dependency & Supply Chain

- Same as any project — see `references/research-guidance.md` for the
  Stage 2 dependency CVE process. For CLI tools distributed via package
  managers (npm/PyPI), also check for typosquat-adjacent naming in
  dependencies if anything looks unfamiliar, though this is a lightweight
  sanity check, not a deep investigation.

## D. Unsafe Deserialization / Config Parsing

- Config file parsers that execute code as a side effect
  (`yaml.load` without `Loader=SafeLoader`, `eval()`/`exec()` on config
  values, pickle-based caching of parsed config).

## E. Privilege Handling

- Tools that `setuid`/run with elevated privileges (root, Administrator) —
  check whether they drop privileges after the privileged operation is
  done, and whether any user-controlled input is processed _before_
  dropping privileges.
- Tools that write to system-wide locations (`/etc/`, `/usr/local/`,
  `%ProgramFiles%`) — verify the write path itself isn't influenced by
  user input.

## F. Update / Plugin Mechanisms

- Auto-update or plugin-loading features that fetch code over HTTP
  (not HTTPS) or don't verify a signature/checksum before executing
  downloaded code.

---

If Stage 1 found no network-facing entry point at all, keep the audit
focused on this file plus `checklist-common-cwe.md` items 4, 5, 6, and 9 —
don't manufacture web-app findings for a tool that never accepts a network
request.
