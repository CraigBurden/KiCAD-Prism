#!/usr/bin/env python3
"""Deterministically migrate the legacy Prism component catalog to PostgreSQL.

The source database is never read in-place: SQLite's online backup API first
creates a transactionally consistent snapshot.  PostgreSQL schema creation is
delegated to ``ComponentCatalogPostgresService`` so this script only owns data
movement and verification.

``psycopg`` and the Prism backend are imported only by the CLI migration path.
The planning, hashing, row verification, and asset verification helpers remain
stdlib-only so they can be tested without a PostgreSQL server.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlsplit, urlunsplit


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
BACKEND_ROOT = REPO_ROOT / "backend"
for candidate in (REPO_ROOT / "backend", REPO_ROOT):
    if (candidate / "app").is_dir():
        BACKEND_ROOT = candidate
        break


MIGRATION_SCHEMA = "prism.catalog.sqlite_to_postgres_a0"
MIGRATION_MARKER_KEY = "migration:catalog:sqlite-to-postgres:a0"
TARGET_BOOTSTRAP_META_KEYS: tuple[str, ...] = (
    "postgres_search_version",
    "postgres_integrity_guards_version",
)
DEFAULT_BATCH_SIZE = 1_000
LEGACY_RELEASE_NAMESPACE = uuid.uuid5(
    uuid.NAMESPACE_URL,
    "https://kicad-prism.dev/migrations/catalog-sqlite-to-postgres-a0/legacy-release",
)
LEGACY_RELEASE_COLUMNS: tuple[str, ...] = (
    "id",
    "component_id",
    "revision_id",
    "release_label",
    "manifest_hash",
    "released_by",
    "approval_decision_id",
    "validation_json",
    "policy_json",
    "created_at",
)
REQUIRED_SOURCE_TABLES: tuple[str, ...] = (
    "components",
    "component_revisions",
    "assets",
    "catalog_meta",
)
REVISION_MANIFEST_EXCLUDED_COLUMNS: frozenset[str] = frozenset(
    {
        "id",
        "component_id",
        "release_status",
        "manifest_hash",
        "manifest_schema",
        "created_at",
        "updated_at",
        "version",
        "parent_revision_id",
        "change_kind",
        "change_summary",
        "created_by",
    }
)
REVISION_ASSET_TYPE_ORDER: Mapping[str, int] = {
    "symbol": 1,
    "footprint": 2,
    "3dmodel": 3,
    "spice": 4,
}
INTEGRITY_FAILURE_SAMPLE_LIMIT = 25

# Parent tables always precede their dependants.  Components intentionally come
# before revisions: the legacy current/released revision pointers are text fields,
# while component_revisions has the enforced component FK.
MIGRATION_TABLES: tuple[str, ...] = (
    "components",
    "component_revisions",
    "project_component_import_sessions",
    "project_component_import_proposals",
    "assets",
    "revision_assets",
    "asset_previews",
    "asset_preview_versions",
    "revision_previews",
    "revision_preview_outputs",
    "asset_validation_runs",
    "asset_validation_findings",
    "component_usage",
    "component_review_decisions",
    "component_release_records",
    "catalog_audit_events",
    "oauth_auth_codes",
    "oauth_revoked_tokens",
    "oauth_service_clients",
    "catalog_meta",
)


class MigrationError(RuntimeError):
    """Base error for an intentionally aborted migration."""


class VerificationError(MigrationError):
    """Raised when copied rows or file-backed assets fail verification."""


class TargetNotEmptyError(MigrationError):
    """Raised when the destination is not a safe one-shot migration target."""


@dataclass(frozen=True)
class ColumnSpec:
    name: str
    data_type: str = "text"
    ordinal: int = 0
    primary_key_position: int = 0


@dataclass(frozen=True)
class TablePlan:
    name: str
    columns: tuple[str, ...]
    primary_key: tuple[str, ...]
    target_types: Mapping[str, str]
    source_only_columns: tuple[str, ...] = ()
    target_only_columns: tuple[str, ...] = ()


def quote_identifier(identifier: str) -> str:
    """Quote an introspected SQL identifier for SQLite or PostgreSQL."""

    return '"' + identifier.replace('"', '""') + '"'


def _canonical_json(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _normalize_timestamp(value: Any) -> str:
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    text = str(value)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return text
    return parsed.isoformat()


def canonical_value(value: Any, data_type: str = "") -> Any:
    """Return a stable JSON-compatible value across SQLite/psycopg types."""

    if value is None:
        return None
    normalized_type = data_type.lower()
    if normalized_type in {"json", "jsonb"} or normalized_type.endswith("[]") or normalized_type == "array":
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                return value
        if isinstance(value, Mapping):
            return {
                str(key): canonical_value(item)
                for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
            }
        if isinstance(value, (list, tuple)):
            return [canonical_value(item) for item in value]
    if normalized_type in {"boolean", "bool"}:
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "t", "yes", "on"}
        return bool(value)
    if normalized_type in {"numeric", "decimal"}:
        try:
            numeric = value if isinstance(value, Decimal) else Decimal(str(value))
        except (ValueError, ArithmeticError):
            return str(value)
        if numeric == numeric.to_integral_value():
            return int(numeric)
        return format(numeric.normalize(), "f")
    if "timestamp" in normalized_type or normalized_type in {"date", "time"}:
        return _normalize_timestamp(value)
    if isinstance(value, bool):
        # The portable catalog schema stores flags as INTEGER.  This also makes a
        # future PostgreSQL BOOLEAN target compare cleanly with SQLite 0/1 values.
        return 1 if value else 0
    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)
        return format(value.normalize(), "f")
    if isinstance(value, float):
        if value == 0:
            return 0.0
        return float(format(value, ".17g"))
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"$bytes": base64.b64encode(bytes(value)).decode("ascii")}
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Mapping):
        return {
            str(key): canonical_value(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    if isinstance(value, (list, tuple)):
        return [canonical_value(item) for item in value]
    # psycopg returns UUID-like values as objects; IDs in the portable schema are
    # text, so stringification is the lossless common representation.
    if not isinstance(value, (str, int)):
        return str(value)
    return value


def canonical_row(
    row: Mapping[str, Any],
    columns: Sequence[str],
    target_types: Mapping[str, str] | None = None,
) -> list[Any]:
    types = target_types or {}
    return [canonical_value(row.get(column), types.get(column, "")) for column in columns]


def _row_key(
    row: Mapping[str, Any],
    primary_key: Sequence[str],
    target_types: Mapping[str, str] | None = None,
) -> tuple[str, ...]:
    types = target_types or {}
    return tuple(
        _canonical_json(canonical_value(row.get(column), types.get(column, "")))
        for column in primary_key
    )


def deterministic_rows_hash(
    rows: Iterable[Mapping[str, Any]],
    columns: Sequence[str],
    primary_key: Sequence[str],
    target_types: Mapping[str, str] | None = None,
) -> str:
    """Hash rows independent of database iteration order and adapter types."""

    ordered = sorted(rows, key=lambda row: _row_key(row, primary_key, target_types))
    digest = hashlib.sha256()
    for row in ordered:
        digest.update(_canonical_json(canonical_row(row, columns, target_types)).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def deterministic_keys_hash(
    rows: Iterable[Mapping[str, Any]],
    primary_key: Sequence[str],
    target_types: Mapping[str, str] | None = None,
) -> str:
    keys = sorted(_row_key(row, primary_key, target_types) for row in rows)
    digest = hashlib.sha256()
    for key in keys:
        digest.update(_canonical_json(key).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def verify_row_sets(
    *,
    table: str,
    source_rows: Sequence[Mapping[str, Any]],
    target_rows: Sequence[Mapping[str, Any]],
    columns: Sequence[str],
    primary_key: Sequence[str],
    target_types: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Verify every source key/value while allowing an explicitly merged superset."""

    if not primary_key:
        raise VerificationError(f"Table {table} has no primary key; deterministic migration is unsafe")

    def index_rows(rows: Sequence[Mapping[str, Any]], side: str) -> dict[tuple[str, ...], Mapping[str, Any]]:
        result: dict[tuple[str, ...], Mapping[str, Any]] = {}
        for row in rows:
            key = _row_key(row, primary_key, target_types)
            if key in result:
                raise VerificationError(f"Duplicate {side} key in {table}: {key}")
            result[key] = row
        return result

    source_by_key = index_rows(source_rows, "source")
    target_by_key = index_rows(target_rows, "target")
    missing_keys = sorted(key for key in source_by_key if key not in target_by_key)
    matching_target_rows = [target_by_key[key] for key in source_by_key if key in target_by_key]
    mismatched_keys = sorted(
        key
        for key, source_row in source_by_key.items()
        if key in target_by_key
        and canonical_row(source_row, columns, target_types)
        != canonical_row(target_by_key[key], columns, target_types)
    )
    source_hash = deterministic_rows_hash(source_rows, columns, primary_key, target_types)
    target_hash = deterministic_rows_hash(matching_target_rows, columns, primary_key, target_types)
    source_key_hash = deterministic_keys_hash(source_rows, primary_key, target_types)
    target_key_hash = deterministic_keys_hash(matching_target_rows, primary_key, target_types)
    passed = (
        not missing_keys
        and not mismatched_keys
        and len(matching_target_rows) == len(source_rows)
        and source_hash == target_hash
        and source_key_hash == target_key_hash
    )
    return {
        "table": table,
        "source_row_count": len(source_rows),
        "target_total_row_count": len(target_rows),
        "target_matched_row_count": len(matching_target_rows),
        "source_key_hash": source_key_hash,
        "target_key_hash": target_key_hash,
        "source_rows_hash": source_hash,
        "target_rows_hash": target_hash,
        "missing_keys": [list(key) for key in missing_keys[:25]],
        "mismatched_keys": [list(key) for key in mismatched_keys[:25]],
        "passed": passed,
    }


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def verify_asset_files(asset_rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Verify that every catalog asset is still backed by its recorded bytes."""

    checked_paths: dict[str, tuple[str, int]] = {}
    failures: list[dict[str, Any]] = []
    for row in sorted(asset_rows, key=lambda item: str(item.get("id", ""))):
        asset_id = str(row.get("id", ""))
        canonical_path = str(row.get("canonical_path", ""))
        expected_hash = str(row.get("sha256", "")).lower()
        expected_size = row.get("size_bytes")
        path = Path(canonical_path)
        if not canonical_path or not path.is_file():
            failures.append({"asset_id": asset_id, "canonical_path": canonical_path, "reason": "missing"})
            continue
        try:
            if canonical_path not in checked_paths:
                checked_paths[canonical_path] = (sha256_file(path), path.stat().st_size)
            actual_hash, actual_size = checked_paths[canonical_path]
        except OSError as exc:
            failures.append(
                {
                    "asset_id": asset_id,
                    "canonical_path": canonical_path,
                    "reason": "unreadable",
                    "detail": str(exc),
                }
            )
            continue
        if not expected_hash or actual_hash.lower() != expected_hash:
            failures.append(
                {
                    "asset_id": asset_id,
                    "canonical_path": canonical_path,
                    "reason": "sha256_mismatch",
                    "expected_sha256": expected_hash,
                    "actual_sha256": actual_hash,
                }
            )
            continue
        if expected_size is not None and int(expected_size) != actual_size:
            failures.append(
                {
                    "asset_id": asset_id,
                    "canonical_path": canonical_path,
                    "reason": "size_mismatch",
                    "expected_size_bytes": int(expected_size),
                    "actual_size_bytes": actual_size,
                }
            )
    return {
        "asset_count": len(asset_rows),
        "unique_file_count": len(checked_paths),
        "failure_count": len(failures),
        "failures": failures,
        "passed": not failures,
    }


def verify_preview_version_files(preview_rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    ready_rows = [row for row in preview_rows if str(row.get("status", "")) == "ready"]
    failures: list[dict[str, Any]] = []
    for row in ready_rows:
        path = Path(str(row.get("file_path", "")))
        if not path.is_file():
            failures.append({"preview_id": str(row.get("id", "")), "reason": "missing"})
            continue
        actual_hash = sha256_file(path)
        actual_size = path.stat().st_size
        if actual_hash != str(row.get("sha256", "")):
            failures.append({"preview_id": str(row.get("id", "")), "reason": "sha256_mismatch"})
        elif actual_size != int(row.get("size_bytes") or 0):
            failures.append({"preview_id": str(row.get("id", "")), "reason": "size_mismatch"})
    return {
        "ready_preview_count": len(ready_rows),
        "failure_count": len(failures),
        "failures": failures[:INTEGRITY_FAILURE_SAMPLE_LIMIT],
        "passed": not failures,
    }


def infer_preview_root(
    sqlite_path: Path,
    preview_rows: Sequence[Mapping[str, Any]],
    configured_root: Path | None = None,
) -> Path:
    if configured_root is not None:
        return configured_root.expanduser().resolve()
    candidates: set[Path] = set()
    for row in preview_rows:
        file_path = str(row.get("file_path", "")).strip()
        if not file_path:
            continue
        path = Path(file_path).expanduser().resolve()
        for parent in path.parents:
            if parent.name == "previews":
                candidates.add(parent)
                break
    if len(candidates) == 1:
        return next(iter(candidates))
    return sqlite_path.expanduser().resolve().parent / "components" / "previews"


def inventory_preview_tree(
    preview_root: Path,
    preview_rows: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Inventory all previews without pruning files absent from the database."""

    preview_root = preview_root.expanduser().resolve()
    indexed_paths = {
        str(Path(str(row.get("file_path"))).expanduser().resolve())
        for row in preview_rows
        if str(row.get("file_path", "")).strip()
    }
    missing_ready = [
        {
            "preview_id": str(row.get("id", "")),
            "file_path": str(row.get("file_path", "")),
        }
        for row in preview_rows
        if str(row.get("status", "")).lower() == "ready"
        and (
            not str(row.get("file_path", "")).strip()
            or not Path(str(row.get("file_path"))).expanduser().is_file()
        )
    ]
    files = sorted(
        (path for path in preview_root.rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(preview_root).as_posix(),
    ) if preview_root.is_dir() else []
    digest = hashlib.sha256()
    indexed_in_tree = 0
    total_size = 0
    for path in files:
        relative = path.relative_to(preview_root).as_posix()
        file_hash = sha256_file(path)
        file_size = path.stat().st_size
        total_size += file_size
        if str(path.resolve()) in indexed_paths:
            indexed_in_tree += 1
        digest.update(
            _canonical_json(
                {"path": relative, "sha256": file_hash, "size_bytes": file_size}
            ).encode("utf-8")
        )
        digest.update(b"\n")
    return {
        "action": "preserved_in_place",
        "preview_root": str(preview_root),
        "tree_exists": preview_root.is_dir(),
        "file_count": len(files),
        "total_size_bytes": total_size,
        "tree_sha256": digest.hexdigest(),
        "indexed_record_count": len(preview_rows),
        "indexed_file_count": indexed_in_tree,
        "unindexed_file_count": len(files) - indexed_in_tree,
        "missing_ready_previews": missing_ready,
        "passed": not missing_ready,
    }


def sqlite_source_file_state(sqlite_path: Path) -> dict[str, Any]:
    """Capture source files whose mutation can change a SQLite catalog snapshot.

    The shared-memory file is deliberately excluded: opening a WAL database for a
    read can change its transient lock state.  The database and WAL files contain
    the durable catalog bytes and are stable while writers are stopped.
    """

    sqlite_path = sqlite_path.expanduser().resolve()
    files: list[dict[str, Any]] = []
    for role, path in (
        ("database", sqlite_path),
        ("wal", Path(str(sqlite_path) + "-wal")),
    ):
        if not path.exists():
            files.append({"role": role, "path": str(path), "exists": False})
            continue
        stat = path.stat()
        files.append(
            {
                "role": role,
                "path": str(path),
                "exists": True,
                "size_bytes": stat.st_size,
                "mtime_ns": stat.st_mtime_ns,
            }
        )
    return {
        "files": files,
        "sha256": hashlib.sha256(_canonical_json(files).encode("utf-8")).hexdigest(),
    }


def live_sqlite_source_fingerprint(
    sqlite_path: Path,
    plans: Sequence[TablePlan],
) -> tuple[str, list[dict[str, Any]]]:
    """Re-read the live source in one read transaction for the cutover fence."""

    sqlite_path = sqlite_path.expanduser().resolve()
    if not sqlite_path.is_file():
        raise VerificationError(f"SQLite source disappeared before cutover: {sqlite_path}")
    source_uri = sqlite_path.as_uri() + "?mode=ro"
    try:
        with sqlite3.connect(source_uri, uri=True) as conn:
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA query_only = ON")
            conn.execute("BEGIN")
            live_tables = sqlite_table_names(conn)
            expected_tables = {plan.name for plan in plans}
            live_catalog_tables = {table for table in MIGRATION_TABLES if table in live_tables}
            if live_catalog_tables != expected_tables:
                raise VerificationError(
                    "SQLite catalog table set changed during migration "
                    f"(snapshot={sorted(expected_tables)}, live={sorted(live_catalog_tables)})"
                )
            rows_by_table: dict[str, list[dict[str, Any]]] = {}
            for plan in plans:
                live_columns = sqlite_columns(conn, plan.name)
                live_names = tuple(
                    column.name for column in sorted(live_columns, key=lambda item: item.ordinal)
                )
                live_primary_key = tuple(
                    column.name
                    for column in sorted(live_columns, key=lambda item: item.primary_key_position)
                    if column.primary_key_position > 0
                )
                if live_names != plan.columns or live_primary_key != plan.primary_key:
                    raise VerificationError(
                        f"SQLite schema for {plan.name} changed during migration"
                    )
                rows_by_table[plan.name] = read_sqlite_rows(conn, plan)
            fingerprint, table_fingerprints = source_fingerprint(rows_by_table, plans)
            conn.rollback()
            return fingerprint, table_fingerprints
    except sqlite3.Error as exc:
        raise VerificationError(f"Could not re-read SQLite source before cutover: {exc}") from exc


def legacy_catalog_evidence(sqlite_path: Path, limit: int = 25) -> list[str]:
    """Return durable evidence that a missing source is not a fresh installation."""

    sqlite_path = sqlite_path.expanduser().resolve()
    prism_root = sqlite_path.parent
    evidence: list[str] = []
    for path in (Path(str(sqlite_path) + "-wal"), Path(str(sqlite_path) + "-shm")):
        if path.exists():
            evidence.append(str(path))
    search_roots = (prism_root / "components", prism_root / "backups")
    for root in search_roots:
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if path.is_file():
                evidence.append(str(path.resolve()))
                if len(evidence) >= limit:
                    return evidence
    return evidence


def validate_source_tables(table_names: set[str]) -> None:
    missing = [table for table in REQUIRED_SOURCE_TABLES if table not in table_names]
    if missing:
        raise MigrationError(
            "SQLite source is not a Prism component catalog; missing tables: "
            + ", ".join(missing)
        )


def verify_sqlite_database_integrity(conn: sqlite3.Connection) -> dict[str, Any]:
    """Run SQLite's own structural and declared-FK checks on the snapshot."""

    try:
        integrity_messages = [str(row[0]) for row in conn.execute("PRAGMA integrity_check").fetchall()]
        foreign_key_rows = conn.execute("PRAGMA foreign_key_check").fetchall()
    except sqlite3.DatabaseError as exc:
        return {
            "integrity_check": {"result_count": 0, "failure_count": 1, "failures": [str(exc)]},
            "foreign_key_check": {"violation_count": 0, "violations": []},
            "evidence_sha256": hashlib.sha256(str(exc).encode("utf-8")).hexdigest(),
            "passed": False,
        }

    integrity_failures = [message for message in integrity_messages if message.lower() != "ok"]
    foreign_key_violations = [
        {
            "table": str(row[0]),
            "rowid": None if row[1] is None else int(row[1]),
            "parent": str(row[2]),
            "foreign_key_id": int(row[3]),
        }
        for row in foreign_key_rows
    ]
    evidence = {
        "integrity_messages": integrity_messages,
        "foreign_key_violations": foreign_key_violations,
    }
    return {
        "integrity_check": {
            "result_count": len(integrity_messages),
            "failure_count": len(integrity_failures),
            "failures": integrity_failures[:INTEGRITY_FAILURE_SAMPLE_LIMIT],
        },
        "foreign_key_check": {
            "violation_count": len(foreign_key_violations),
            "violations": foreign_key_violations[:INTEGRITY_FAILURE_SAMPLE_LIMIT],
        },
        "evidence_sha256": hashlib.sha256(_canonical_json(evidence).encode("utf-8")).hexdigest(),
        "passed": bool(integrity_messages) and not integrity_failures and not foreign_key_violations,
    }


def verify_component_revision_pointers(
    component_rows: Sequence[Mapping[str, Any]],
    revision_rows: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Verify the un-enforced current/released revision pointers in one pass."""

    revisions = {str(row.get("id", "")): str(row.get("component_id", "")) for row in revision_rows}
    failures: list[dict[str, Any]] = []
    failure_count = 0
    evidence_rows: list[dict[str, str]] = []

    def record_failure(payload: dict[str, Any]) -> None:
        nonlocal failure_count
        failure_count += 1
        if len(failures) < INTEGRITY_FAILURE_SAMPLE_LIMIT:
            failures.append(payload)

    for component in sorted(component_rows, key=lambda row: str(row.get("id", ""))):
        component_id = str(component.get("id", ""))
        current_revision_id = str(component.get("current_revision_id") or "")
        released_revision_id = str(component.get("released_revision_id") or "")
        evidence_rows.append(
            {
                "component_id": component_id,
                "current_revision_id": current_revision_id,
                "released_revision_id": released_revision_id,
            }
        )
        for pointer, revision_id, required in (
            ("current_revision_id", current_revision_id, True),
            ("released_revision_id", released_revision_id, False),
        ):
            if not revision_id:
                if required:
                    record_failure(
                        {
                            "component_id": component_id,
                            "pointer": pointer,
                            "revision_id": "",
                            "reason": "missing_pointer",
                        }
                    )
                continue
            owner_id = revisions.get(revision_id)
            if owner_id is None:
                record_failure(
                    {
                        "component_id": component_id,
                        "pointer": pointer,
                        "revision_id": revision_id,
                        "reason": "missing_revision",
                    }
                )
            elif owner_id != component_id:
                record_failure(
                    {
                        "component_id": component_id,
                        "pointer": pointer,
                        "revision_id": revision_id,
                        "revision_component_id": owner_id,
                        "reason": "revision_owned_by_another_component",
                    }
                )

    pointer_evidence = {
        "components": evidence_rows,
        "revision_owners": [
            {"revision_id": revision_id, "component_id": revisions[revision_id]}
            for revision_id in sorted(revisions)
        ],
    }
    return {
        "component_count": len(component_rows),
        "revision_count": len(revision_rows),
        "pointer_count": sum(
            1 + (1 if str(row.get("released_revision_id") or "") else 0)
            for row in component_rows
        ),
        "failure_count": failure_count,
        "failures": failures,
        "evidence_sha256": hashlib.sha256(
            _canonical_json(pointer_evidence).encode("utf-8")
        ).hexdigest(),
        "passed": failure_count == 0,
    }


def _revision_asset_sort_key(asset: Mapping[str, Any]) -> tuple[int, str, str, str]:
    """Mirror ComponentCatalogService._load_assets_for_revision exactly."""

    return (
        REVISION_ASSET_TYPE_ORDER.get(str(asset.get("asset_type", "")), 99),
        str(asset.get("target_library", "")),
        str(asset.get("target_name", "")),
        str(asset.get("sha256", "")),
    )


def revision_manifest_hash(
    revision: Mapping[str, Any],
    revision_assets: Sequence[Mapping[str, Any]],
    revision_previews: Sequence[Mapping[str, Any]] = (),
) -> str:
    """Reproduce the current SQLite service's revision manifest hash exactly."""

    metadata = {
        key: revision[key]
        for key in sorted(revision)
        if key not in REVISION_MANIFEST_EXCLUDED_COLUMNS
    }
    assets = [
        {
            "asset_type": str(asset.get("asset_type", "")),
            "sha256": str(asset.get("sha256", "")),
            "target_library": str(asset.get("target_library", "")),
            "target_name": str(asset.get("target_name", "")),
            "required": bool(asset.get("required")),
        }
        for asset in sorted(revision_assets, key=_revision_asset_sort_key)
    ]
    # Do not use _canonical_json here: the live service uses json.dumps' default
    # ensure_ascii=True, and the migration must validate the stored bytes exactly.
    manifest_schema = str(revision.get("manifest_schema") or "prism.revision_manifest_a0")
    payload: dict[str, Any] = {"metadata": metadata, "assets": assets}
    if manifest_schema == "prism.revision_manifest_a1":
        payload = {
            "schema": manifest_schema,
            **payload,
            "previews": [
                {
                    "asset_id": str(preview.get("asset_id", "")),
                    "kind": str(preview.get("kind", "")),
                    "sha256": str(preview.get("sha256", "")),
                    "generator_fingerprint": str(preview.get("generator_fingerprint", "")),
                }
                for preview in sorted(
                    revision_previews,
                    key=lambda preview: (
                        str(preview.get("kind", "")),
                        str(preview.get("asset_id", "")),
                        str(preview.get("created_at", "")),
                        str(preview.get("id", "")),
                    ),
                )
                if str(preview.get("status", "")) == "ready"
            ],
        }
    elif manifest_schema == "prism.revision_manifest_a2":
        payload = {"schema": manifest_schema, **payload}
    elif manifest_schema != "prism.revision_manifest_a0":
        raise VerificationError(f"Unsupported revision manifest schema: {manifest_schema}")
    canonical = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def verify_revision_manifests(
    revision_rows: Sequence[Mapping[str, Any]],
    revision_asset_rows: Sequence[Mapping[str, Any]],
    asset_rows: Sequence[Mapping[str, Any]],
    revision_preview_rows: Sequence[Mapping[str, Any]] = (),
    preview_rows: Sequence[Mapping[str, Any]] = (),
) -> dict[str, Any]:
    """Verify all manifests with grouped lookups instead of one query per revision."""

    revisions = {str(row.get("id", "")): row for row in revision_rows}
    assets = {str(row.get("id", "")): row for row in asset_rows}
    grouped_assets: dict[str, list[dict[str, Any]]] = {revision_id: [] for revision_id in revisions}
    previews = {str(row.get("id", "")): row for row in preview_rows}
    grouped_previews: dict[str, list[Mapping[str, Any]]] = {revision_id: [] for revision_id in revisions}
    failures: list[dict[str, Any]] = []
    failure_count = 0

    def record_failure(payload: dict[str, Any]) -> None:
        nonlocal failure_count
        failure_count += 1
        if len(failures) < INTEGRITY_FAILURE_SAMPLE_LIMIT:
            failures.append(payload)

    for link in revision_asset_rows:
        revision_id = str(link.get("revision_id", ""))
        asset_id = str(link.get("asset_id", ""))
        revision = revisions.get(revision_id)
        asset = assets.get(asset_id)
        if revision is None:
            record_failure(
                {
                    "revision_id": revision_id,
                    "asset_id": asset_id,
                    "reason": "link_references_missing_revision",
                }
            )
            continue
        if asset is None:
            record_failure(
                {
                    "revision_id": revision_id,
                    "asset_id": asset_id,
                    "reason": "link_references_missing_asset",
                }
            )
            continue
        if str(link.get("asset_type", "")) != str(asset.get("asset_type", "")):
            record_failure(
                {
                    "revision_id": revision_id,
                    "asset_id": asset_id,
                    "reason": "link_asset_type_mismatch",
                    "link_asset_type": str(link.get("asset_type", "")),
                    "asset_type": str(asset.get("asset_type", "")),
                }
            )
        grouped_assets[revision_id].append({**asset, "required": link.get("required")})

    for link in revision_preview_rows:
        revision_id = str(link.get("revision_id", ""))
        preview_id = str(link.get("preview_id", ""))
        preview = previews.get(preview_id)
        if revision_id not in revisions or preview is None:
            record_failure(
                {
                    "revision_id": revision_id,
                    "preview_id": preview_id,
                    "reason": "preview_link_references_missing_evidence",
                }
            )
            continue
        if str(link.get("asset_id", "")) != str(preview.get("asset_id", "")) or str(
            link.get("kind", "")
        ) != str(preview.get("kind", "")):
            record_failure(
                {
                    "revision_id": revision_id,
                    "preview_id": preview_id,
                    "reason": "preview_link_identity_mismatch",
                }
            )
        grouped_previews[revision_id].append(preview)

    evidence_rows: list[dict[str, str]] = []
    verified_count = 0
    for revision_id in sorted(revisions):
        revision = revisions[revision_id]
        linked_assets = sorted(grouped_assets[revision_id], key=_revision_asset_sort_key)
        for index in range(1, len(linked_assets)):
            previous = linked_assets[index - 1]
            current = linked_assets[index]
            if (
                _revision_asset_sort_key(previous) == _revision_asset_sort_key(current)
                and {
                    "asset_type": str(previous.get("asset_type", "")),
                    "required": bool(previous.get("required")),
                }
                != {
                    "asset_type": str(current.get("asset_type", "")),
                    "required": bool(current.get("required")),
                }
            ):
                record_failure(
                    {
                        "revision_id": revision_id,
                        "reason": "ambiguous_asset_manifest_order",
                        "asset_ids": [str(previous.get("id", "")), str(current.get("id", ""))],
                    }
                )
        expected_hash = revision_manifest_hash(revision, linked_assets, grouped_previews[revision_id])
        stored_hash = str(revision.get("manifest_hash") or "")
        evidence_rows.append(
            {
                "revision_id": revision_id,
                "stored_manifest_hash": stored_hash,
                "expected_manifest_hash": expected_hash,
            }
        )
        if stored_hash != expected_hash:
            record_failure(
                {
                    "revision_id": revision_id,
                    "component_id": str(revision.get("component_id", "")),
                    "reason": "revision_manifest_mismatch",
                    "stored_manifest_hash": stored_hash,
                    "expected_manifest_hash": expected_hash,
                }
            )
        else:
            verified_count += 1

    return {
        "revision_count": len(revision_rows),
        "revision_asset_link_count": len(revision_asset_rows),
        "verified_revision_count": verified_count,
        "failure_count": failure_count,
        "failures": failures,
        "evidence_sha256": hashlib.sha256(
            _canonical_json(evidence_rows).encode("utf-8")
        ).hexdigest(),
        "passed": failure_count == 0 and verified_count == len(revision_rows),
    }


def _audit_details(value: Any) -> Any:
    """Mirror the service's forgiving _json_loads(details_json, {}) behavior."""

    if value in (None, ""):
        return {}
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(str(value))
    except json.JSONDecodeError:
        return {}


def catalog_audit_event_hash(event: Mapping[str, Any]) -> str:
    """Reproduce the current audit event hash; sequence is intentionally excluded."""

    canonical = json.dumps(
        {
            "id": str(event.get("id", "")),
            "component_id": str(event.get("component_id", "")),
            "revision_id": str(event.get("revision_id", "")),
            "event_type": str(event.get("event_type", "")),
            "actor": str(event.get("actor", "")),
            "details": _audit_details(event.get("details_json")),
            "previous_hash": str(event.get("previous_hash", "")),
            "created_at": str(event.get("created_at", "")),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def verify_catalog_audit_chains(
    component_rows: Sequence[Mapping[str, Any]],
    audit_rows: Sequence[Mapping[str, Any]],
    meta_rows: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Verify every component chain, sequence and persisted audit-head anchor."""

    component_ids = {str(row.get("id", "")) for row in component_rows}
    events_by_component: dict[str, list[Mapping[str, Any]]] = {
        component_id: [] for component_id in component_ids
    }
    anchors = {
        str(row.get("key", ""))[len("audit_head:") :]: str(row.get("value", ""))
        for row in meta_rows
        if str(row.get("key", "")).startswith("audit_head:")
    }
    failures: list[dict[str, Any]] = []
    failure_count = 0

    def record_failure(payload: dict[str, Any]) -> None:
        nonlocal failure_count
        failure_count += 1
        if len(failures) < INTEGRITY_FAILURE_SAMPLE_LIMIT:
            failures.append(payload)

    for event in audit_rows:
        component_id = str(event.get("component_id", ""))
        if component_id not in events_by_component:
            record_failure(
                {
                    "component_id": component_id,
                    "event_id": str(event.get("id", "")),
                    "reason": "event_references_missing_component",
                }
            )
            continue
        events_by_component[component_id].append(event)
    for component_id in sorted(set(anchors) - component_ids):
        record_failure(
            {
                "component_id": component_id,
                "reason": "audit_head_references_missing_component",
            }
        )

    coverage_counts = {"complete": 0, "legacy_snapshot": 0, "missing": 0}
    legacy_snapshot_component_ids: list[str] = []
    evidence_rows: list[dict[str, Any]] = []
    verified_event_count = 0
    verified_component_count = 0
    for component_id in sorted(component_ids):
        component_events = events_by_component[component_id]

        def event_sort_key(event: Mapping[str, Any]) -> tuple[int, str]:
            try:
                sequence = int(event.get("sequence"))
            except (TypeError, ValueError):
                sequence = sys.maxsize
            return sequence, str(event.get("id", ""))

        ordered_events = sorted(component_events, key=event_sort_key)
        if not ordered_events:
            coverage_counts["missing"] += 1
            record_failure({"component_id": component_id, "reason": "missing_audit_events"})
        elif any(str(event.get("event_type", "")) == "audit.migrated" for event in ordered_events):
            coverage_counts["legacy_snapshot"] += 1
            if len(legacy_snapshot_component_ids) < INTEGRITY_FAILURE_SAMPLE_LIMIT:
                legacy_snapshot_component_ids.append(component_id)
        else:
            coverage_counts["complete"] += 1

        expected_previous_hash = ""
        component_valid = bool(ordered_events)
        for expected_sequence, event in enumerate(ordered_events, start=1):
            event_id = str(event.get("id", ""))
            try:
                stored_sequence = int(event.get("sequence"))
            except (TypeError, ValueError):
                stored_sequence = -1
            expected_hash = catalog_audit_event_hash(event)
            stored_previous_hash = str(event.get("previous_hash", ""))
            stored_hash = str(event.get("event_hash", ""))
            evidence_rows.append(
                {
                    "component_id": component_id,
                    "event_id": event_id,
                    "sequence": stored_sequence,
                    "details_json_sha256": hashlib.sha256(
                        str(event.get("details_json", "")).encode("utf-8")
                    ).hexdigest(),
                    "stored_previous_hash": stored_previous_hash,
                    "expected_previous_hash": expected_previous_hash,
                    "stored_event_hash": stored_hash,
                    "expected_event_hash": expected_hash,
                }
            )
            event_valid = True
            details_json = event.get("details_json")
            if details_json not in (None, "") and not isinstance(details_json, (list, dict)):
                try:
                    json.loads(str(details_json))
                except json.JSONDecodeError:
                    record_failure(
                        {
                            "component_id": component_id,
                            "event_id": event_id,
                            "reason": "invalid_audit_details_json",
                        }
                    )
                    event_valid = False
            if stored_sequence != expected_sequence:
                record_failure(
                    {
                        "component_id": component_id,
                        "event_id": event_id,
                        "reason": "audit_sequence_gap",
                        "stored_sequence": stored_sequence,
                        "expected_sequence": expected_sequence,
                    }
                )
                event_valid = False
            if stored_previous_hash != expected_previous_hash:
                record_failure(
                    {
                        "component_id": component_id,
                        "event_id": event_id,
                        "reason": "audit_link_mismatch",
                        "stored_previous_hash": stored_previous_hash,
                        "expected_previous_hash": expected_previous_hash,
                    }
                )
                event_valid = False
            if stored_hash != expected_hash:
                record_failure(
                    {
                        "component_id": component_id,
                        "event_id": event_id,
                        "reason": "audit_event_hash_mismatch",
                        "stored_event_hash": stored_hash,
                        "expected_event_hash": expected_hash,
                    }
                )
                event_valid = False
            if event_valid:
                verified_event_count += 1
            else:
                component_valid = False
            # This mirrors the verifier: the next link must point at the canonical
            # hash, not merely repeat a tampered hash stored in the previous row.
            expected_previous_hash = expected_hash

        anchored_head = anchors.get(component_id, "")
        if anchored_head != expected_previous_hash:
            record_failure(
                {
                    "component_id": component_id,
                    "reason": "audit_head_mismatch",
                    "stored_head_hash": anchored_head,
                    "expected_head_hash": expected_previous_hash,
                }
            )
            component_valid = False
        if component_valid:
            verified_component_count += 1

    audit_evidence = {
        "events": evidence_rows,
        "anchors": [
            {"component_id": component_id, "head_hash": anchors[component_id]}
            for component_id in sorted(anchors)
        ],
    }
    return {
        "component_count": len(component_rows),
        "event_count": len(audit_rows),
        "anchor_count": len(anchors),
        "verified_component_count": verified_component_count,
        "verified_event_count": verified_event_count,
        "coverage": coverage_counts,
        "legacy_snapshot_component_ids": legacy_snapshot_component_ids,
        "failure_count": failure_count,
        "failures": failures,
        "evidence_sha256": hashlib.sha256(
            _canonical_json(audit_evidence).encode("utf-8")
        ).hexdigest(),
        "passed": (
            failure_count == 0
            and verified_component_count == len(component_rows)
            and verified_event_count == len(audit_rows)
        ),
    }


def build_legacy_release_records(
    component_rows: Sequence[Mapping[str, Any]],
    revision_rows: Sequence[Mapping[str, Any]],
    existing_release_rows: Sequence[Mapping[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Create deterministic evidence for releases made before release records."""

    revisions = {str(row.get("id", "")): row for row in revision_rows}
    recorded_pairs = {
        (str(row.get("component_id", "")), str(row.get("revision_id", "")))
        for row in existing_release_rows
    }
    released_components = [
        row for row in component_rows if str(row.get("released_revision_id", "")).strip()
    ]
    records: list[dict[str, Any]] = []
    for component in sorted(released_components, key=lambda row: str(row.get("id", ""))):
        component_id = str(component.get("id", ""))
        revision_id = str(component.get("released_revision_id", ""))
        if (component_id, revision_id) in recorded_pairs:
            continue
        revision = revisions.get(revision_id)
        if revision is None:
            raise VerificationError(
                f"Released component {component_id} references missing revision {revision_id}"
            )
        if str(revision.get("component_id", "")) != component_id:
            raise VerificationError(
                f"Released revision {revision_id} does not belong to component {component_id}"
            )
        manifest_hash = str(revision.get("manifest_hash", ""))
        if not manifest_hash:
            raise VerificationError(
                f"Released revision {revision_id} has no manifest hash for legacy release evidence"
            )
        try:
            version = int(revision.get("version"))
        except (TypeError, ValueError) as exc:
            raise VerificationError(f"Released revision {revision_id} has an invalid version") from exc
        legacy_timestamp = str(
            revision.get("updated_at")
            or revision.get("created_at")
            or component.get("updated_at")
            or component.get("created_at")
            or ""
        )
        if not legacy_timestamp:
            raise VerificationError(f"Released revision {revision_id} has no legacy timestamp")
        deterministic_name = f"{component_id}\n{revision_id}\n{manifest_hash}"
        records.append(
            {
                "id": str(uuid.uuid5(LEGACY_RELEASE_NAMESPACE, deterministic_name)),
                "component_id": component_id,
                "revision_id": revision_id,
                "release_label": f"r{version}",
                "manifest_hash": manifest_hash,
                "released_by": "legacy-migration",
                "approval_decision_id": "",
                "validation_json": "{}",
                "policy_json": _canonical_json({"coverage": "legacy_snapshot"}),
                "created_at": legacy_timestamp,
            }
        )
    return records, {
        "released_component_count": len(released_components),
        "existing_source_record_count": len(released_components) - len(records),
        "eligible_legacy_record_count": len(records),
    }


def snapshot_sqlite_database(source_path: Path, snapshot_path: Path) -> dict[str, Any]:
    """Create a consistent source snapshot with SQLite's online backup API."""

    source_path = source_path.expanduser().resolve()
    snapshot_path = snapshot_path.expanduser().resolve()
    if not source_path.is_file():
        raise MigrationError(f"SQLite source does not exist: {source_path}")
    if snapshot_path.exists():
        raise MigrationError(f"Snapshot destination already exists: {snapshot_path}")
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    source_uri = source_path.as_uri() + "?mode=ro"
    try:
        with sqlite3.connect(source_uri, uri=True) as source, sqlite3.connect(snapshot_path) as destination:
            source.execute("PRAGMA query_only = ON")
            source.backup(destination)
            destination.commit()
    except sqlite3.Error as exc:
        raise MigrationError(f"Could not snapshot SQLite source: {exc}") from exc
    return {
        "method": "sqlite_backup_api",
        "source_path": str(source_path),
        "snapshot_path": str(snapshot_path),
        "snapshot_size_bytes": snapshot_path.stat().st_size,
        "snapshot_sha256": sha256_file(snapshot_path),
    }


def sqlite_table_names(conn: sqlite3.Connection) -> set[str]:
    return {
        str(row[0])
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    }


def sqlite_columns(conn: sqlite3.Connection, table: str) -> list[ColumnSpec]:
    rows = conn.execute(f"PRAGMA table_info({quote_identifier(table)})").fetchall()
    return [
        ColumnSpec(
            name=str(row[1]),
            data_type=str(row[2] or "text").lower(),
            ordinal=int(row[0]),
            primary_key_position=int(row[5] or 0),
        )
        for row in rows
    ]


def postgres_table_names(conn: Any, schema: str) -> set[str]:
    rows = conn.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = %s AND table_type = 'BASE TABLE'",
        (schema,),
    ).fetchall()
    return {str(row["table_name"]) for row in rows}


def postgres_columns(conn: Any, schema: str, table: str) -> list[ColumnSpec]:
    rows = conn.execute(
        """
        SELECT column_name, data_type, udt_name, ordinal_position
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        """,
        (schema, table),
    ).fetchall()
    pk_rows = conn.execute(
        """
        SELECT key_column_usage.column_name, key_column_usage.ordinal_position
        FROM information_schema.table_constraints constraints
        JOIN information_schema.key_column_usage key_column_usage
          ON key_column_usage.constraint_name = constraints.constraint_name
         AND key_column_usage.constraint_schema = constraints.constraint_schema
         AND key_column_usage.table_name = constraints.table_name
        WHERE constraints.table_schema = %s
          AND constraints.table_name = %s
          AND constraints.constraint_type = 'PRIMARY KEY'
        ORDER BY key_column_usage.ordinal_position
        """,
        (schema, table),
    ).fetchall()
    pk_positions = {
        str(row["column_name"]): int(row["ordinal_position"])
        for row in pk_rows
    }
    return [
        ColumnSpec(
            name=str(row["column_name"]),
            data_type=str(row["data_type"] or row["udt_name"] or "text").lower(),
            ordinal=int(row["ordinal_position"]),
            primary_key_position=pk_positions.get(str(row["column_name"]), 0),
        )
        for row in rows
    ]


def build_table_plan(
    table: str,
    source_columns: Sequence[ColumnSpec],
    target_columns: Sequence[ColumnSpec],
) -> TablePlan:
    source_names = [column.name for column in sorted(source_columns, key=lambda item: item.ordinal)]
    target_by_name = {column.name: column for column in target_columns}
    common = tuple(name for name in source_names if name in target_by_name)
    source_pk = tuple(
        column.name
        for column in sorted(source_columns, key=lambda item: item.primary_key_position)
        if column.primary_key_position > 0
    )
    target_pk = tuple(
        column.name
        for column in sorted(target_columns, key=lambda item: item.primary_key_position)
        if column.primary_key_position > 0
    )
    if not common:
        raise MigrationError(f"Table {table} has no columns common to SQLite and PostgreSQL")
    if not source_pk or any(column not in common for column in source_pk):
        raise MigrationError(f"Table {table} does not expose its complete SQLite primary key in PostgreSQL")
    if source_pk != target_pk:
        raise MigrationError(
            f"Table {table} primary key differs (SQLite={source_pk}, PostgreSQL={target_pk})"
        )
    target_names = [column.name for column in target_columns]
    return TablePlan(
        name=table,
        columns=common,
        primary_key=source_pk,
        target_types={name: target_by_name[name].data_type for name in common},
        source_only_columns=tuple(name for name in source_names if name not in target_by_name),
        target_only_columns=tuple(name for name in target_names if name not in source_names),
    )


def read_sqlite_rows(conn: sqlite3.Connection, plan: TablePlan) -> list[dict[str, Any]]:
    columns_sql = ", ".join(quote_identifier(column) for column in plan.columns)
    order_sql = ", ".join(quote_identifier(column) for column in plan.primary_key)
    rows = conn.execute(
        f"SELECT {columns_sql} FROM {quote_identifier(plan.name)} ORDER BY {order_sql}"
    ).fetchall()
    return [dict(row) for row in rows]


def read_postgres_rows(conn: Any, schema: str, plan: TablePlan) -> list[dict[str, Any]]:
    columns_sql = ", ".join(quote_identifier(column) for column in plan.columns)
    order_sql = ", ".join(quote_identifier(column) for column in plan.primary_key)
    rows = conn.execute(
        f"SELECT {columns_sql} FROM {quote_identifier(schema)}.{quote_identifier(plan.name)} "
        f"ORDER BY {order_sql}"
    ).fetchall()
    return [dict(row) for row in rows]


def _postgres_placeholder(data_type: str) -> str:
    normalized = data_type.lower()
    if normalized == "jsonb":
        return "%s::jsonb"
    if normalized == "json":
        return "%s::json"
    return "%s"


def _postgres_value(value: Any, data_type: str) -> Any:
    normalized = data_type.lower()
    if value is None:
        return None
    if normalized in {"boolean", "bool"}:
        return canonical_value(value, normalized)
    if normalized in {"json", "jsonb"} and not isinstance(value, str):
        return _canonical_json(value)
    return value


def copy_table_rows(
    conn: Any,
    schema: str,
    plan: TablePlan,
    source_rows: Sequence[Mapping[str, Any]],
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> int:
    if not source_rows:
        return 0
    columns_sql = ", ".join(quote_identifier(column) for column in plan.columns)
    placeholders = ", ".join(
        _postgres_placeholder(plan.target_types.get(column, "")) for column in plan.columns
    )
    sql = (
        f"INSERT INTO {quote_identifier(schema)}.{quote_identifier(plan.name)} ({columns_sql}) "
        f"VALUES ({placeholders}) ON CONFLICT DO NOTHING"
    )
    values = [
        tuple(_postgres_value(row.get(column), plan.target_types.get(column, "")) for column in plan.columns)
        for row in source_rows
    ]
    cursor = conn.cursor()
    for offset in range(0, len(values), max(1, batch_size)):
        cursor.executemany(sql, values[offset : offset + max(1, batch_size)])
    return len(values)


def insert_legacy_release_records(
    conn: Any,
    schema: str,
    records: Sequence[Mapping[str, Any]],
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> int:
    if not records:
        return 0
    columns_sql = ", ".join(quote_identifier(column) for column in LEGACY_RELEASE_COLUMNS)
    placeholders = ", ".join("%s" for _ in LEGACY_RELEASE_COLUMNS)
    sql = (
        f"INSERT INTO {quote_identifier(schema)}.component_release_records ({columns_sql}) "
        f"VALUES ({placeholders}) ON CONFLICT DO NOTHING"
    )
    values = [tuple(row.get(column) for column in LEGACY_RELEASE_COLUMNS) for row in records]
    cursor = conn.cursor()
    for offset in range(0, len(values), max(1, batch_size)):
        cursor.executemany(sql, values[offset : offset + max(1, batch_size)])
    return len(values)


def backfill_legacy_preview_versions(
    conn: Any,
    schema: str,
    preview_rows: Sequence[Mapping[str, Any]],
    revision_asset_rows: Sequence[Mapping[str, Any]],
) -> dict[str, int]:
    revisions_by_asset: dict[str, list[str]] = {}
    for link in revision_asset_rows:
        revisions_by_asset.setdefault(str(link.get("asset_id", "")), []).append(
            str(link.get("revision_id", ""))
        )
    preview_count = 0
    link_count = 0
    for preview in preview_rows:
        preview_id = str(preview.get("id", ""))
        asset_id = str(preview.get("asset_id", ""))
        status = str(preview.get("status", "failed"))
        file_path = str(preview.get("file_path", ""))
        sha256 = ""
        size_bytes = 0
        if status == "ready":
            path = Path(file_path)
            if not path.is_file():
                raise VerificationError(f"Ready legacy preview is missing: {path}")
            sha256 = sha256_file(path)
            size_bytes = path.stat().st_size
        conn.execute(
            f"""
            INSERT INTO {quote_identifier(schema)}.asset_preview_versions (
                id, asset_id, kind, status, content_type, file_path, sha256, size_bytes,
                generator_name, generator_version, pipeline_version, generator_fingerprint,
                generation_error, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'legacy', 'unknown', 'legacy-a0', %s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (
                preview_id,
                asset_id,
                str(preview.get("kind", "")),
                status,
                str(preview.get("content_type", "image/svg+xml")),
                file_path,
                sha256,
                size_bytes,
                f"legacy:{preview_id}",
                str(preview.get("generation_error", "")),
                str(preview.get("created_at", "")),
            ),
        )
        preview_count += 1
        for revision_id in sorted(set(revisions_by_asset.get(asset_id, []))):
            conn.execute(
                f"""
                INSERT INTO {quote_identifier(schema)}.revision_previews (
                    revision_id, asset_id, kind, preview_id, created_at
                ) VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (
                    revision_id,
                    asset_id,
                    str(preview.get("kind", "")),
                    preview_id,
                    str(preview.get("created_at", "")),
                ),
            )
            link_count += 1
    return {"preview_version_count": preview_count, "revision_preview_link_count": link_count}


def read_target_legacy_release_rows(conn: Any, schema: str) -> list[dict[str, Any]]:
    columns_sql = ", ".join(quote_identifier(column) for column in LEGACY_RELEASE_COLUMNS)
    rows = conn.execute(
        f"SELECT {columns_sql} FROM {quote_identifier(schema)}.component_release_records ORDER BY id"
    ).fetchall()
    return [dict(row) for row in rows]


def source_fingerprint(
    source_rows_by_table: Mapping[str, Sequence[Mapping[str, Any]]],
    plans: Sequence[TablePlan],
) -> tuple[str, list[dict[str, Any]]]:
    table_fingerprints: list[dict[str, Any]] = []
    for plan in plans:
        rows = source_rows_by_table[plan.name]
        table_fingerprints.append(
            {
                "table": plan.name,
                "columns": list(plan.columns),
                "primary_key": list(plan.primary_key),
                "row_count": len(rows),
                "rows_sha256": deterministic_rows_hash(
                    rows,
                    plan.columns,
                    plan.primary_key,
                    plan.target_types,
                ),
            }
        )
    return hashlib.sha256(_canonical_json(table_fingerprints).encode("utf-8")).hexdigest(), table_fingerprints


def marker_matches(marker_value: str | None, fingerprint: str) -> bool:
    if not marker_value:
        return False
    try:
        marker = json.loads(marker_value)
    except (TypeError, json.JSONDecodeError):
        return False
    return (
        marker.get("schema") == MIGRATION_SCHEMA
        and marker.get("source_fingerprint") == fingerprint
        and marker.get("verified") is True
    )


def is_verified_migration_marker(marker_value: str | None) -> bool:
    """Recognize a completed migration when its legacy source is unavailable."""

    if not marker_value:
        return False
    try:
        marker = json.loads(marker_value)
    except (TypeError, json.JSONDecodeError):
        return False
    return marker.get("schema") == MIGRATION_SCHEMA and marker.get("verified") is True


def target_row_verification_strategy(mode: str) -> str:
    """Define whether source rows may still be compared byte-for-byte.

    Once PostgreSQL is authoritative, mutable catalog heads, workflow rows, usage,
    previews, OAuth state, and audit anchors legitimately diverge from the frozen
    SQLite source. A matching verified marker is therefore the repeat-run proof;
    exact row verification is only valid inside the first migration transaction.
    """

    if mode == "migrate":
        return "exact_source_rows"
    if mode == "already_migrated":
        return "matching_verified_marker"
    raise MigrationError(f"Unknown catalog migration mode: {mode}")


def decide_missing_source_mode(
    *,
    target_row_count: int,
    marker_value: str | None,
    initialize_empty: bool,
    legacy_evidence: Sequence[str],
) -> str:
    """Safely distinguish an existing migration from explicit fresh bootstrap."""

    if is_verified_migration_marker(marker_value):
        return "already_migrated_without_source"
    if target_row_count > 0:
        raise MigrationError(
            "Legacy SQLite source is missing and PostgreSQL contains catalog rows without "
            "a verified migration marker"
        )
    if not initialize_empty:
        raise MigrationError(
            "Legacy SQLite source is missing. Pass --initialize-empty only for an explicitly "
            "confirmed fresh installation"
        )
    if legacy_evidence:
        raise MigrationError(
            "Refusing empty catalog initialization because legacy component files or backups exist: "
            + ", ".join(legacy_evidence[:5])
        )
    return "initialized_empty"


def decide_target_mode(
    *,
    target_row_count: int,
    marker_value: str | None,
    fingerprint: str,
    allow_nonempty: bool,
    if_needed: bool,
) -> str:
    """Return migrate/already_migrated or refuse an unsafe destination."""

    matching_marker = marker_matches(marker_value, fingerprint)
    if matching_marker and if_needed:
        return "already_migrated"
    if marker_value and not matching_marker and not allow_nonempty:
        raise TargetNotEmptyError(
            "PostgreSQL contains a migration marker for a different SQLite snapshot; "
            "use --allow-nonempty only for a reviewed merge"
        )
    if target_row_count > 0 and not matching_marker and not allow_nonempty:
        raise TargetNotEmptyError(
            f"PostgreSQL catalog already contains {target_row_count} rows; "
            "refusing one-shot migration without --allow-nonempty"
        )
    return "migrate"


def redact_database_url(database_url: str) -> str:
    try:
        parsed = urlsplit(database_url.replace("postgresql+psycopg://", "postgresql://", 1))
        hostname = parsed.hostname or ""
        if ":" in hostname and not hostname.startswith("["):
            hostname = f"[{hostname}]"
        username = f"{parsed.username}@" if parsed.username else ""
        port = f":{parsed.port}" if parsed.port else ""
        return urlunsplit((parsed.scheme, f"{username}{hostname}{port}", parsed.path, "", ""))
    except ValueError:
        return "postgresql://<redacted>"


def _migration_marker_value(
    fingerprint: str,
    source_path: Path,
    *,
    legacy_release_record_count: int,
    preview_tree_sha256: str,
) -> str:
    return _canonical_json(
        {
            "schema": MIGRATION_SCHEMA,
            "source_fingerprint": fingerprint,
            "source_path": str(source_path.resolve()),
            "legacy_release_record_count": legacy_release_record_count,
            "preview_tree_sha256": preview_tree_sha256,
            "verified": True,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }
    )


def _default_sqlite_path() -> Path:
    configured = os.environ.get("CATALOG_SQLITE_PATH", "").strip()
    if configured.startswith("sqlite:///"):
        configured = configured.removeprefix("sqlite:///")
    if configured:
        return Path(configured).expanduser()
    projects_root = Path(
        os.environ.get("KICAD_PROJECTS_ROOT", str(REPO_ROOT / "data" / "projects"))
    ).expanduser()
    return projects_root / ".kicad-prism" / "prism.sqlite3"


def _load_postgres_runtime(database_url: str) -> tuple[Any, Any]:
    """Initialize the authoritative schema, then return service and connection."""

    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))
    try:
        from app.services.component_catalog_service_postgres import (  # noqa: PLC0415
            ComponentCatalogPostgresService,
            _postgres_dsn,
        )
        import psycopg  # noqa: PLC0415
        from psycopg.rows import dict_row  # noqa: PLC0415
    except ImportError as exc:
        raise MigrationError(
            "PostgreSQL migration requires the backend environment with psycopg and psycopg-pool installed"
        ) from exc
    service = ComponentCatalogPostgresService(database_url=database_url)
    try:
        service.initialize()
        connection = psycopg.connect(_postgres_dsn(database_url), row_factory=dict_row, autocommit=False)
    except Exception:
        service.close()
        raise
    return service, connection


def migrate_catalog(
    *,
    sqlite_path: Path,
    database_url: str,
    target_schema: str = "public",
    allow_nonempty: bool = False,
    if_needed: bool = False,
    initialize_empty: bool = False,
    batch_size: int = DEFAULT_BATCH_SIZE,
    preview_root: Path | None = None,
) -> dict[str, Any]:
    started_at = datetime.now(timezone.utc)
    report: dict[str, Any] = {
        "schema": MIGRATION_SCHEMA,
        "status": "running",
        "started_at": started_at.isoformat(),
        "source": str(sqlite_path.expanduser().resolve()),
        "target": redact_database_url(database_url),
        "target_schema": target_schema,
        "tables": [],
    }
    if if_needed and not sqlite_path.expanduser().is_file():
        missing_source_evidence = legacy_catalog_evidence(sqlite_path)
        service, target = _load_postgres_runtime(database_url)
        try:
            component_row = target.execute(
                f"SELECT COUNT(*) AS count FROM {quote_identifier(target_schema)}.components"
            ).fetchone()
            marker_row = target.execute(
                f"SELECT value FROM {quote_identifier(target_schema)}.catalog_meta WHERE key = %s",
                (MIGRATION_MARKER_KEY,),
            ).fetchone()
            marker_value = str(marker_row["value"]) if marker_row else None
            target_row_count = 0
            target_tables = postgres_table_names(target, target_schema)
            for table in MIGRATION_TABLES:
                if table not in target_tables:
                    continue
                if table == "catalog_meta":
                    excluded_keys = (MIGRATION_MARKER_KEY, *TARGET_BOOTSTRAP_META_KEYS)
                    placeholders = ", ".join("%s" for _ in excluded_keys)
                    count_row = target.execute(
                        f"SELECT COUNT(*) AS count FROM {quote_identifier(target_schema)}.catalog_meta "
                        f"WHERE key NOT IN ({placeholders})",
                        excluded_keys,
                    ).fetchone()
                else:
                    count_row = target.execute(
                        f"SELECT COUNT(*) AS count FROM {quote_identifier(target_schema)}.{quote_identifier(table)}"
                    ).fetchone()
                target_row_count += int(count_row["count"])
            target.rollback()
            status = decide_missing_source_mode(
                target_row_count=target_row_count,
                marker_value=marker_value,
                initialize_empty=initialize_empty,
                legacy_evidence=missing_source_evidence,
            )
            report.update(
                {
                    "status": status,
                    "verified": True,
                    "legacy_source_present": False,
                    "empty_initialization_explicit": bool(initialize_empty),
                    "legacy_catalog_evidence": missing_source_evidence,
                    "target_component_count": int(component_row["count"]),
                    "target_catalog_row_count": target_row_count,
                    "marker_present": marker_value is not None,
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "duration_seconds": round(
                        (datetime.now(timezone.utc) - started_at).total_seconds(),
                        3,
                    ),
                }
            )
            return report
        finally:
            target.close()
            service.close()
    service: Any = None
    target: Any = None
    with tempfile.TemporaryDirectory(prefix="prism-catalog-migration-") as temp_dir:
        snapshot_path = Path(temp_dir) / "catalog-snapshot.sqlite3"
        report["snapshot"] = snapshot_sqlite_database(sqlite_path, snapshot_path)
        initial_source_file_state = sqlite_source_file_state(sqlite_path)
        report["cutover_fence"] = {
            "required": True,
            "writers_must_be_stopped": True,
            "initial_source_file_state": initial_source_file_state,
        }
        source = sqlite3.connect(snapshot_path)
        source.row_factory = sqlite3.Row
        try:
            source_tables = sqlite_table_names(source)
            validate_source_tables(source_tables)
            sqlite_integrity = verify_sqlite_database_integrity(source)
            report["source_integrity"] = {"sqlite_database": sqlite_integrity}
            if not sqlite_integrity["passed"]:
                raise VerificationError(
                    "SQLite source failed integrity_check or foreign_key_check"
                )

            service, target = _load_postgres_runtime(database_url)
            target.execute("SET LOCAL prism.catalog_migration = 'on'")
            target_tables = postgres_table_names(target, target_schema)
            missing_target_tables = [
                table for table in MIGRATION_TABLES if table in source_tables and table not in target_tables
            ]
            if missing_target_tables:
                raise MigrationError(
                    "PostgreSQL schema is missing legacy catalog tables: "
                    + ", ".join(missing_target_tables)
                )
            plans: list[TablePlan] = []
            for table in MIGRATION_TABLES:
                if table not in source_tables:
                    continue
                plan = build_table_plan(
                    table,
                    sqlite_columns(source, table),
                    postgres_columns(target, target_schema, table),
                )
                plans.append(plan)
            lossy_plans = [plan for plan in plans if plan.source_only_columns]
            if lossy_plans:
                raise MigrationError(
                    "PostgreSQL schema would omit legacy catalog columns: "
                    + "; ".join(
                        f"{plan.name}={','.join(plan.source_only_columns)}"
                        for plan in lossy_plans
                    )
                )

            source_rows_by_table = {
                plan.name: read_sqlite_rows(source, plan)
                for plan in plans
            }
            pointer_integrity = verify_component_revision_pointers(
                source_rows_by_table.get("components", []),
                source_rows_by_table.get("component_revisions", []),
            )
            manifest_integrity = verify_revision_manifests(
                source_rows_by_table.get("component_revisions", []),
                source_rows_by_table.get("revision_assets", []),
                source_rows_by_table.get("assets", []),
                source_rows_by_table.get("revision_previews", []),
                source_rows_by_table.get("asset_preview_versions", []),
            )
            audit_integrity = verify_catalog_audit_chains(
                source_rows_by_table.get("components", []),
                source_rows_by_table.get("catalog_audit_events", []),
                source_rows_by_table.get("catalog_meta", []),
            )
            semantic_checks = {
                "component_revision_pointers": pointer_integrity,
                "revision_manifests": manifest_integrity,
                "catalog_audit": audit_integrity,
            }
            failed_source_checks = [
                name for name, check in semantic_checks.items() if not check["passed"]
            ]
            report["source_integrity"].update(semantic_checks)
            report["source_integrity"]["evidence_sha256"] = hashlib.sha256(
                _canonical_json(
                    {
                        "sqlite_database": sqlite_integrity["evidence_sha256"],
                        **{
                            name: check["evidence_sha256"]
                            for name, check in semantic_checks.items()
                        },
                    }
                ).encode("utf-8")
            ).hexdigest()
            report["source_integrity"]["passed"] = not failed_source_checks
            if failed_source_checks:
                raise VerificationError(
                    "SQLite source catalog integrity verification failed for: "
                    + ", ".join(failed_source_checks)
                )

            meta_rows = source_rows_by_table.get("catalog_meta", [])
            if any(str(row.get("key")) == MIGRATION_MARKER_KEY for row in meta_rows):
                raise MigrationError(
                    f"SQLite source contains reserved migration marker {MIGRATION_MARKER_KEY}"
                )
            fingerprint, table_fingerprints = source_fingerprint(source_rows_by_table, plans)
            report["source_fingerprint"] = fingerprint
            report["source_table_fingerprints"] = table_fingerprints

            marker_row = target.execute(
                f"SELECT value FROM {quote_identifier(target_schema)}.catalog_meta WHERE key = %s",
                (MIGRATION_MARKER_KEY,),
            ).fetchone()
            marker_value = str(marker_row["value"]) if marker_row else None
            target_counts: dict[str, int] = {}
            for table in MIGRATION_TABLES:
                if table not in target_tables:
                    continue
                if table == "catalog_meta":
                    excluded_keys = (MIGRATION_MARKER_KEY, *TARGET_BOOTSTRAP_META_KEYS)
                    placeholders = ", ".join("%s" for _ in excluded_keys)
                    row = target.execute(
                        f"SELECT COUNT(*) AS count FROM {quote_identifier(target_schema)}.catalog_meta "
                        f"WHERE key NOT IN ({placeholders})",
                        excluded_keys,
                    ).fetchone()
                else:
                    row = target.execute(
                        f"SELECT COUNT(*) AS count FROM {quote_identifier(target_schema)}.{quote_identifier(table)}"
                    ).fetchone()
                target_counts[table] = int(row["count"])
            target_row_count = sum(target_counts.values())
            report["target_preflight"] = {
                "row_count_excluding_marker": target_row_count,
                "table_row_counts": target_counts,
                "marker_present": marker_value is not None,
                "marker_matches": marker_matches(marker_value, fingerprint),
            }
            mode = decide_target_mode(
                target_row_count=target_row_count,
                marker_value=marker_value,
                fingerprint=fingerprint,
                allow_nonempty=allow_nonempty,
                if_needed=if_needed,
            )

            asset_report = verify_asset_files(source_rows_by_table.get("assets", []))
            report["asset_verification"] = asset_report
            if not asset_report["passed"]:
                raise VerificationError(
                    f"{asset_report['failure_count']} catalog assets failed file integrity verification"
                )
            preview_version_report = verify_preview_version_files(
                source_rows_by_table.get("asset_preview_versions", [])
            )
            report["preview_version_verification"] = preview_version_report
            if not preview_version_report["passed"]:
                raise VerificationError(
                    f"{preview_version_report['failure_count']} immutable preview files failed verification"
                )
            resolved_preview_root = infer_preview_root(
                sqlite_path,
                source_rows_by_table.get("asset_previews", []),
                preview_root,
            )
            preview_report = inventory_preview_tree(
                resolved_preview_root,
                source_rows_by_table.get("asset_previews", []),
            )
            report["preview_tree"] = preview_report
            if not preview_report["passed"]:
                raise VerificationError(
                    f"{len(preview_report['missing_ready_previews'])} ready preview files are missing"
                )

            verification_strategy = target_row_verification_strategy(mode)
            report["target_verification"] = {"strategy": verification_strategy}
            if verification_strategy == "matching_verified_marker":
                # PostgreSQL has been authoritative since the first verified
                # migration. Comparing its mutable rows with the frozen SQLite
                # source would reject legitimate revisions and workflow activity.
                report["copy_attempted_row_count"] = 0
                report["tables"] = []
                report["target_verification"]["reason"] = (
                    "matching source fingerprint and verified migration marker"
                )
                report["cutover_fence"]["required"] = False
                report["cutover_fence"]["reason"] = "no PostgreSQL write transaction"
                target.rollback()
                report["status"] = "already_migrated"
                report["verified"] = True
                report["finished_at"] = datetime.now(timezone.utc).isoformat()
                report["duration_seconds"] = round(
                    (datetime.now(timezone.utc) - started_at).total_seconds(), 3
                )
                return report

            copied_rows = 0
            for plan in plans:
                copied_rows += copy_table_rows(
                    target,
                    target_schema,
                    plan,
                    source_rows_by_table[plan.name],
                    batch_size=batch_size,
                )
            report["copy_attempted_row_count"] = copied_rows
            report["legacy_preview_versions"] = backfill_legacy_preview_versions(
                target,
                target_schema,
                source_rows_by_table.get("asset_previews", []),
                source_rows_by_table.get("revision_assets", []),
            )
            target_preview_versions = [
                dict(row)
                for row in target.execute(
                    f"SELECT * FROM {quote_identifier(target_schema)}.asset_preview_versions ORDER BY id"
                ).fetchall()
            ]
            target_preview_version_report = verify_preview_version_files(target_preview_versions)
            report["target_preview_version_verification"] = target_preview_version_report
            if not target_preview_version_report["passed"]:
                raise VerificationError(
                    f"{target_preview_version_report['failure_count']} migrated immutable preview files failed verification"
                )

            table_verification: list[dict[str, Any]] = []
            for plan in plans:
                target_rows = read_postgres_rows(target, target_schema, plan)
                verification = verify_row_sets(
                    table=plan.name,
                    source_rows=source_rows_by_table[plan.name],
                    target_rows=target_rows,
                    columns=plan.columns,
                    primary_key=plan.primary_key,
                    target_types=plan.target_types,
                )
                verification["common_columns"] = list(plan.columns)
                verification["source_only_columns"] = list(plan.source_only_columns)
                verification["target_only_columns"] = list(plan.target_only_columns)
                table_verification.append(verification)
            report["tables"] = table_verification
            failed_tables = [entry["table"] for entry in table_verification if not entry["passed"]]
            if failed_tables:
                raise VerificationError(
                    "PostgreSQL row verification failed for: " + ", ".join(failed_tables)
                )

            legacy_records, legacy_stats = build_legacy_release_records(
                source_rows_by_table["components"],
                source_rows_by_table["component_revisions"],
                source_rows_by_table.get("component_release_records", []),
            )
            release_target_columns = {
                column.name: column.data_type
                for column in postgres_columns(target, target_schema, "component_release_records")
            }
            missing_release_columns = [
                column for column in LEGACY_RELEASE_COLUMNS if column not in release_target_columns
            ]
            if missing_release_columns:
                raise MigrationError(
                    "PostgreSQL release record schema is missing columns: "
                    + ", ".join(missing_release_columns)
                )
            releases_before = read_target_legacy_release_rows(target, target_schema)
            before_ids = {str(row["id"]) for row in releases_before}
            attempted_legacy_records = insert_legacy_release_records(
                target,
                target_schema,
                legacy_records,
                batch_size=batch_size,
            )
            releases_after = read_target_legacy_release_rows(target, target_schema)
            after_ids = {str(row["id"]) for row in releases_after}
            legacy_verification = verify_row_sets(
                table="component_release_records:legacy_synthesized",
                source_rows=legacy_records,
                target_rows=releases_after,
                columns=LEGACY_RELEASE_COLUMNS,
                primary_key=("id",),
                target_types=release_target_columns,
            )
            synthesized_count = len(
                {str(row["id"]) for row in legacy_records} & (after_ids - before_ids)
            )
            report["legacy_release_records"] = {
                **legacy_stats,
                "insert_attempt_count": attempted_legacy_records,
                "synthesized_count": synthesized_count,
                "verification": legacy_verification,
            }
            if not legacy_verification["passed"]:
                raise VerificationError(
                    "Synthesized legacy release records failed deterministic verification"
                )

            live_fingerprint, live_table_fingerprints = live_sqlite_source_fingerprint(
                sqlite_path,
                plans,
            )
            final_source_file_state = sqlite_source_file_state(sqlite_path)
            fingerprint_changed = live_fingerprint != fingerprint
            source_files_changed = final_source_file_state != initial_source_file_state
            report["cutover_fence"].update(
                {
                    "live_source_fingerprint": live_fingerprint,
                    "live_source_table_fingerprints": live_table_fingerprints,
                    "final_source_file_state": final_source_file_state,
                    "fingerprint_changed": fingerprint_changed,
                    "source_files_changed": source_files_changed,
                    "passed": not fingerprint_changed and not source_files_changed,
                }
            )
            if fingerprint_changed or source_files_changed:
                changed_evidence = []
                if fingerprint_changed:
                    changed_evidence.append("catalog fingerprint")
                if source_files_changed:
                    changed_evidence.append("SQLite database/WAL file state")
                raise VerificationError(
                    "SQLite source changed after the migration snapshot ("
                    + " and ".join(changed_evidence)
                    + "); stop all source writers and retry"
                )

            if mode == "migrate" or synthesized_count > 0:
                target.execute(
                    f"INSERT INTO {quote_identifier(target_schema)}.catalog_meta (key, value) VALUES (%s, %s) "
                    "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                    (
                        MIGRATION_MARKER_KEY,
                        _migration_marker_value(
                            fingerprint,
                            sqlite_path,
                            legacy_release_record_count=len(legacy_records),
                            preview_tree_sha256=str(preview_report["tree_sha256"]),
                        ),
                    ),
                )
                marker_after = target.execute(
                    f"SELECT value FROM {quote_identifier(target_schema)}.catalog_meta WHERE key = %s",
                    (MIGRATION_MARKER_KEY,),
                ).fetchone()
                if not marker_after or not marker_matches(str(marker_after["value"]), fingerprint):
                    raise VerificationError("Migration marker could not be verified before commit")
                target.commit()
                report["status"] = "migrated"
            else:
                # Even --if-needed re-verifies the immutable rows and asset store;
                # its marker is evidence, not a shortcut around integrity checks.
                target.rollback()
                report["status"] = "already_migrated"
            report["verified"] = True
        except Exception as error:
            if target is not None:
                target.rollback()
            report["status"] = "failed"
            report["verified"] = False
            report["error_type"] = type(error).__name__
            report["error"] = str(error)
            report["finished_at"] = datetime.now(timezone.utc).isoformat()
            # Preserve detailed evidence for the CLI without changing the useful
            # concrete exception type raised to library callers.
            setattr(error, "migration_report", report)
            raise
        finally:
            source.close()
            if target is not None:
                target.close()
            if service is not None:
                service.close()
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    report["duration_seconds"] = round(
        (datetime.now(timezone.utc) - started_at).total_seconds(), 3
    )
    return report


def _write_report(report: Mapping[str, Any], path: Path | None) -> None:
    payload = json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if path is not None:
        path = path.expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(payload, encoding="utf-8")
    sys.stdout.write(payload)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="One-shot, verified migration of the Prism SQLite component catalog to PostgreSQL."
    )
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=_default_sqlite_path(),
        help="Legacy SQLite catalog (default: CATALOG_SQLITE_PATH or projects store).",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("CATALOG_DATABASE_URL", ""),
        help="PostgreSQL URL (default: CATALOG_DATABASE_URL).",
    )
    parser.add_argument("--schema", default="public", help="PostgreSQL schema (default: public).")
    parser.add_argument(
        "--allow-nonempty",
        action="store_true",
        help="Explicitly permit a reviewed merge into a non-empty target; conflicting rows still fail verification.",
    )
    parser.add_argument(
        "--if-needed",
        action="store_true",
        help=(
            "Exit successfully when the frozen source fingerprint matches a verified marker; "
            "do not compare it with legitimately evolved PostgreSQL rows."
        ),
    )
    parser.add_argument(
        "--initialize-empty",
        action="store_true",
        help=(
            "Explicitly initialize a fresh empty catalog when no SQLite source, target rows, "
            "legacy component files, or catalog backups exist."
        ),
    )
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument(
        "--preview-root",
        type=Path,
        help="Preview tree to preserve/inventory (normally inferred from preview records).",
    )
    parser.add_argument("--report", type=Path, help="Also write the JSON report to this path.")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if not args.database_url:
        report = {
            "schema": MIGRATION_SCHEMA,
            "status": "failed",
            "verified": False,
            "error": "CATALOG_DATABASE_URL or --database-url is required",
        }
        _write_report(report, args.report)
        return 2
    try:
        report = migrate_catalog(
            sqlite_path=args.sqlite,
            database_url=args.database_url,
            target_schema=args.schema,
            allow_nonempty=args.allow_nonempty,
            if_needed=args.if_needed,
            initialize_empty=args.initialize_empty,
            batch_size=max(1, args.batch_size),
            preview_root=args.preview_root,
        )
    except Exception as exc:
        partial_report = getattr(exc, "migration_report", None)
        report = dict(partial_report) if isinstance(partial_report, Mapping) else {}
        report.update(
            {
                "schema": MIGRATION_SCHEMA,
                "status": "failed",
                "verified": False,
                "source": str(args.sqlite.expanduser().resolve()),
                "target": redact_database_url(args.database_url),
                "error_type": type(exc).__name__,
                "error": str(exc),
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        _write_report(report, args.report)
        return 1
    _write_report(report, args.report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
