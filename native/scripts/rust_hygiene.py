#!/usr/bin/env python3
"""Prism's Rust structural-hygiene ratchet for native/ (ADR section 4.2, WP-F3).

The fork ran ``rust-hygiene.toml`` through Wavenumber's ``wn-dev-std`` audit
(Rack). This is the same check with no Wavenumber tooling: the measurement
(Tree-sitter Rust grammar, the same node rules) is ported from
``wn_dev_std.rust_hygiene`` 3be1441 (MIT, Copyright (c) 2026 Wavenumber), so
the values it reports match the imported ``rust-hygiene-baseline.json``
exactly. Rack's lane wiring and the ``tests/rack.toml`` gate are dropped.

What it enforces, from ``rust-hygiene.toml``:

- per function with a body: parameters, lines (test functions get their own
  limit), cyclomatic complexity and control-flow nesting;
- per file: physical lines;
- ``clippy.toml`` thresholds and the workspace's ``deny`` clippy lints stay
  at or below the canonical maxima (the compiler half of the policy).

In ``ratchet`` mode a violation passes only if the baseline lists it
(path, item, rule) at a value at least as large. New debt and growth fail.
Debt that has been paid off is reported; ``--prune`` removes it and lowers
shrunken values, and never adds or raises an entry. ``--record`` rewrites the
whole baseline from the current scan; it exists for a reviewed reset (such as
the import into Prism) and its PR must say why.

Usage, from anywhere::

    uv run --no-project --with-requirements native/scripts/rust_hygiene_requirements.txt \\
        python native/scripts/rust_hygiene.py            # check (exit 1 on new debt)
    ... python native/scripts/rust_hygiene.py --prune    # tighten the baseline
    ... python native/scripts/rust_hygiene.py --record "why"  # reviewed reset only

Exit status: 0 pass, 1 a check failed, 2 configuration or usage error.
"""

from __future__ import annotations

import argparse
import json
import sys
import tomllib
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

NATIVE_ROOT = Path(__file__).resolve().parents[1]
CONFIG_NAME = "rust-hygiene.toml"

# The fork's canonical maxima (wn-dev-std 2026.8.12). A config may tighten
# them, never loosen them.
CANONICAL_LIMITS = {
    "max_parameters": 7,
    "max_function_lines": 100,
    "max_test_function_lines": 150,
    "max_file_lines": 1000,
    "max_cyclomatic_complexity": 10,
    "max_nesting": 4,
}
CANONICAL_EXCLUDE_PARTS = frozenset(
    {".git", "_build", "bindings", "build", "generated", "node_modules", "target", "third_party", "vendor"}
)
CLIPPY_THRESHOLDS = {
    "too-many-arguments-threshold": 7,
    "too-many-lines-threshold": 100,
    "cognitive-complexity-threshold": 15,
}
REQUIRED_CLIPPY_LINTS = ("allow_attributes_without_reason", "cognitive_complexity", "too_many_arguments", "too_many_lines")
CONTROL_NODES = frozenset({"if_expression", "while_expression", "for_expression", "loop_expression", "match_expression"})
BRANCH_NODES = frozenset({"if_expression", "while_expression", "for_expression", "loop_expression"})


class ConfigError(Exception):
    """The policy files are missing or malformed (exit status 2)."""


@dataclass(frozen=True, slots=True)
class Violation:
    path: str
    item: str
    rule: str
    value: int
    limit: int

    @property
    def key(self) -> tuple[str, str, str]:
        return (self.path, self.item, self.rule)

    def detail(self) -> str:
        return f"{self.path}:{self.item} {self.rule}={self.value} exceeds {self.limit}"


@dataclass(frozen=True, slots=True)
class Policy:
    mode: str
    baseline: str | None
    limits: Mapping[str, int]
    source_roots: tuple[str, ...]
    exclude_parts: frozenset[str]


# --------------------------------------------------------------------------- config


def _load_toml(path: Path) -> Mapping[str, object]:
    if not path.is_file():
        raise ConfigError(f"{path.name} is required")
    try:
        with path.open("rb") as handle:
            return tomllib.load(handle)
    except tomllib.TOMLDecodeError as exc:
        raise ConfigError(f"{path.name} is invalid TOML: {exc}") from exc


