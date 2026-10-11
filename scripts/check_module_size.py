#!/usr/bin/env python3
"""Check the production-module line policy.

Production Python modules (``backend/app`` and ``scripts``, without tests,
fixtures, vendored or generated files) stay at or under 1,200 physical lines; a
catalog facade, composition or orchestrator module under
``app.services.catalog`` stays at or under 500.  The oversized modules that
predate the rule are grandfathered in ``module_line_ceilings`` of
``scripts/catalog_architecture_baseline.json`` at their line count then.  A
grandfathered file may shrink, but never grow.

Usage::

    python3 scripts/check_module_size.py [--base-ref REF]
    python3 scripts/check_module_size.py --update-baseline

``--update-baseline`` is deliberately explicit.  It records only lower or
removed ceilings for already-grandfathered modules and leaves the private-use
ratchet in the same file as it is.  Newly oversized modules and growth beyond
an existing ceiling are refused.  ``--base-ref`` also refuses a baseline that
adds or raises a ceiling relative to that trusted ref.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import Iterator, Mapping, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent))

from architecture_baseline import (  # noqa: E402
    BASELINE_FILENAME,
    describe_path,
    load_baseline,
    load_baseline_at_ref,
    write_baseline,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
MAX_PRODUCTION_MODULE_LINES = 1200
MAX_CATALOG_FACADE_LINES = 500


def _path_key(path: Path, repo_root: Path) -> str:
    return path.resolve().relative_to(repo_root.resolve()).as_posix()


def _is_excluded_from_size_check(path: Path) -> bool:
    parts = set(path.parts)
    if parts & {"tests", "fixtures", "generated", "__pycache__", "vendor"}:
        return True
    name = path.name.lower()
    return (
        name.startswith(("test_", "generated_"))
        or name.endswith(("_test.py", "_generated.py", ".generated.py"))
    )


def _production_python_files(repo_root: Path) -> Iterator[Path]:
    roots = (repo_root / "backend" / "app", repo_root / "scripts")
    paths: list[Path] = []
    for root in roots:
        if not root.is_dir():
            continue
        paths.extend(path for path in root.rglob("*.py") if not _is_excluded_from_size_check(path))
    yield from sorted(set(paths), key=lambda item: item.as_posix())


def _catalog_facade_path(path: Path, repo_root: Path) -> bool:
    try:
        relative = path.resolve().relative_to(
            (repo_root / "backend" / "app" / "services" / "catalog").resolve()
        )
    except ValueError:
        return False
    return any(token in path.stem.casefold() for token in ("facade", "composition", "orchestrator"))


def module_line_counts(repo_root: Path = REPO_ROOT) -> dict[str, int]:
    """Return physical line counts for production Python modules."""

    return {
        _path_key(path, repo_root): len(path.read_text(encoding="utf-8").splitlines())
        for path in _production_python_files(repo_root)
    }


def module_size_failures(
    repo_root: Path = REPO_ROOT,
    ceilings: Mapping[str, int] | None = None,
) -> list[str]:
    """Return actionable failures for the production-module line policy."""

    ceilings = ceilings or {}
    failures: list[str] = []
    for relative, line_count in module_line_counts(repo_root).items():
        path = repo_root / relative
        if _catalog_facade_path(path, repo_root):
            limit = MAX_CATALOG_FACADE_LINES
            label = "catalog facade/composition/orchestrator limit"
        else:
            limit = int(ceilings.get(relative, MAX_PRODUCTION_MODULE_LINES))
            label = "grandfather ceiling" if relative in ceilings else "production-module limit"
        if line_count > limit:
            failures.append(f"{relative}: {line_count} physical lines exceeds {label} of {limit}")
    return failures


def module_size_update_failures(
    repo_root: Path,
    ceilings: Mapping[str, int],
) -> list[str]:
    """Return only failures that make a baseline update unsafe.

    Update mode may lower or remove ceilings that already exist, but it may not
    add a ceiling for a new oversized module.  Existing ceiling growth and the
    stricter catalog facade limit remain hard failures even in update mode.
    """

    failures: list[str] = []
    for relative, line_count in module_line_counts(repo_root).items():
        path = repo_root / relative
        if _catalog_facade_path(path, repo_root):
            limit = MAX_CATALOG_FACADE_LINES
            label = "catalog facade/composition/orchestrator limit"
        elif relative in ceilings:
            limit = int(ceilings[relative])
            label = "grandfather ceiling"
        elif line_count > MAX_PRODUCTION_MODULE_LINES:
            failures.append(
                f"{relative}: {line_count} physical lines would require a new "
                f"grandfather ceiling; --update-baseline refuses new oversized modules"
            )
            continue
        else:
            continue
        if line_count > limit:
            failures.append(f"{relative}: {line_count} physical lines exceeds {label} of {limit}")
    return failures


def update_module_ceilings(
    line_counts: Mapping[str, int],
    baseline_ceilings: Mapping[str, int],
) -> dict[str, int]:
    """Lower or remove existing ceilings without adding new ones.

    The caller must first reject ``module_size_update_failures``.  Keeping this
    transformation pure makes the no-growth policy straightforward to test and
    ensures a failed update can never be made safe by rewriting a ceiling.
    """

    updated: dict[str, int] = {}
    for relative in sorted(baseline_ceilings):
        line_count = line_counts.get(relative)
        if line_count is None or line_count <= MAX_PRODUCTION_MODULE_LINES:
            continue
        updated[relative] = min(int(baseline_ceilings[relative]), line_count)
    return updated


def baseline_monotonic_failures(
    head_ceilings: Mapping[str, int],
    base_ceilings: Mapping[str, int],
) -> list[str]:
    """Reject ceiling additions/growth in the baseline relative to a trusted base ref.

    A change may lower or remove an existing ceiling, but it cannot add one or
    raise it to make a newly oversized module look grandfathered.
    """

    failures: list[str] = []
    for path in sorted(set(head_ceilings) - set(base_ceilings)):
        failures.append(
            f"baseline adds module-line ceiling {path} "
            f"(head ceiling {head_ceilings[path]}, base ref has no ceiling)"
        )
    for path in sorted(set(head_ceilings) & set(base_ceilings)):
        if int(head_ceilings[path]) > int(base_ceilings[path]):
            failures.append(
                f"baseline increases module-line ceiling {path}: "
                f"base {base_ceilings[path]}, head {head_ceilings[path]}"
            )
    return failures


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--baseline", type=Path, default=None)
    parser.add_argument(
        "--update-baseline",
        action="store_true",
        help="lower or remove existing oversized-module ceilings",
    )
    parser.add_argument(
        "--base-ref",
        dest="base_ref",
        default=None,
        help="compare the checked-in ceilings with this trusted git ref; new or raised ceilings are refused",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    repo_root = args.repo_root.resolve()
    baseline_path = (args.baseline or (repo_root / "scripts" / BASELINE_FILENAME)).resolve()
    try:
        baseline_private, baseline_ceilings = load_baseline(baseline_path)
    except ValueError as exc:
        print(f"Module size baseline error: {exc}", file=sys.stderr)
        return 1

    baseline_change_failures: list[str] = []
    if args.base_ref:
        try:
            base_baseline = load_baseline_at_ref(repo_root, args.base_ref, baseline_path)
        except ValueError as exc:
            print(f"Module size base-baseline error: {exc}", file=sys.stderr)
            return 1
        if base_baseline is None:
            print(
                f"Module size baseline monotonic comparison skipped: "
                f"{describe_path(baseline_path, repo_root)} "
                f"does not exist at base ref {args.base_ref!r} (bootstrap)",
                file=sys.stderr,
            )
        else:
            _base_private, base_ceilings = base_baseline
            baseline_change_failures = baseline_monotonic_failures(baseline_ceilings, base_ceilings)

    if args.update_baseline:
        failures = [*module_size_update_failures(repo_root, baseline_ceilings), *baseline_change_failures]
        if failures:
            print(
                "Refusing to update the module size baseline: update mode records only "
                "lower or removed existing ceilings.",
                file=sys.stderr,
            )
            for failure in failures:
                print(f"  - {failure}", file=sys.stderr)
            return 1
        updated_ceilings = update_module_ceilings(module_line_counts(repo_root), baseline_ceilings)
        write_baseline(baseline_path, baseline_private, updated_ceilings)
        print(
            f"Module size baseline safely updated: {len(updated_ceilings)} grandfathered ceilings "
            f"(reductions/removals only) -> {describe_path(baseline_path, repo_root)}"
        )
        return 0

    failures = [*baseline_change_failures, *module_size_failures(repo_root, baseline_ceilings)]
    if failures:
        print(f"Module size check failed ({len(failures)} issue(s)):", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    line_counts = module_line_counts(repo_root)
    grandfathered = sum(1 for path in baseline_ceilings if path in line_counts)
    print(
        "Module size OK: "
        f"{len(line_counts)} production modules checked, "
        f"{grandfathered} grandfathered ceilings"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
