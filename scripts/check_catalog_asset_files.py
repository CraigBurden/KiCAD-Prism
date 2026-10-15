#!/usr/bin/env python3
"""Report catalog asset files that are missing or changed, and restore them by sha256.

Every ``assets`` row linked to a revision is checked: its ``canonical_path``
must exist and hash to the row's ``sha256``. Findings are grouped by impact:

- ``placement_broken``: linked to an active component's ``released_revision_id``;
- ``history_broken``: linked to a released revision or a release record;
- ``draft_only``: everything else.

A missing file the purge ledger accounts for carries ``ledger``:
``quarantined`` (artifact maintenance moved it to quarantine; ``--restore``
moves it back) or ``purged`` (deleted on purpose). ``quarantine`` lists every
quarantined file and when the grace period deletes it.

``--record-legacy`` records each missing never-released draft STEP that no
ledger row accounts for as ``purged`` (``legacy_pre_ledger``): the files the
purge deleted before its ledger existed. Released history and heads are never
recorded; restore those instead. It is a dry run unless ``--apply`` is given.

The exit status is 1 while ``placement_broken`` is not empty, and 2 when the
catalog schema is not at head. The script never initializes or migrates the
catalog, and it assumes no untrusted user changes the store's directories
while it runs.

``--restore`` looks for a missing file's exact bytes in the catalog object
store (read-only: archived objects are verified from their gzip copy and not
restored), then in each ``--search`` directory, and copies them to the row's
``canonical_path``. A quarantined file is moved back from quarantine instead,
and the ledger records the restore. It is a dry run unless ``--apply`` is given. A candidate is
used only when its sha256 matches. Destinations outside the store, or behind a
symlink inside it, are refused; an existing directory entry is never replaced.
"""

from __future__ import annotations

import argparse
import contextlib
import gzip
import hashlib
import json
import os
import sys
import tempfile
import zlib
from pathlib import Path
from typing import Any, BinaryIO, Iterable


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
for candidate in (REPO_ROOT / "backend", REPO_ROOT):
    if (candidate / "app").is_dir():
        sys.path.insert(0, str(candidate))
        break

GROUPS = ("placement_broken", "history_broken", "draft_only")

LINKED_ASSETS_SQL = """
    SELECT
        asset.id, asset.asset_type, asset.canonical_path, asset.sha256, asset.size_bytes,
        bool_or(EXISTS (
            SELECT 1 FROM components component
            WHERE component.released_revision_id = link.revision_id AND component.is_active = 1
        )) AS placement,
        bool_or(revision.release_status = 'released' OR EXISTS (
            SELECT 1 FROM component_release_records record WHERE record.revision_id = link.revision_id
        )) AS history,
        array_agg(DISTINCT revision.component_id ORDER BY revision.component_id) AS component_ids
    FROM assets asset
    JOIN revision_assets link ON link.asset_id = asset.id
    JOIN component_revisions revision ON revision.id = link.revision_id
    GROUP BY asset.id, asset.asset_type, asset.canonical_path, asset.sha256, asset.size_bytes
    ORDER BY asset.id
"""


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def asset_path(store_root: Path, canonical_path: str) -> Path:
    path = Path(canonical_path)
    return path if path.is_absolute() else store_root / path


def check_assets(conn: Any, store_root: Path) -> dict[str, list[dict[str, Any]]]:
    """Missing or changed linked asset files, grouped by impact."""

    from app.services.catalog.step_quarantine import excusing_event  # noqa: PLC0415

    report: dict[str, list[dict[str, Any]]] = {group: [] for group in GROUPS}
    for row in conn.execute(LINKED_ASSETS_SQL).fetchall():
        path = asset_path(store_root, str(row["canonical_path"]))
        if not path.is_file():
            problem = "missing"
        elif file_sha256(path) != row["sha256"]:
            problem = "sha256_mismatch"
        else:
            continue
        group = "placement_broken" if row["placement"] else "history_broken" if row["history"] else "draft_only"
        ledger = excusing_event(conn, str(row["id"])) if problem == "missing" else ""
        report[group].append({
            "ledger": ledger,
            "asset_id": str(row["id"]),
            "asset_type": str(row["asset_type"]),
            "canonical_path": str(path),
            "sha256": str(row["sha256"]),
            "size_bytes": int(row["size_bytes"]),
            "problem": problem,
            "component_ids": [str(item) for item in row["component_ids"]],
        })
    return report


class SearchIndex:
    """Files under the ``--search`` directories, looked up by size then sha256."""

    def __init__(self, roots: Iterable[Path]) -> None:
        self.by_size: dict[int, list[Path]] = {}
        for root in roots:
            for directory, _dirs, names in os.walk(root):
                for name in names:
                    path = Path(directory) / name
                    if path.is_file() and not path.is_symlink():
                        self.by_size.setdefault(path.stat().st_size, []).append(path)
        self.hashes: dict[Path, str] = {}

    def find(self, sha256: str, size_bytes: int) -> Path | None:
        for path in self.by_size.get(size_bytes, []):
            if path not in self.hashes:
                self.hashes[path] = file_sha256(path)
            if self.hashes[path] == sha256:
                return path
        return None


