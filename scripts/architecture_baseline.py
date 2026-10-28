"""The ratchet file two gates share: ``scripts/catalog_architecture_baseline.json``.

It holds two independent ratchets:

* ``private_catalog_uses``: private catalog members used outside their modules
  (``check_catalog_architecture.py``); and
* ``module_line_ceilings``: grandfathered line ceilings for oversized modules
  (``check_module_size.py``).

Each gate reads the whole file and, in ``--update-baseline`` mode, rewrites only
its own section. Dependency-free, like the gates.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
from typing import Mapping, Sequence


BASELINE_FILENAME = "catalog_architecture_baseline.json"
DEFAULT_BASELINE_PATH = Path(__file__).resolve().with_name(BASELINE_FILENAME)
BASELINE_VERSION = 1

PrivateCounts = dict[tuple[str, str], int]
Ceilings = dict[str, int]


def _private_use_records(value: object) -> list[tuple[str, str, int]]:
    """Read the current and a couple of early baseline spellings as ``(path, symbol, count)``."""

    if isinstance(value, Mapping):
        raw = value.get("private_catalog_uses", value.get("private_uses", []))
        if isinstance(raw, Mapping):
            records: list[tuple[str, str, int]] = []
            for key, count in raw.items():
                if isinstance(key, str) and "::" in key:
                    path, symbol = key.split("::", 1)
                    records.append((path, symbol, int(count)))
            return records
    else:
        raw = value
    if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes, bytearray)):
        raise ValueError("private_catalog_uses must be a list of {path, symbol, count} records")
    records = []
    for index, item in enumerate(raw):
        if not isinstance(item, Mapping):
            raise ValueError(f"private_catalog_uses[{index}] must be an object")
        try:
            path = str(item["path"])
            symbol = str(item["symbol"])
            count = int(item["count"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(
                f"private_catalog_uses[{index}] requires path, symbol, and integer count"
            ) from exc
        if not path or not symbol or count < 0:
            raise ValueError(f"private_catalog_uses[{index}] has invalid path, symbol, or count")
        records.append((path, symbol, count))
    return records


def _ceilings(value: object) -> Ceilings:
    if not isinstance(value, Mapping):
        return {}
    raw = value.get("module_line_ceilings", value.get("size_ceilings", {}))
    if not isinstance(raw, Mapping):
        raise ValueError("module_line_ceilings must be an object")
    result: Ceilings = {}
    for path, ceiling in raw.items():
        try:
            parsed = int(ceiling)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"module_line_ceilings[{path!r}] must be an integer") from exc
        if not isinstance(path, str) or not path or parsed <= 0:
            raise ValueError(f"module_line_ceilings[{path!r}] has an invalid ceiling")
        result[path] = parsed
    return result


def parse_baseline_payload(payload: object, source: str) -> tuple[PrivateCounts, Ceilings]:
    """Parse one baseline payload shared by disk and git-ref loading."""

    if not isinstance(payload, Mapping):
        raise ValueError(f"Architecture baseline {source} must be a JSON object")
    private: PrivateCounts = {}
    for path, symbol, count in _private_use_records(payload):
        key = (path, symbol)
        if key in private:
            raise ValueError(
                f"Architecture baseline {source} repeats private-use key {path}::{symbol}"
            )
        private[key] = count
    return private, _ceilings(payload)


def load_baseline(path: Path = DEFAULT_BASELINE_PATH) -> tuple[PrivateCounts, Ceilings]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Unable to read architecture baseline {path}: {exc}") from exc
    return parse_baseline_payload(payload, str(path))


def load_baseline_at_ref(
    repo_root: Path,
    base_ref: str,
    baseline_path: Path,
) -> tuple[PrivateCounts, Ceilings] | None:
    """Load ``baseline_path`` from a validated git ref.

    A missing baseline at the base ref is the expected bootstrap case for the
    first PR that introduces a guard.  It returns ``None`` so the caller can
    report that the comparison was skipped.  An unknown ref or malformed file
    is an error and never silently disables the comparison.
    """

    base_ref = str(base_ref).strip()
    if not base_ref or any(character in base_ref for character in "\r\n"):
        raise ValueError("--base-ref must be a non-empty git ref without newlines")
    try:
        relative = baseline_path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError as exc:
        raise ValueError("--baseline must be inside --repo-root when --base-ref is used") from exc

    verified = subprocess.run(
        ["git", "rev-parse", "--verify", f"{base_ref}^{{commit}}"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if verified.returncode != 0:
        detail = verified.stderr.strip() or verified.stdout.strip() or "unknown git ref"
        raise ValueError(f"Unable to resolve architecture baseline base ref {base_ref!r}: {detail}")

    show = subprocess.run(
        ["git", "show", f"{base_ref}:{relative}"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if show.returncode != 0:
        detail = show.stderr.strip()
        missing_markers = ("does not exist", "exists on disk, but not in", "path '" + relative)
        if any(marker in detail for marker in missing_markers):
            return None
        raise ValueError(
            f"Unable to read architecture baseline {relative} at git ref {base_ref!r}: "
            f"{detail or 'git show failed'}"
        )
    try:
        payload = json.loads(show.stdout)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Architecture baseline {relative} at git ref {base_ref!r} is not valid JSON: {exc}"
        ) from exc
    return parse_baseline_payload(payload, f"{base_ref}:{relative}")


def _serializable_baseline(private: Mapping[tuple[str, str], int], ceilings: Mapping[str, int]) -> dict[str, object]:
    return {
        "version": BASELINE_VERSION,
        "private_catalog_uses": [
            {"path": path, "symbol": symbol, "count": private[(path, symbol)]}
            for path, symbol in sorted(private)
        ],
        "module_line_ceilings": {path: ceilings[path] for path in sorted(ceilings)},
    }


def write_baseline(path: Path, private: Mapping[tuple[str, str], int], ceilings: Mapping[str, int]) -> None:
    """Write a deterministic baseline using an atomic same-directory replace."""

    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(_serializable_baseline(private, ceilings), indent=2, sort_keys=False) + "\n"
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(payload, encoding="utf-8")
    temporary.replace(path)


def describe_path(path: Path, repo_root: Path) -> str:
    return str(path.relative_to(repo_root)) if path.is_relative_to(repo_root) else str(path)
