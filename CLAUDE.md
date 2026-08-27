# CLAUDE.md

All project context lives in [AGENTS.md](AGENTS.md). Read it first — it is the
canonical, tool-agnostic file. This file carries only Claude-specific notes.

## Skills

Repo-specific skills are in `.claude/skills/`. Prefer them over improvising:

- `prism-quality-gate` — run the four check suites in dependency order and
  interpret failures. Use before claiming any change is done.
- `prism-comparison-change-kind` — add or modify a design-comparison change
  kind across the backend/frontend boundary.
- `prism-api-endpoint` — scaffold a router + service + schema + test that
  satisfies the access-control rules in AGENTS.md.
- `prism-viewer-rebuild` — rebuild the vendored ECAD viewer and parser. The
  test suites pass against a stale build if you skip this.

## Notes

- Do not claim a change is verified without running `prism-quality-gate`. A
  passing subset is not a passing gate.
- `scripts/check_agent_docs.py` guards every path named in an AGENTS.md. Run it
  after moving or renaming files.
