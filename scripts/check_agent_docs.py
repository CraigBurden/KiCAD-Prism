#!/usr/bin/env python3
"""Fail when an AGENTS.md names a repository path that no longer exists.

The agent navigation maps trace features across files. A rename silently turns a
trace into a lie, and a lie is worse than no map: an agent acts on it. This
check catches the dominant decay mode mechanically.

It verifies paths only. It cannot tell whether a trace is still semantically
correct -- that stays a human judgement.

Usage:
    python3 scripts/check_agent_docs.py
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Backtick spans and markdown link targets that look like repository paths.
CODE_SPAN = re.compile(r"`([^`\n]+)`")
LINK_TARGET = re.compile(r"\[[^\]]*\]\(([^)#\s]+)")

# A path we should check: contains a slash or a known source extension, and no
# spaces or glob characters.
SOURCE_SUFFIXES = {".py", ".ts", ".tsx", ".md", ".yml", ".yaml", ".json", ".conf", ".sh"}
SKIP_PREFIXES = ("http://", "https://", "mailto:", "#")


def agent_docs() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files", "*AGENTS.md", "*CLAUDE.md"],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split()
    return [REPO / p for p in out]


def candidates(text: str) -> set[str]:
    found: set[str] = set()
    for match in CODE_SPAN.finditer(text):
        found.add(match.group(1))
    for match in LINK_TARGET.finditer(text):
        found.add(match.group(1))
    return found


def is_path_like(token: str) -> bool:
    if not token or token.startswith(SKIP_PREFIXES):
        return False
    if any(ch in token for ch in " \t*?<>|"):
        return False
    # Strip a trailing :line suffix and a method/symbol suffix in parentheses.
    bare = token.split(":", 1)[0]
    if not bare:
        return False
    suffix = Path(bare).suffix
    if suffix in SOURCE_SUFFIXES:
        return True
    # Directory reference, e.g. backend/app/release_studio/
    return bare.endswith("/") and "/" in bare


def resolve(doc: Path, token: str) -> Path | None:
    """Resolve a token relative to the doc, then to the repo root."""
    bare = token.split(":", 1)[0]
    for base in (doc.parent, REPO):
        candidate = (base / bare).resolve()
        try:
            candidate.relative_to(REPO)
        except ValueError:
            continue
        if candidate.exists():
            return candidate
    return None


def main() -> int:
    failures: list[str] = []
    checked = 0

    for doc in agent_docs():
        text = doc.read_text(encoding="utf-8")
        rel_doc = doc.relative_to(REPO)
        for token in sorted(candidates(text)):
            if not is_path_like(token):
                continue
            checked += 1
            if resolve(doc, token) is None:
                failures.append(f"{rel_doc}: path does not exist -> {token}")

    if failures:
        print(f"Stale agent documentation ({len(failures)} broken path(s)):\n")
        for failure in failures:
            print(f"  {failure}")
        print(
            "\nUpdate the trace in the file above, or correct the path. "
            "A trace that points at a moved file will mislead the next agent."
        )
        return 1

    print(f"Agent documentation paths OK ({checked} checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