def _strings(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(item.strip() for item in value if isinstance(item, str) and item.strip())


def _bounded(value: str, label: str) -> str:
    path = Path(value)
    if path.is_absolute() or ".." in path.parts:
        raise ConfigError(f"{label} {value!r} must be a bounded root-relative path")
    return value


def load_policy(root: Path) -> Policy:
    data = _load_toml(root / CONFIG_NAME)
    failures: list[str] = []
    if data.get("schema") != 1:
        failures.append("schema must be 1")
    mode = data.get("mode")
    baseline = data.get("baseline") if isinstance(data.get("baseline"), str) else None
    if mode not in ("strict", "ratchet"):
        failures.append("mode must be strict or ratchet")
    elif mode == "ratchet" and not baseline:
        failures.append("ratchet mode requires baseline")
    elif mode == "strict" and baseline:
        failures.append("strict mode must not declare baseline")
    raw_limits = data.get("limits") if isinstance(data.get("limits"), dict) else {}
    limits: dict[str, int] = {}
    for key, canonical in CANONICAL_LIMITS.items():
        value = raw_limits.get(key)
        if type(value) is not int or not 0 < value <= canonical:
            failures.append(f"limits.{key} must be a positive integer <= {canonical}")
        limits[key] = value if type(value) is int else canonical
    paths = data.get("paths") if isinstance(data.get("paths"), dict) else {}
    source_roots = _strings(paths.get("source_roots"))
    exclude_parts = frozenset(_strings(paths.get("exclude_parts")))
    if not source_roots:
        failures.append("paths.source_roots must name at least one directory")
    missing = sorted(CANONICAL_EXCLUDE_PARTS - exclude_parts)
    if missing:
        failures.append("paths.exclude_parts must include " + ", ".join(missing))
    if data.get("exceptions"):
        failures.append("[[exceptions]] are not supported; record accepted debt in the baseline")
    if failures:
        raise ConfigError(f"{CONFIG_NAME}: " + "; ".join(failures))
    for value in (*source_roots, *([baseline] if baseline else [])):
        _bounded(value, CONFIG_NAME + " path")
    return Policy(str(mode), baseline, limits, source_roots, exclude_parts)


def compiler_policy_failures(root: Path) -> list[str]:
    """clippy.toml thresholds and the workspace's deny lints (the compiler half)."""
    failures: list[str] = []
    clippy = _load_toml(root / "clippy.toml")
    for key, maximum in CLIPPY_THRESHOLDS.items():
        value = clippy.get(key)
        if type(value) is not int or value > maximum:
            failures.append(f"clippy.toml {key} must be an integer <= {maximum}")
    cargo = _load_toml(root / "Cargo.toml")
    workspace = cargo.get("workspace") if isinstance(cargo.get("workspace"), dict) else {}
    lints = workspace.get("lints", {}).get("clippy", {}) if isinstance(workspace.get("lints"), dict) else {}
    for lint in REQUIRED_CLIPPY_LINTS:
        level = lints.get(lint)
        level = level.get("level") if isinstance(level, dict) else level
        if str(level).lower() not in ("deny", "forbid"):
            failures.append(f"Cargo.toml workspace.lints.clippy.{lint} must be deny or forbid")
    workspace_lints = workspace.get("lints") if isinstance(workspace.get("lints"), dict) else {}
    for member in _strings(workspace.get("members")):
        manifest = _load_toml(root / member / "Cargo.toml")
        member_lints = manifest.get("lints")
        if isinstance(member_lints, dict) and member_lints.get("workspace") is True:
            continue
        weaker = _weaker_lints(workspace_lints, member_lints if isinstance(member_lints, dict) else {})
        if weaker:
            failures.append(
                f"{member}/Cargo.toml must inherit the workspace lints ([lints] workspace = true)"
                f" or declare each at least as strictly; weaker: {', '.join(weaker)}"
            )
    return failures


_LEVELS = {"allow": 0, "warn": 1, "deny": 2, "forbid": 3}
# Cargo cannot inherit the workspace lints and override one, so a crate that
# needs `unsafe` (the CLI's allocator and signal handlers) declares them itself
# with `unsafe_code = "deny"`, which `#[allow]` can lift item by item.
_RELAXABLE = {("rust", "unsafe_code"): "deny"}


def _lint_level(value: object) -> int:
    level = value.get("level") if isinstance(value, dict) else value
    return _LEVELS.get(str(level).lower(), -1)


def _weaker_lints(workspace_lints: dict, member_lints: dict) -> list[str]:
    """Workspace lints the member leaves out or sets below the workspace's level."""
    weaker = []
    for group, table in workspace_lints.items():
        if not isinstance(table, dict):
            continue
        own = member_lints.get(group) if isinstance(member_lints.get(group), dict) else {}
        for lint, value in table.items():
            required = _lint_level(value)
            floor = _RELAXABLE.get((group, lint))
            if floor is not None:
                required = min(required, _LEVELS[floor])
            if _lint_level(own.get(lint)) < required:
                weaker.append(f"{group}.{lint}")
    return weaker


def coverage_failures(root: Path, policy: Policy) -> list[str]:
    """Every workspace member's src/ and tests/ must sit under a source root."""
    roots = [(root / value).resolve() for value in policy.source_roots]
    failures = [f"paths.source_roots entry {value!r} is not a directory" for value, path in zip(policy.source_roots, roots) if not path.is_dir()]
    workspace = _load_toml(root / "Cargo.toml").get("workspace", {})
    for member in _strings(workspace.get("members") if isinstance(workspace, dict) else None):
        for part in ("src", "tests"):
            path = (root / member / part).resolve()
            if path.exists() and not any(path.is_relative_to(r) for r in roots):
                failures.append(f"paths.source_roots must cover workspace member {member}/{part}")
    return failures


# --------------------------------------------------------------------------- scan


def _rust_parser():  # type: ignore[no-untyped-def]
    try:
        import tree_sitter_rust
        from tree_sitter import Language, Parser
    except ImportError as exc:  # pragma: no cover - environment guidance
        raise ConfigError(
            "tree-sitter and tree-sitter-rust are required: run through "
            "`uv run --no-project --with-requirements native/scripts/rust_hygiene_requirements.txt`"
        ) from exc
    return Parser(Language(tree_sitter_rust.language()))


def _text(node, source: bytes) -> str:  # type: ignore[no-untyped-def]
    if node is None:
        return ""
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def _is_test_attribute(node, source: bytes) -> bool:  # type: ignore[no-untyped-def]
    attribute = next(iter(node.named_children), None)
    if attribute is None or not attribute.named_children:
        return False
    children = attribute.named_children
    name = _text(children[0], source)
    if name == "test":
        return len(children) == 1
    if name.endswith("::test"):
        return True
    return name == "cfg" and _text(attribute.child_by_field_name("arguments"), source).replace(" ", "") == "(test)"


def _is_test_function(node, source: bytes) -> bool:  # type: ignore[no-untyped-def]
    path = node
    while path is not None:
        if path.type == "mod_item" and _text(path.child_by_field_name("name"), source) == "tests":
            return True
        sibling = path.prev_named_sibling
        while sibling is not None and sibling.type == "attribute_item":
            if _is_test_attribute(sibling, source):
                return True
            sibling = sibling.prev_named_sibling
        path = path.parent
    return False


def _qualified_name(node, source: bytes) -> str:  # type: ignore[no-untyped-def]
    name = _text(node.child_by_field_name("name"), source) or "<anonymous>"
    prefixes: list[str] = []
    parent = node.parent
    while parent is not None:
        if parent.type == "impl_item":
            trait = _text(parent.child_by_field_name("trait"), source)
            target = _text(parent.child_by_field_name("type"), source)
            prefixes.append(f"{trait} for {target}" if trait else target)
        elif parent.type in ("trait_item", "mod_item", "function_item"):
            prefixes.append(_text(parent.child_by_field_name("name"), source))
        parent = parent.parent
    return "::".join([part for part in reversed(prefixes) if part] + [name])


def _walk(node) -> Iterator:  # type: ignore[no-untyped-def]
    """Descendants, not entering nested function items (they are measured on their own)."""
    for child in node.named_children:
        yield child
        if child.type != "function_item":
            yield from _walk(child)


def _cyclomatic(body, source: bytes) -> int:  # type: ignore[no-untyped-def]
    complexity = 1
    for node in _walk(body):
        if node.type in BRANCH_NODES:
            complexity += 1
        elif node.type == "match_expression":
            arms = node.child_by_field_name("body")
            count = sum(child.type == "match_arm" for child in arms.named_children) if arms is not None else 0
            complexity += max(0, count - 1)
        elif node.type == "binary_expression":
            text = source[node.start_byte : node.end_byte]
            if b"&&" in text or b"||" in text:
                complexity += 1
    return complexity


def _nesting(body) -> int:  # type: ignore[no-untyped-def]
    maximum = 0
    stack = [(child, 0) for child in body.named_children]
    while stack:
        node, depth = stack.pop()
        if node.type == "function_item":
            continue
        depth = depth + 1 if node.type in CONTROL_NODES else depth
        maximum = max(maximum, depth)
        stack.extend((child, depth) for child in node.named_children)
    return maximum


def _function_violations(node, source: bytes, relative: str, limits: Mapping[str, int]) -> Iterator[Violation]:  # type: ignore[no-untyped-def]
    stack = [node]
    while stack:
        current = stack.pop()
        stack.extend(reversed(current.named_children))
        body = current.child_by_field_name("body") if current.type == "function_item" else None
        if body is None:
            continue
        item = _qualified_name(current, source)
        parameters = current.child_by_field_name("parameters")
        line_rule = "max_test_function_lines" if _is_test_function(current, source) else "max_function_lines"
        measured = (
            ("max_parameters", sum(c.type in ("parameter", "self_parameter", "variadic_parameter") for c in parameters.named_children) if parameters else 0),
            (line_rule, current.end_point.row - current.start_point.row + 1),
            ("max_cyclomatic_complexity", _cyclomatic(body, source)),
            ("max_nesting", _nesting(body)),
        )
        for rule, value in measured:
            if value > limits[rule]:
                yield Violation(relative, item, rule, value, limits[rule])


def _rust_files(root: Path, policy: Policy) -> Iterator[Path]:
    seen: set[Path] = set()
    resolved_root = root.resolve()
    for value in policy.source_roots:
        for path in sorted((root / value).resolve().rglob("*.rs")):
            resolved = path.resolve()
            if resolved in seen or not resolved.is_relative_to(resolved_root):
                continue
            if any(part in policy.exclude_parts for part in resolved.relative_to(resolved_root).parts):
                continue
            seen.add(resolved)
            yield resolved


def scan(root: Path, policy: Policy) -> tuple[list[Violation], int]:
    parser = _rust_parser()
    violations: list[Violation] = []
    files = 0
    for path in _rust_files(root, policy):
        files += 1
        source = path.read_bytes()
        relative = path.relative_to(root.resolve()).as_posix()
        line_count = len(source.splitlines())
        if line_count > policy.limits["max_file_lines"]:
            violations.append(Violation(relative, "<file>", "max_file_lines", line_count, policy.limits["max_file_lines"]))
        tree = parser.parse(source)
        if tree.root_node.has_error:
            raise ConfigError(f"{relative} has Rust syntax errors; the structural scan cannot continue")
        violations.extend(_function_violations(tree.root_node, source, relative, policy.limits))
    if files == 0:
        raise ConfigError("no .rs files under paths.source_roots")
    return violations, files


# --------------------------------------------------------------------------- ratchet


def load_baseline(path: Path) -> tuple[dict[str, object], dict[tuple[str, str, str], int]]:
    if not path.is_file():
        raise ConfigError(f"baseline {path.name} is required")
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ConfigError(f"baseline {path.name} is invalid JSON: {exc}") from exc
    if not isinstance(document, dict) or document.get("schema") != 1 or not isinstance(document.get("violations"), list):
        raise ConfigError(f"baseline {path.name} must be an object with schema 1 and a violations array")
    entries: dict[tuple[str, str, str], int] = {}
    for index, entry in enumerate(document["violations"], start=1):
        ok = isinstance(entry, dict) and all(isinstance(entry.get(k), str) for k in ("path", "item", "rule"))
        if not ok or entry["rule"] not in CANONICAL_LIMITS or type(entry.get("value")) is not int:
            raise ConfigError(f"baseline violations[{index}] is incomplete")
        key = (entry["path"], entry["item"], entry["rule"])
        if key in entries:
            raise ConfigError(f"baseline violations[{index}] duplicates {key}")
        entries[key] = entry["value"]
    return document, entries


def evaluate(baseline: Mapping[tuple[str, str, str], int], violations: Iterable[Violation]) -> tuple[list[str], list[tuple[str, str, str]]]:
    """Failures (new or grown debt) and the baseline keys that no longer occur."""
    failures: list[str] = []
    current: set[tuple[str, str, str]] = set()
    for violation in violations:
        current.add(violation.key)
        allowed = baseline.get(violation.key)
        if allowed is None:
            failures.append("new Rust hygiene debt: " + violation.detail())
        elif violation.value > allowed:
            failures.append(f"increased Rust hygiene debt: {violation.path}:{violation.item} {violation.rule}={violation.value} exceeds baseline {allowed}")
    return failures, sorted(set(baseline) - current)


def prune(path: Path, document: dict[str, object], violations: Sequence[Violation]) -> tuple[int, int]:
    """Drop resolved entries and lower shrunken values; never add or raise one."""
    current = {v.key: v.value for v in violations}
    kept: list[dict[str, object]] = []
    removed = lowered = 0
    for entry in document["violations"]:  # type: ignore[union-attr]
        key = (entry["path"], entry["item"], entry["rule"])
        if key not in current:
            removed += 1
            continue
        if current[key] < entry["value"]:
            entry = {**entry, "value": current[key]}
            lowered += 1
        kept.append(entry)
    if removed or lowered:
        write_baseline(path, str(document.get("rationale", "")), kept)
    return removed, lowered


def write_baseline(path: Path, rationale: str, entries: Sequence[Mapping[str, object]]) -> None:
    """The fork's layout: an indented envelope, one compact line per entry."""
    lines = [json.dumps(dict(e), separators=(",", ":"), ensure_ascii=False) for e in entries]
    head = json.dumps({"schema": 1, "rationale": rationale}, indent=2, ensure_ascii=False)
    path.write_text(head[:-2] + ',\n  "violations": [\n    ' + ",\n    ".join(lines) + "\n  ]\n}\n", encoding="utf-8")


def record(path: Path, rationale: str, violations: Sequence[Violation]) -> None:
    """Re-record the whole baseline. Only for a reviewed reset, never to admit new debt quietly."""
    if not rationale.strip():
        raise ConfigError("--record needs a non-empty rationale")
    entries = [{"path": v.path, "item": v.item, "rule": v.rule, "value": v.value} for v in violations]
    write_baseline(path, rationale.strip(), entries)


# --------------------------------------------------------------------------- main


def run(root: Path, *, do_prune: bool, record_rationale: str | None = None) -> int:
    policy = load_policy(root)
    failures = compiler_policy_failures(root) + coverage_failures(root, policy)
    if failures:
        raise ConfigError("; ".join(failures))
    violations, files = scan(root, policy)
    if policy.mode == "strict":
        failures, stale = [v.detail() for v in violations], []
    else:
        baseline_path = root / str(policy.baseline)
        if record_rationale is not None:
            record(baseline_path, record_rationale, violations)
            print(f"baseline re-recorded: {len(violations)} entr(y/ies)")
        document, baseline = load_baseline(baseline_path)
        failures, stale = evaluate(baseline, violations)
        if do_prune and not failures:
            removed, lowered = prune(baseline_path, document, violations)
            print(f"baseline pruned: {removed} resolved entr(y/ies) removed, {lowered} lowered")
            stale = []
    for failure in failures:
        print(f"FAIL {failure}")
    for key in stale:
        print(f"note resolved debt still in the baseline (run --prune): {key[0]}:{key[1]} {key[2]}")
    print(
        f"rust hygiene ({policy.mode}): {files} files, {len(violations)} violation(s) over the limits, "
        f"{len(failures)} new or increased, {len(stale)} resolved"
    )
    print("RESULT: " + ("FAIL" if failures else "PASS"))
    return 1 if failures else 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", type=Path, default=NATIVE_ROOT, help="the Cargo workspace holding rust-hygiene.toml (default: native/)")
    parser.add_argument("--prune", action="store_true", help="remove resolved baseline entries and lower shrunken values")
    parser.add_argument(
        "--record",
        metavar="RATIONALE",
        help="re-record the whole baseline from the current scan (a reviewed reset; the PR must justify it)",
    )
    args = parser.parse_args(argv)
    if args.prune and args.record is not None:
        parser.error("--prune and --record are exclusive")
    try:
        return run(args.root, do_prune=args.prune, record_rationale=args.record)
    except ConfigError as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