def object_store_source(artifact_store: Any, sha256: str, conn: Any = None) -> tuple[Path, bool] | None:
    """The object store's copy as ``(path, gzipped)``, found read-only (nothing is restored).

    ``conn`` is the ``--database-url`` connection; without it the store uses its own."""

    row = artifact_store.locate(sha256) if conn is None else artifact_store.locate(sha256, conn=conn)
    if row is None:
        return None
    if row["storage_state"] in {"available", "quarantined"} and row["object_path"]:
        return Path(row["object_path"]), False
    if row["storage_state"] == "archived" and row["archived_path"]:
        return Path(row["archived_path"]), True
    return None


def open_source(path: Path, gzipped: bool) -> BinaryIO:
    return gzip.open(path, "rb") if gzipped else path.open("rb")


def source_matches(path: Path, gzipped: bool, sha256: str) -> bool:
    if not path.is_file():
        return False
    digest = hashlib.sha256()
    try:
        with open_source(path, gzipped) as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
    except (OSError, EOFError, zlib.error):
        return False  # unreadable or corrupt (a damaged gzip archive): the candidate is unusable
    return digest.hexdigest() == sha256


def confined_destination(store_root: Path, canonical_path: str) -> tuple[Path | None, str]:
    """``canonical_path`` when it lies inside ``store_root`` with no symlink on the way."""

    root = store_root.resolve()
    destination = Path(os.path.normpath(asset_path(root, canonical_path)))
    # A symlink above the store (macOS /var -> /private/var) is where the store lives, not an
    # escape: accept the root as the caller spelled it too, and check from the resolved root.
    for base in (root, Path(os.path.normpath(store_root.absolute()))):
        with contextlib.suppress(ValueError):
            parts = destination.relative_to(base).parts
            break
    else:
        return None, "outside the catalog store"
    destination = root.joinpath(*parts)
    if not parts:
        return None, "outside the catalog store"
    current = root
    for part in parts:
        current = current / part
        if current.is_symlink():
            return None, "symlink inside the catalog store"
    return destination, ""


def restore_missing(
    report: dict[str, list[dict[str, Any]]],
    *,
    store_root: Path,
    artifact_store: Any,
    search: SearchIndex,
    apply: bool,
    locate_conn: Any = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {"applied": apply, "restored": [], "refused": [], "skipped": [], "unresolved": []}
    for group in GROUPS:
        for item in report[group]:
            entry = {**item, "group": group}
            if item["problem"] != "missing":
                result["unresolved"].append({**entry, "reason": "file exists with other content"})
                continue
            if item.get("ledger") == "quarantined":
                continue  # moved back from quarantine by unquarantine()
            destination, reason = confined_destination(store_root, item["canonical_path"])
            if destination is None:
                result["refused"].append({**entry, "reason": reason})
                continue
            found = object_store_source(artifact_store, item["sha256"], locate_conn)
            origin = "object_store"
            if found is None or not source_matches(*found, item["sha256"]):
                path = search.find(item["sha256"], item["size_bytes"])
                found, origin = ((path, False), "search") if path is not None else (None, "")
            if found is None:
                result["unresolved"].append({**entry, "reason": "no copy with this sha256"})
                continue
            entry.update(source=str(found[0]), origin=origin)
            if apply:
                try:
                    write_verified(store_root, found, destination, item["sha256"])
                except FileExistsError:
                    result["skipped"].append({**entry, "reason": "appeared concurrently"})
                    continue
                except (ValueError, OSError, EOFError, zlib.error) as error:
                    result["refused"].append({**entry, "reason": str(error) or type(error).__name__})
                    continue
            result["restored"].append(entry)
    return result


def unquarantine(report: dict[str, list[dict[str, Any]]], *, service: Any, apply: bool) -> dict[str, Any]:
    """Move quarantined files back through the quarantine, which records each restore."""

    from app.services.catalog.step_quarantine import StepQuarantine  # noqa: PLC0415

    result: dict[str, Any] = {"restored": [], "refused": []}
    for group in GROUPS:
        for item in report[group]:
            if item.get("ledger") != "quarantined":
                continue
            entry = {**item, "group": group}
            if not apply:
                result["restored"].append(entry)
                continue
            try:
                with service.connection() as conn:
                    outcome = StepQuarantine.restore(conn, service.runtime, item["asset_id"], job_id="check-script")
            except Exception as error:  # noqa: BLE001 - reported per asset, the others still run
                result["refused"].append({**entry, "reason": str(error) or type(error).__name__})
                continue
            result["restored"].append({**entry, "outcome": outcome["outcome"]})
    return result


def record_legacy(service: Any, *, apply: bool) -> list[dict[str, Any]]:
    """Missing draft STEPs no ledger row accounts for, recorded as ``legacy_pre_ledger`` with ``--apply``."""

    from app.services.catalog.step_quarantine import StepQuarantine  # noqa: PLC0415

    with service.connection() as conn:
        rows = (
            StepQuarantine.record_legacy_losses(conn, job_id="record-legacy")
            if apply else StepQuarantine.legacy_losses(conn)
        )
        conn.rollback()
    return [{"asset_id": str(row["id"]), "sha256": str(row["sha256"]), "canonical_path": str(row["canonical_path"])}
            for row in rows]


def stored_file_mode() -> int:
    """The mode the catalog gives its files: ``write_bytes`` under the process umask."""

    mask = os.umask(0o022)
    os.umask(mask)
    return 0o666 & ~mask


def write_verified(store_root: Path, source: tuple[Path, bool], destination: Path, sha256: str) -> None:
    """Copy verified bytes to ``destination``; never replaces any existing directory entry."""

    destination.parent.mkdir(parents=True, exist_ok=True)
    if confined_destination(store_root, str(destination))[0] != destination:
        raise ValueError("symlink inside the catalog store")
    handle, temporary = tempfile.mkstemp(dir=destination.parent, prefix=f".{destination.name}.")
    try:
        os.fchmod(handle, stored_file_mode())  # mkstemp creates 0600; match the store's other files
        digest = hashlib.sha256()
        with os.fdopen(handle, "wb") as output, open_source(*source) as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())
        if digest.hexdigest() != sha256:
            raise ValueError(f"source bytes no longer match {sha256}")
        # link() fails on any existing entry, a dangling symlink included; replace() would not.
        os.link(temporary, destination)
    finally:
        Path(temporary).unlink(missing_ok=True)


