"""Board STEP models and system STEP assemblies on disk
(docs/system-builder/CONTRACTS.md §18).

```text
<KICAD_PROJECTS_ROOT>/.kicad-prism/system-steps/
    boards/<board key>.step   + <board key>.json
    systems/<system_id>/<bundle key>.step + <bundle key>.json
```

A board model is keyed by the project, the commit, the ``kicad-cli`` version
and the export options, so the same inputs reuse the export and a new KiCad
re-exports once. The sidecar records what the export reported. A system STEP
is keyed by its system bundle key and its sidecar is the state the API reads.

Every write is atomic from a reader's point of view: a hidden temporary file in
the same directory is fsynced and renamed into place. ``prune`` drops system
STEPs that nothing has touched for 30 days; board models are a small cache and
stay until their board's inputs change.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.core.config import settings

_SYSTEM_ID = re.compile(r"^[A-Za-z0-9._-]{1,200}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")

#: The export §18 runs for a board occurrence.
BOARD_STEP_OPTIONS: tuple[str, ...] = (
    "--subst-models",
    "--user-origin",
    "0x0mm",
    "--force",
)
#: The same options under the shorter name callers commonly use.
BOARD_OPTIONS = BOARD_STEP_OPTIONS

#: A system STEP untouched for this long is removed by retention.
SYSTEM_STEP_RETENTION_DAYS = 30


def root() -> Path:
    """The STEP store, beside ``bundle_store.root()``."""

    return Path(settings.KICAD_PROJECTS_ROOT).expanduser() / ".kicad-prism" / "system-steps"


def boards_root() -> Path:
    return root() / "boards"


def systems_root() -> Path:
    return root() / "systems"


def _checked_key(key: str) -> None:
    if not _HEX64.match(str(key)):
        raise ValueError("a STEP key is 64 lowercase hex digits")


def _checked_system(system_id: str) -> None:
    if not _SYSTEM_ID.match(str(system_id)) or system_id in (".", ".."):
        raise ValueError(f"unusable system id for the STEP store: {system_id!r}")


# ------------------------------------------------------------------- board


def _options_text(options: Sequence[Any] | Mapping[str, Any] | str) -> str:
    if isinstance(options, str):
        return options
    if isinstance(options, Mapping):
        return json.dumps(dict(options), sort_keys=True, separators=(",", ":"))
    return json.dumps(list(options), separators=(",", ":"))


def board_key(
    project_id: str,
    commit: str,
    kicad_cli_version: str,
    options: Sequence[Any] | Mapping[str, Any] | str = BOARD_STEP_OPTIONS,
) -> str:
    """``sha256(project \\n commit \\n kicad-cli version \\n options)`` (§18)."""

    preimage = "\n".join(
        [str(project_id), str(commit), str(kicad_cli_version), _options_text(options)]
    )
    return hashlib.sha256(preimage.encode("utf-8")).hexdigest()


def board_path(key: str) -> Path:
    _checked_key(key)
    return boards_root() / f"{key}.step"


def board_meta_path(key: str) -> Path:
    _checked_key(key)
    return boards_root() / f"{key}.json"


def board_exists(key: str) -> bool:
    """Whether a stored model answers ``key`` (a failed export has no file)."""

    try:
        return board_path(key).is_file()
    except ValueError:
        return False


def board_record(key: str) -> dict[str, Any] | None:
    """The export's sidecar, or ``None`` when there is none (or it is unreadable)."""

    try:
        path = board_meta_path(key)
    except ValueError:
        return None
    if not path.is_file():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def board_wrote(key: str, *, meta: Mapping[str, Any]) -> None:
    """Record a successful export's sidecar."""

    _write_json(board_meta_path(key), dict(meta))


def board_failed(key: str, *, meta: Mapping[str, Any], error: str) -> None:
    """Record that this board's export cannot produce a model.

    The file is absent, so the next system STEP job that wants to retry this
    board may ignore the record (``retry_failed``) and queue it again.
    """

    board_path(key).unlink(missing_ok=True)
    _write_json(board_meta_path(key), {**dict(meta), "state": "failed", "error": str(error)})


def board_install(key: str, source: Path, *, meta: Mapping[str, Any]) -> Path:
    """Move the export's file into the store and record its sidecar."""

    target = board_path(key)
    target.parent.mkdir(parents=True, exist_ok=True)
    _install_file(source, target)
    board_wrote(key, meta=meta)
    return target


def board_delete(key: str) -> None:
    board_path(key).unlink(missing_ok=True)
    board_meta_path(key).unlink(missing_ok=True)


def board_clear(key: str) -> None:
    """Forget a failed export's sidecar so its next job starts clean."""

    try:
        board_meta_path(key).unlink(missing_ok=True)
    except ValueError:
        pass


# ------------------------------------------------------------------ system


def system_path(system_id: str, bundle_key: str) -> Path:
    _checked_system(system_id)
    _checked_key(bundle_key)
    return systems_root() / system_id / f"{bundle_key}.step"


def system_meta_path(system_id: str, bundle_key: str) -> Path:
    _checked_system(system_id)
    _checked_key(bundle_key)
    return systems_root() / system_id / f"{bundle_key}.json"


