#!/usr/bin/env python3
"""
Stage 2 helper: extract dependency name/version pairs from manifests, and
run whatever native vulnerability-audit tool is already available on PATH
for that ecosystem (npm audit, pip-audit, cargo audit, bundler-audit,
govulncheck) so Claude isn't reinventing a vulnerability database.

This is a *first pass* -- it catches known, already-catalogued CVEs for
exact versions. It does NOT replace the targeted web research Claude should
still do for anything the native tools miss (pre-disclosure advisories,
framework footguns not framed as a "vulnerability", GitHub Security
Advisories not yet in the local audit DB, etc).

Usage:
    python dep_audit.py /path/to/project

Output: JSON to stdout with:
  - "dependencies": flat list of {ecosystem, name, version}
  - "native_audit_results": raw output from any audit tool that ran
  - "tools_available" / "tools_missing": what was/wasn't found on PATH
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

TIMEOUT = 120


def run(cmd, cwd):
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=TIMEOUT)
        return {"cmd": " ".join(cmd), "returncode": p.returncode, "stdout": p.stdout[-20000:], "stderr": p.stderr[-4000:]}
    except FileNotFoundError:
        return None
    except subprocess.TimeoutExpired:
        return {"cmd": " ".join(cmd), "error": "timed out"}


def parse_package_json(path):
    deps = []
    try:
        with open(path) as f:
            data = json.load(f)
        for section in ("dependencies", "devDependencies"):
            for name, version in data.get(section, {}).items():
                deps.append({"ecosystem": "npm", "name": name, "version": version, "dev": section == "devDependencies"})
    except Exception:
        pass
    return deps


def parse_requirements_txt(path):
    deps = []
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("-"):
                    continue
                m = re.match(r"^([A-Za-z0-9_.\-]+)\s*(==|>=|<=|~=|!=)?\s*([A-Za-z0-9_.\-]*)", line)
                if m:
                    deps.append({"ecosystem": "pypi", "name": m.group(1), "version": m.group(3) or "unpinned"})
    except Exception:
        pass
    return deps


def parse_gemfile_lock(path):
    deps = []
    try:
        with open(path) as f:
            in_specs = False
            for line in f:
                if line.strip() == "specs:":
                    in_specs = True
                    continue
                if in_specs:
                    m = re.match(r"^\s{4}([A-Za-z0-9_.\-]+) \(([^)]+)\)", line)
                    if m:
                        deps.append({"ecosystem": "rubygems", "name": m.group(1), "version": m.group(2)})
                    elif line.strip() and not line.startswith("      "):
                        in_specs = False
    except Exception:
        pass
    return deps


def parse_go_sum(path):
    deps = []
    seen = set()
    try:
        with open(path) as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 2:
                    key = (parts[0], parts[1].split("/go.mod")[0])
                    if key not in seen:
                        seen.add(key)
                        deps.append({"ecosystem": "go", "name": key[0], "version": key[1]})
    except Exception:
        pass
    return deps


def parse_cargo_lock(path):
    deps = []
    try:
        with open(path) as f:
            content = f.read()
        for block in content.split("[[package]]"):
            name = re.search(r'name = "([^"]+)"', block)
            version = re.search(r'version = "([^"]+)"', block)
            if name and version:
                deps.append({"ecosystem": "crates.io", "name": name.group(1), "version": version.group(1)})
    except Exception:
        pass
    return deps


MANIFEST_PARSERS = {
    "package.json": parse_package_json,
    "requirements.txt": parse_requirements_txt,
    "Gemfile.lock": parse_gemfile_lock,
    "go.sum": parse_go_sum,
    "Cargo.lock": parse_cargo_lock,
}


def find_and_parse(root):
    deps = []
    manifest_files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".git", "vendor", "venv", ".venv", "target")]
        for fname in filenames:
            if fname in MANIFEST_PARSERS:
                full = os.path.join(dirpath, fname)
                manifest_files.append(full)
                deps.extend(MANIFEST_PARSERS[fname](full))
    return deps, manifest_files


def native_audits(root):
    results = {}
    available = []
    missing = []

    checks = [
        ("npm", ["npm", "audit", "--json"], os.path.exists(os.path.join(root, "package.json"))),
        ("pip-audit", ["pip-audit", "-f", "json"], os.path.exists(os.path.join(root, "requirements.txt")) or os.path.exists(os.path.join(root, "pyproject.toml"))),
        ("cargo-audit", ["cargo", "audit", "--json"], os.path.exists(os.path.join(root, "Cargo.lock"))),
        ("bundle-audit", ["bundle-audit", "check", "--update"], os.path.exists(os.path.join(root, "Gemfile.lock"))),
        ("govulncheck", ["govulncheck", "./..."], os.path.exists(os.path.join(root, "go.mod"))),
    ]

    for tool_name, cmd, relevant in checks:
        binary = cmd[0]
        if not relevant:
            continue
        if shutil.which(binary) is None:
            missing.append(tool_name)
            continue
        available.append(tool_name)
        results[tool_name] = run(cmd, root)

    return results, available, missing


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("project_dir")
    args = parser.parse_args()
    root = os.path.abspath(args.project_dir)

    deps, manifest_files = find_and_parse(root)
    native_results, available, missing = native_audits(root)

    print(json.dumps({
        "manifest_files_parsed": manifest_files,
        "dependency_count": len(deps),
        "dependencies": deps,
        "native_audit_tools_run": available,
        "native_audit_tools_missing": missing,
        "native_audit_results": native_results,
        "note": "native_audit_tools_missing means that tool wasn't on PATH -- install it for a "
                "quick pass, or fall back to targeted web research per references/research-guidance.md "
                "for the dependencies with the highest exposure (directly reachable from an entry point).",
    }, indent=2))


if __name__ == "__main__":
    main()


