#!/usr/bin/env sh
#
# One-command install of this repo's agent toolkit into the project you are
# standing in. Run it from the root of the target project:
#
#   gh api -H "Accept: application/vnd.github.raw" \
#     repos/Gok-boilerplates/nestjs-backend/contents/scripts/install-toolkit.sh | sh
#
# Pass options through with `| sh -s -- --dry-run`.
#
# The boilerplate is a private repo, so this goes through `gh` rather than curl
# or npx: every developer already authenticates it once with `gh auth login`,
# and nothing else has to know about tokens.
#
# Nothing here is destructive. The exporter refuses to run against a dirty git
# tree, skips files that already exist, and never copies the baselines — so the
# whole thing is undone by `git checkout . && git clean -fd`.

set -eu

REPO="${TOOLKIT_REPO:-Gok-boilerplates/nestjs-backend}"
REF="${TOOLKIT_REF:-main}"
TARGET="$(pwd)"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required (the boilerplate is private). Install: https://cli.github.com" >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi
if [ ! -f "$TARGET/package.json" ]; then
  echo "No package.json here. Run this from the root of the project you want the toolkit in." >&2
  exit 1
fi

WORK="$(mktemp -d)"
# Always clean up the download, including on failure or Ctrl-C.
trap 'rm -rf "$WORK"' EXIT INT TERM

printf '  Fetching %s@%s ...\n' "$REPO" "$REF"
gh api "repos/$REPO/tarball/$REF" > "$WORK/toolkit.tar.gz"
# GitHub tarballs nest everything under one commit-stamped directory.
tar -xzf "$WORK/toolkit.tar.gz" -C "$WORK"
SRC="$(find "$WORK" -maxdepth 1 -type d -name '*-*' | head -1)"

if [ -z "$SRC" ] || [ ! -f "$SRC/scripts/export-toolkit.mjs" ]; then
  echo "Downloaded archive does not look like the boilerplate." >&2
  exit 1
fi

exec node "$SRC/scripts/export-toolkit.mjs" "$TARGET" "$@"