def system_exists(system_id: str, bundle_key: str) -> bool:
    try:
        return system_path(system_id, bundle_key).is_file()
    except ValueError:
        return False


def system_record(system_id: str, bundle_key: str) -> dict[str, Any] | None:
    try:
        path = system_meta_path(system_id, bundle_key)
    except ValueError:
        return None
    if not path.is_file():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def system_write_meta(system_id: str, bundle_key: str, record: Mapping[str, Any]) -> None:
    """Replace one assembly's sidecar (state, boards, missing, error, sizes)."""

    _write_json(system_meta_path(system_id, bundle_key), dict(record))


def system_install(
    system_id: str, bundle_key: str, source: Path, *, record: Mapping[str, Any]
) -> Path:
    """Move ``prism-kicad system step``'s output into the store, then its sidecar."""

    target = system_path(system_id, bundle_key)
    target.parent.mkdir(parents=True, exist_ok=True)
    _install_file(source, target)
    system_write_meta(system_id, bundle_key, record)
    return target


def system_touch(system_id: str, bundle_key: str) -> None:
    """Mark a read so retention keeps this assembly."""

    now = time.time()
    for path in (system_path(system_id, bundle_key), system_meta_path(system_id, bundle_key)):
        try:
            os.utime(path, (now, now))
        except OSError:
            pass


def system_record_for_job(system_id: str, job_id: str) -> tuple[str, dict[str, Any]] | None:
    """The sidecar a job owns, whichever key the job ended up building.

    A superseded key carries the same job id; the live ``building`` record wins
    so a crash after a rebase settles the assembly the job was actually making.
    """

    _checked_system(system_id)
    directory = systems_root() / system_id
    if not directory.is_dir():
        return None
    found: tuple[str, dict[str, Any]] | None = None
    for path in sorted(directory.glob("*.json")):
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(value, dict) or str(value.get("jobId") or "") != str(job_id):
            continue
        if value.get("state") == "building":
            return path.stem, value
        found = found or (path.stem, value)
    return found


def system_delete(system_id: str, bundle_key: str) -> None:
    system_path(system_id, bundle_key).unlink(missing_ok=True)
    system_meta_path(system_id, bundle_key).unlink(missing_ok=True)
    try:
        (systems_root() / system_id).rmdir()
    except OSError:
        pass


# ------------------------------------------------------------------ prune


def prune(*, now: datetime | None = None) -> dict[str, int]:
    """Remove system STEPs not touched for ``SYSTEM_STEP_RETENTION_DAYS``."""

    now = now or datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=SYSTEM_STEP_RETENTION_DAYS)).timestamp()
    report = {"systems": 0, "kept": 0, "removed": 0}
    base = systems_root()
    if not base.is_dir():
        return report
    for directory in sorted(path for path in base.iterdir() if path.is_dir()):
        report["systems"] += 1
        keys = {path.stem for path in directory.glob("*.step")}
        keys |= {path.stem for path in directory.glob("*.json")}
        for key in sorted(keys):
            step = directory / f"{key}.step"
            meta = directory / f"{key}.json"
            touched = max(
                (path.stat().st_mtime for path in (step, meta) if path.is_file()),
                default=0.0,
            )
            if touched >= cutoff:
                report["kept"] += 1
                continue
            step.unlink(missing_ok=True)
            meta.unlink(missing_ok=True)
            report["removed"] += 1
        try:
            directory.rmdir()
        except OSError:
            pass
    return report


# ------------------------------------------------------------------ files


def _write_json(target: Path, value: Mapping[str, Any]) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    data = (
        json.dumps(dict(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode(
            "utf-8"
        )
        + b"\n"
    )
    temp = target.parent / f".{target.name}.prism-kicad-{os.getpid()}-{time.monotonic_ns()}.tmp"
    try:
        with open(temp, "xb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp, 0o644)
        os.replace(temp, target)
    except BaseException:
        temp.unlink(missing_ok=True)
        raise


def _install_file(source: Path, target: Path) -> None:
    temp = target.parent / f".{target.name}.prism-kicad-{os.getpid()}-{time.monotonic_ns()}.tmp"
    try:
        with open(source, "rb") as source_handle, open(temp, "xb") as target_handle:
            shutil.copyfileobj(source_handle, target_handle)
            target_handle.flush()
            os.fsync(target_handle.fileno())
        os.chmod(temp, 0o644)
        os.replace(temp, target)
    except BaseException:
        temp.unlink(missing_ok=True)
        raise


__all__ = [
    "BOARD_OPTIONS",
    "BOARD_STEP_OPTIONS",
    "SYSTEM_STEP_RETENTION_DAYS",
    "board_delete",
    "board_exists",
    "board_failed",
    "board_clear",
    "board_install",
    "board_key",
    "board_meta_path",
    "board_path",
    "board_record",
    "board_wrote",
    "boards_root",
    "prune",
    "root",
    "system_delete",
    "system_exists",
    "system_install",
    "system_meta_path",
    "system_path",
    "system_record",
    "system_record_for_job",
    "system_touch",
    "system_write_meta",
    "systems_root",
]
