#!/usr/bin/env python3
"""
Stage 7 helper: run the project's existing test command and capture
pass/fail output to a numbered attempt log, so the retry loop has a clean
record instead of scrollback that gets lost.

Detection order (first match wins) -- override with --command if the
project uses something nonstandard:
  package.json with "scripts.test"  -> npm test
  pytest.ini / pyproject.toml [tool.pytest] / any test_*.py -> pytest
  Gemfile with rspec                -> bundle exec rspec
  go.mod                            -> go test ./...
  Cargo.toml                        -> cargo test

Usage:
    python test_runner.py --project-dir . --attempt 1 --log-dir .security-audit/07-test-runs
    python test_runner.py --project-dir . --command "npm test -- --testPathPattern=auth" --attempt 2 --log-dir ...
"""
import argparse
import json
import os
import subprocess
import sys

TIMEOUT = 600


def detect_command(root):
    pkg = os.path.join(root, "package.json")
    if os.path.exists(pkg):
        try:
            with open(pkg) as f:
                data = json.load(f)
            if "test" in data.get("scripts", {}):
                return ["npm", "test"]
        except Exception:
            pass
    if os.path.exists(os.path.join(root, "pytest.ini")) or os.path.exists(os.path.join(root, "pyproject.toml")):
        return ["pytest", "-q"]
    if any(f.startswith("test_") and f.endswith(".py") for f in os.listdir(root)):
        return ["pytest", "-q"]
    if os.path.exists(os.path.join(root, "Gemfile")):
        return ["bundle", "exec", "rspec"]
    if os.path.exists(os.path.join(root, "go.mod")):
        return ["go", "test", "./..."]
    if os.path.exists(os.path.join(root, "Cargo.toml")):
        return ["cargo", "test"]
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-dir", default=".")
    parser.add_argument("--command", help="override the auto-detected test command, e.g. 'pytest tests/test_auth.py -q'")
    parser.add_argument("--attempt", type=int, required=True)
    parser.add_argument("--log-dir", required=True)
    args = parser.parse_args()

    root = os.path.abspath(args.project_dir)
    cmd = args.command.split() if args.command else detect_command(root)

    os.makedirs(args.log_dir, exist_ok=True)
    log_path = os.path.join(args.log_dir, f"attempt-{args.attempt}.log")

    if cmd is None:
        with open(log_path, "w") as f:
            f.write("Could not auto-detect a test command for this project.\n"
                    "Re-run with --command '<the right test invocation>'.\n")
        print(json.dumps({"status": "unknown", "log": log_path}))
        sys.exit(2)

    try:
        result = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=TIMEOUT)
        output = result.stdout + "\n" + result.stderr
        passed = result.returncode == 0
    except subprocess.TimeoutExpired:
        output = f"Test command timed out after {TIMEOUT}s: {' '.join(cmd)}"
        passed = False
    except FileNotFoundError:
        output = f"Command not found: {cmd[0]}. Is it installed and on PATH?"
        passed = False

    with open(log_path, "w") as f:
        f.write(f"$ {' '.join(cmd)}\n\n{output}")

    print(json.dumps({"status": "passed" if passed else "failed", "command": " ".join(cmd), "log": log_path}))
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
