#!/usr/bin/env python3
"""
Keeps findings.json as the single source of truth and renders findings.md
from it, so Stage 3-8 never have to hand-sync a JSON file and a markdown
table (they will drift if you try).

Schema for one finding (see references/finding-schema.md for full field docs):
{
  "id": "F-001",
  "title": "...",
  "category": "injection | authn_authz | crypto | secrets | deserialization |
               path_traversal | ssrf | misconfiguration | dependency |
               iac | smart_contract | other",
  "severity": "critical | high | medium | low | info",
  "location": {"file": "path", "line": 42, "function": "handle_login"},
  "description": "what's wrong",
  "exploitability": "the attack path -- how an attacker actually reaches and abuses this",
  "evidence": ["quoted-ish code snippet or short excerpt, kept minimal"],
  "citations": ["source name/URL from Stage 2 research backing the claim"],
  "status": "open | plan_pending | approved | rejected | fixed | test_added |
             verified | deferred | accepted_risk",
  "fix_summary": null,
  "test_summary": null
}

Usage:
    python findings_store.py add --file findings.json --json '{...}'
    python findings_store.py update --file findings.json --id F-001 --set status=fixed
    python findings_store.py render --file findings.json --out findings.md
    python findings_store.py list --file findings.json [--status open]
"""
import argparse
import json
import os
from collections import OrderedDict

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
REQUIRED_FIELDS = ["id", "title", "category", "severity", "location", "description", "exploitability", "status"]


def load(path):
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)


def save(path, findings):
    with open(path, "w") as f:
        json.dump(findings, f, indent=2)


def cmd_add(args):
    findings = load(args.file)
    new = json.loads(args.json)
    missing = [f for f in REQUIRED_FIELDS if f not in new]
    if missing:
        raise SystemExit(f"finding is missing required fields: {missing}")
    if new["severity"] not in SEVERITY_ORDER:
        raise SystemExit(f"severity must be one of {list(SEVERITY_ORDER)}")
    if any(f["id"] == new["id"] for f in findings):
        raise SystemExit(f"a finding with id {new['id']} already exists")
    new.setdefault("evidence", [])
    new.setdefault("citations", [])
    new.setdefault("fix_summary", None)
    new.setdefault("test_summary", None)
    findings.append(new)
    save(args.file, findings)
    print(f"added {new['id']}")


def cmd_update(args):
    findings = load(args.file)
    target = next((f for f in findings if f["id"] == args.id), None)
    if target is None:
        raise SystemExit(f"no finding with id {args.id}")
    for kv in args.set:
        key, _, value = kv.partition("=")
        target[key] = value
    save(args.file, findings)
    print(f"updated {args.id}")


def cmd_list(args):
    findings = load(args.file)
    if args.status:
        findings = [f for f in findings if f["status"] == args.status]
    findings = sorted(findings, key=lambda f: SEVERITY_ORDER.get(f["severity"], 9))
    for f in findings:
        loc = f["location"]
        loc_str = f"{loc.get('file', '?')}:{loc.get('line', '?')}"
        print(f"{f['id']:8} {f['severity']:8} {f['status']:14} {loc_str:40} {f['title']}")


def cmd_render(args):
    findings = load(args.file)
    findings = sorted(findings, key=lambda f: SEVERITY_ORDER.get(f["severity"], 9))
    lines = ["# Findings\n"]
    counts = OrderedDict((s, 0) for s in SEVERITY_ORDER)
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1
    lines.append("| Severity | Count |")
    lines.append("|---|---|")
    for sev, count in counts.items():
        if count:
            lines.append(f"| {sev} | {count} |")
    lines.append("")

    for f in findings:
        loc = f["location"]
        loc_str = f"{loc.get('file', '?')}" + (f":{loc['line']}" if loc.get("line") else "")
        if loc.get("function"):
            loc_str += f" (in {loc['function']})"
        lines.append(f"## {f['id']} - {f['title']}")
        lines.append(f"**Severity:** {f['severity']} | **Category:** {f['category']} | **Status:** {f['status']}")
        lines.append(f"**Location:** `{loc_str}`\n")
        lines.append(f"**Description:** {f['description']}\n")
        lines.append(f"**Exploitability:** {f['exploitability']}\n")
        if f.get("evidence"):
            lines.append("**Evidence:**")
            for e in f["evidence"]:
                lines.append(f"```\n{e}\n```")
        if f.get("citations"):
            lines.append("**Citations:** " + "; ".join(f["citations"]))
        if f.get("fix_summary"):
            lines.append(f"\n**Fix:** {f['fix_summary']}")
        if f.get("test_summary"):
            lines.append(f"\n**Verification test:** {f['test_summary']}")
        lines.append("")

    with open(args.out, "w") as out:
        out.write("\n".join(lines))
    print(f"rendered {len(findings)} findings to {args.out}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default="findings.json")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add")
    p_add.add_argument("--json", required=True)
    p_add.set_defaults(func=cmd_add)

    p_update = sub.add_parser("update")
    p_update.add_argument("--id", required=True)
    p_update.add_argument("--set", action="append", required=True, help="key=value, repeatable")
    p_update.set_defaults(func=cmd_update)

    p_list = sub.add_parser("list")
    p_list.add_argument("--status")
    p_list.set_defaults(func=cmd_list)

    p_render = sub.add_parser("render")
    p_render.add_argument("--out", required=True)
    p_render.set_defaults(func=cmd_render)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
