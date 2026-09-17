#!/usr/bin/env python3
"""
Stage 1 helper: fingerprint a project directory.

Does NOT decide what the project "is" or which threat classes apply --
that reasoning belongs to Claude. This script only gathers raw, cheap,
deterministic facts so Claude doesn't have to grep the whole tree by hand.

Usage:
    python discover.py /path/to/project [--max-files 20000]

Output: JSON to stdout. Pipe to a file if you want to keep the raw data
around (e.g. `python discover.py . > .security-audit/01-discovery-raw.json`),
but the actual 01-discovery.md that later stages read should be a
Claude-written narrative, not this raw dump.
"""
import argparse
import json
import os
import subprocess
import sys
from collections import Counter

IGNORE_DIRS = {
    ".git", "node_modules", "vendor", "venv", ".venv", "env",
    "__pycache__", ".mypy_cache", ".pytest_cache", "dist", "build",
    "target", ".next", ".nuxt", ".terraform", "coverage", ".tox",
}

# manifest/lockfile -> (ecosystem, package manager)
MANIFEST_SIGNALS = {
    "package.json": ("javascript/typescript", "npm/yarn/pnpm"),
    "package-lock.json": ("javascript/typescript", "npm"),
    "yarn.lock": ("javascript/typescript", "yarn"),
    "pnpm-lock.yaml": ("javascript/typescript", "pnpm"),
    "requirements.txt": ("python", "pip"),
    "pyproject.toml": ("python", "poetry/pip/pdm"),
    "Pipfile": ("python", "pipenv"),
    "poetry.lock": ("python", "poetry"),
    "Gemfile": ("ruby", "bundler"),
    "Gemfile.lock": ("ruby", "bundler"),
    "go.mod": ("go", "go modules"),
    "go.sum": ("go", "go modules"),
    "Cargo.toml": ("rust", "cargo"),
    "Cargo.lock": ("rust", "cargo"),
    "pom.xml": ("java", "maven"),
    "build.gradle": ("java/kotlin", "gradle"),
    "build.gradle.kts": ("java/kotlin", "gradle"),
    "composer.json": ("php", "composer"),
    "mix.exs": ("elixir", "mix"),
    "*.csproj": ("c#/.net", "nuget"),
}

# filename or extension -> plausible project-type signal
TYPE_SIGNALS = {
    "Dockerfile": "containerized service",
    "docker-compose.yml": "multi-service / infra",
    "docker-compose.yaml": "multi-service / infra",
    "serverless.yml": "cloud functions (Serverless Framework)",
    "template.yaml": "AWS SAM / CloudFormation",
    "main.tf": "Terraform IaC",
    "manage.py": "Django web app",
    "wsgi.py": "Python WSGI web app",
    "asgi.py": "Python ASGI web app",
    "next.config.js": "Next.js web app",
    "nuxt.config.js": "Nuxt web app",
    "artisan": "Laravel (PHP) web app",
    "hardhat.config.js": "Ethereum smart contracts (Hardhat)",
    "foundry.toml": "Ethereum smart contracts (Foundry)",
    "truffle-config.js": "Ethereum smart contracts (Truffle)",
    "AndroidManifest.xml": "Android mobile app",
    "Info.plist": "iOS mobile app",
    "pubspec.yaml": "Flutter mobile app",
}

EXT_LANG = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescript", ".rb": "ruby",
    ".go": "go", ".rs": "rust", ".java": "java", ".kt": "kotlin",
    ".php": "php", ".cs": "c#", ".sol": "solidity", ".swift": "swift",
    ".c": "c", ".cpp": "c++", ".h": "c/c++ header", ".sh": "shell",
    ".tf": "terraform", ".yml": "yaml", ".yaml": "yaml",
}

AUTH_SECRET_SIGNALS = [
    ".env", ".env.local", ".env.production", "secrets.yml",
    "credentials.json", ".npmrc", ".pypirc", "id_rsa",
]

CI_SIGNALS = [
    ".github/workflows", ".gitlab-ci.yml", ".circleci/config.yml",
    "Jenkinsfile", ".travis.yml", "azure-pipelines.yml",
]

ENTRYPOINT_HINTS = [
    "main.py", "app.py", "server.py", "index.js", "server.js",
    "app.js", "main.go", "main.rs", "cmd", "Program.cs",
]


def walk(root, max_files):
    file_count = 0
    dir_listing = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d for d in dirnames
            if d not in IGNORE_DIRS and (d == ".github" or not d.startswith("."))
        ]
        rel_dir = os.path.relpath(dirpath, root)
        for fname in filenames:
            file_count += 1
            if file_count > max_files:
                return dir_listing, file_count, True
            dir_listing.append(os.path.join(rel_dir, fname) if rel_dir != "." else fname)
    return dir_listing, file_count, False


def loc_estimate(root):
    """Cheap line-count estimate using `wc -l`, skipping ignored dirs. Best-effort."""
    try:
        prune = []
        for d in IGNORE_DIRS:
            prune += ["-path", f"*/{d}/*", "-prune", "-o"]
        cmd = ["find", root] + prune + ["-type", "f", "-print"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        files = [f for f in result.stdout.splitlines() if f]
        if not files:
            return None
        wc = subprocess.run(["wc", "-l"] + files[:5000], capture_output=True, text=True, timeout=30)
        lines = wc.stdout.strip().splitlines()
        if lines and "total" in lines[-1]:
            return int(lines[-1].split()[0])
    except Exception:
        return None
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("project_dir")
    parser.add_argument("--max-files", type=int, default=20000)
    args = parser.parse_args()

    root = os.path.abspath(args.project_dir)
    if not os.path.isdir(root):
        print(json.dumps({"error": f"not a directory: {root}"}))
        sys.exit(1)

    files, file_count, truncated = walk(root, args.max_files)

    ext_counter = Counter()
    manifests_found = []
    type_signals_found = []
    auth_secret_files = []
    ci_files = []
    entrypoint_candidates = []

    basenames = {os.path.basename(f) for f in files}

    for f in files:
        base = os.path.basename(f)
        _, ext = os.path.splitext(base)
        if ext in EXT_LANG:
            ext_counter[EXT_LANG[ext]] += 1
        if base in MANIFEST_SIGNALS:
            manifests_found.append({"file": f, "ecosystem": MANIFEST_SIGNALS[base][0], "package_manager": MANIFEST_SIGNALS[base][1]})
        if base in TYPE_SIGNALS:
            type_signals_found.append({"file": f, "signal": TYPE_SIGNALS[base]})
        if base in AUTH_SECRET_SIGNALS:
            auth_secret_files.append(f)
        if base in ENTRYPOINT_HINTS:
            entrypoint_candidates.append(f)

    for sig in CI_SIGNALS:
        if sig in basenames or any(f.startswith(sig) for f in files) or os.path.isdir(os.path.join(root, sig)):
            ci_files.append(sig)

    result = {
        "project_dir": root,
        "file_count": file_count,
        "truncated": truncated,
        "loc_estimate": loc_estimate(root),
        "language_file_counts": dict(ext_counter.most_common()),
        "manifests_found": manifests_found,
        "project_type_signals": type_signals_found,
        "possible_entrypoints": entrypoint_candidates,
        "auth_or_secret_config_files": auth_secret_files,
        "ci_cd_signals": ci_files,
        "note": "This is raw signal only. Claude should read the actual manifest/entrypoint "
                "files listed here before concluding what the project is and which threat "
                "classes apply -- do not treat this JSON as the final answer.",
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