def main(argv: list[str] | None = None, *, service: Any = None, artifact_store: Any = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database-url", default="", help="Catalog PostgreSQL URL (default: PRISM_DATABASE_URL)")
    parser.add_argument("--restore", action="store_true", help="Look for exact copies of missing files")
    parser.add_argument("--record-legacy", action="store_true",
                        help="Record draft STEP files lost before the purge ledger existed")
    parser.add_argument("--apply", action="store_true",
                        help="Write restored files or legacy ledger rows (default: dry run)")
    parser.add_argument("--search", action="append", default=[], type=Path, metavar="DIR",
                        help="Extra directory to search for copies (repeatable)")
    args = parser.parse_args(argv)
    if args.apply and not (args.restore or args.record_legacy):
        parser.error("--apply requires --restore or --record-legacy")

    from app.services.catalog_schema_migrations import CATALOG_LEDGER  # noqa: PLC0415

    if service is None:
        from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService  # noqa: PLC0415

        # Not initialized: that would create store directories and migrate the schema.
        service = ComponentCatalogPostgresService(database_url=args.database_url or None)
    store_root = service.runtime.store_root
    with service.connection() as conn:
        pending = CATALOG_LEDGER.pending(conn)
        report: dict[str, Any] = {} if pending else check_assets(conn, store_root)
        if not pending:
            from app.core.config import settings  # noqa: PLC0415
            from app.services.catalog.step_quarantine import StepQuarantine  # noqa: PLC0415

            report["quarantine"] = [
                {key: str(value) for key, value in entry.items() if key != "expired"}
                for entry in StepQuarantine.list_open_entries(
                    conn, grace_days=settings.CATALOG_DRAFT_MODEL_QUARANTINE_DAYS
                )
            ]
        conn.rollback()
    if pending:
        print(f"Catalog schema is not at head ({len(pending)} migrations pending); start Prism once to "
              "migrate it, then rerun this check.", file=sys.stderr)
        return 2

    placement_broken = len(report["placement_broken"])
    if args.restore:
        if artifact_store is None:
            from app.services.local_artifact_store import artifact_store  # noqa: PLC0415
        with contextlib.ExitStack() as stack:
            # --database-url names the catalog and its object ledger alike.
            locate_conn = stack.enter_context(service.connection()) if args.database_url else None
            result = restore_missing(
                report, store_root=store_root, artifact_store=artifact_store,
                search=SearchIndex(args.search), apply=args.apply, locate_conn=locate_conn,
            )
        result["unquarantined"] = unquarantine(report, service=service, apply=args.apply)
        report["restore"] = result
        if args.apply:
            placement_broken -= sum(1 for item in result["restored"] if item["group"] == "placement_broken")
    if args.record_legacy:
        report["record_legacy"] = {"applied": args.apply, "assets": record_legacy(service, apply=args.apply)}

    print(json.dumps({"store_root": str(store_root), **report}, indent=2, sort_keys=True))
    return 1 if placement_broken else 0


if __name__ == "__main__":
    raise SystemExit(main())
