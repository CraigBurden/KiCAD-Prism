"""Filesystem paths and immutable catalog asset writes.

KiCad text is read by ``app.services.kicad_library_reader``; the symbol helpers
here keep the catalog's historical names for it.
"""

from __future__ import annotations

import logging
import mimetypes
from pathlib import Path
from typing import Any, Iterable
import uuid

from app.core.errors import NotFound
from app.services import kicad_library_reader
from app.services.catalog.conflicts import CatalogConflict
from app.services.catalog.normalization import sanitize_name, sha256_bytes, sha256_file
from app.services.catalog.runtime import CatalogRuntime


STEP_SUFFIXES = frozenset({".step", ".stp"})

logger = logging.getLogger(__name__)


# The database clock as the catalog's ISO-8601 text, so purge times never
# depend on a worker's clock.
DATABASE_NOW_ISO_SQL = """to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"')"""


# A revision whose STEP bytes the purge must keep (aliases ``revision`` and
# ``component``): a head, a released revision, or one that was ever released.
PROTECTED_REVISION_SQL = """
    revision.id = component.current_revision_id
    OR revision.id = component.released_revision_id
    OR revision.release_status = 'released'
    OR EXISTS (SELECT 1 FROM component_release_records record WHERE record.revision_id = revision.id)
"""


ASSET_BYTES_MISSING_CODE = "asset_bytes_missing"


def asset_bytes_lock_key(sha256: str) -> str:
    """The advisory-lock key that serializes the STEP purge with linking an asset.

    One lock per content hash (``hashtext('catalog-asset:' || sha256)``), so
    asset rows sharing bytes share the lock. A linker takes it shared until it
    commits, so linkers never wait for each other and cannot deadlock however
    many models one transaction links, in whatever order. The purge only tries
    it exclusively, so it never waits either.
    """
    return f"catalog-asset:{sha256}"


def lock_and_check_asset_bytes(conn: Any, asset_id: str, *, local_path: Path | None = None) -> None:
    """Before linking a 3D model, wait out a running purge and require its bytes.

    The file is written before any lock is taken, so a purge can delete it
    between the write and the link. Once this holds the asset's lock, the
    purge has either already unlinked the file (so refuse) or cannot take the
    lock until this commits (and will then see this link and keep the file).
    The hash is streamed, so a large STEP is never read into memory.

    ``local_path`` is where this process sees the file, for an importer whose
    row records the running service's path (``--runtime-store-root``).
    """
    row = conn.execute("SELECT canonical_path, sha256 FROM assets WHERE id = %s", (asset_id,)).fetchone()
    if row is None:
        return
    sha256 = str(row["sha256"])
    conn.execute("SELECT pg_advisory_xact_lock_shared(hashtext(%s))", (asset_bytes_lock_key(sha256),)).fetchone()
    path = local_path or Path(str(row["canonical_path"] or ""))
    if not path.is_file() or sha256_file(path) != sha256:
        raise CatalogConflict(
            "The 3D model file is missing from the catalog store; upload it again",
            code=ASSET_BYTES_MISSING_CODE,
        )


def purge_excuses_missing_file(conn: Any, asset_id: str) -> bool:
    """Whether a purge-ledger row still accounts for this asset's missing file.

    The asset must still be purge-eligible (no revision linking it is
    protected), and the latest ledger row for its bytes must be newer than
    every link to it: a link made after the purge, such as re-uploading the
    same bytes, voids the old row until a new purge records the file again.
    """
    row = conn.execute(
        f"""
        SELECT 1 AS present
        FROM assets asset
        WHERE asset.id = %s
          AND NOT EXISTS (
              SELECT 1
              FROM revision_assets link
              JOIN component_revisions revision ON revision.id = link.revision_id
              JOIN components component ON component.id = revision.component_id
              WHERE link.asset_id = asset.id AND ({PROTECTED_REVISION_SQL})
          )
          AND (
              SELECT max(purge.purged_at::timestamptz)
              FROM catalog_asset_file_purges purge
              WHERE purge.asset_id = asset.id AND purge.sha256 = asset.sha256
          ) > (
              SELECT max(link.created_at::timestamptz)
              FROM revision_assets link
              WHERE link.asset_id = asset.id
          )
        """,
        (asset_id,),
    ).fetchone()
    return row is not None


def raise_if_asset_purged(conn: Any, asset_id: str) -> None:
    """Refuse a read of an asset whose file artifact maintenance deleted on purpose."""
    if purge_excuses_missing_file(conn, asset_id):
        raise NotFound("The asset's file was purged by artifact maintenance", code="asset_purged")


def discover_symbol_names_in_text(text: str) -> list[str]:
    """Top-level symbol names in a ``.kicad_sym`` payload, unit blocks excluded."""
    return kicad_library_reader.symbol_names(text)


def discover_footprint_name_in_text(text: str) -> str:
    """The footprint's declared name (``footprint`` or legacy ``module``), or ``""``."""
    return kicad_library_reader.footprint_name(text)


def content_type_for_asset(asset_type: str, file_path: Path) -> str:
    if asset_type == "symbol":
        return "application/x-kicad-symbol"
    if asset_type == "footprint":
        return "application/x-kicad-footprint"
    if asset_type == "3dmodel":
        return "model/step"
    if asset_type == "spice":
        if file_path.suffix.lower() in {".lib", ".mod", ".mdl"}:
            return "application/x-spice"
        return "application/octet-stream"
    guessed, _ = mimetypes.guess_type(file_path.name)
    return guessed or "application/octet-stream"


class CatalogAssetFiles:
    """Stateless catalog asset filesystem operations.

    Runtime state is supplied by callers for path resolution and cache
    invalidation. Symbol parsing does not need a runtime and remains pure.
    """

    @staticmethod
    def asset_root(runtime: CatalogRuntime, asset_type: str) -> Path:
        mapping = {
            "symbol": runtime.store_root / "symbols",
            "footprint": runtime.store_root / "footprints",
            "3dmodel": runtime.store_root / "3dmodels",
            "spice": runtime.store_root / "spice",
        }
        if asset_type not in mapping:
            raise ValueError("Unsupported asset type")
        return mapping[asset_type]

    @staticmethod
    def extract_top_level_symbol_blocks(text: str) -> list[tuple[str, str]]:
        return kicad_library_reader.top_level_symbol_blocks(text)

    @staticmethod
    def symbol_header(text: str) -> tuple[str, str]:
        return kicad_library_reader.library_header(text)

    @staticmethod
    def single_symbol_payload(text: str, selected_symbol: str) -> bytes:
        return kicad_library_reader.single_symbol_library(text, selected_symbol)

    @staticmethod
    def write_canonical_file(runtime: CatalogRuntime, destination: Path, payload: bytes) -> Path:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            existing = destination.read_bytes()
            if existing == payload:
                return destination
            digest = sha256_bytes(payload)
            try:
                relative = destination.resolve().relative_to(runtime.store_root)
            except ValueError:
                relative = Path(destination.name)
            immutable_destination = runtime.store_root / "revisions" / digest / relative
            immutable_destination.parent.mkdir(parents=True, exist_ok=True)
            if immutable_destination.exists():
                if immutable_destination.read_bytes() != payload:
                    raise ValueError(f"Immutable asset hash collision at {immutable_destination}")
                return immutable_destination
            immutable_destination.write_bytes(payload)
            runtime.invalidate_browse_cache()
            return immutable_destination
        destination.write_bytes(payload)
        runtime.invalidate_browse_cache()
        return destination

    @staticmethod
    def symbol_destination(runtime: CatalogRuntime, target_library: str, target_name: str) -> Path:
        safe_library = sanitize_name(target_library, "Prism_Symbols")
        safe_name = sanitize_name(target_name, "symbol")
        return runtime.store_root / "symbols" / safe_library / f"{safe_name}.kicad_sym"

    @staticmethod
    def footprint_destination(runtime: CatalogRuntime, target_library: str, target_name: str) -> Path:
        safe_library = sanitize_name(target_library, "Prism_Footprints")
        safe_name = sanitize_name(target_name, "footprint")
        return runtime.store_root / "footprints" / f"{safe_library}.pretty" / f"{safe_name}.kicad_mod"

    @staticmethod
    def aux_destination(runtime: CatalogRuntime, asset_type: str, target_library: str, upload_name: str) -> Path:
        safe_library = sanitize_name(target_library, "Prism_Assets")
        safe_name = sanitize_name(Path(upload_name).name, f"{asset_type}.bin")
        return CatalogAssetFiles.asset_root(runtime, asset_type) / safe_library / safe_name

    @staticmethod
    def _purge_locked_file(conn: Any, row: Any, path: Path, *, job_id: str) -> bool:
        """Under the asset's lock: re-check eligibility, commit the ledger row, then unlink."""
        relinked = conn.execute(
            f"""
            SELECT 1
            FROM revision_assets link
            JOIN component_revisions revision ON revision.id = link.revision_id
            JOIN components component ON component.id = revision.component_id
            WHERE link.asset_id = %s AND ({PROTECTED_REVISION_SQL})
            LIMIT 1
            """,
            (row["id"],),
        ).fetchone()
        if relinked:
            return False
        conn.execute(
            f"""
            INSERT INTO catalog_asset_file_purges (id, asset_id, sha256, canonical_path, reason, job_id, purged_at)
            VALUES (%s, %s, %s, %s, 'superseded_draft_step', %s, {DATABASE_NOW_ISO_SQL})
            """,
            (str(uuid.uuid4()), row["id"], row["sha256"], str(row["canonical_path"]), job_id),
        )
        conn.commit()
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            logger.warning(
                "Could not purge superseded STEP file %s; the next maintenance run retries", path, exc_info=True
            )
            return False
        return True

    @staticmethod
    def purge_superseded_step_files(
        conn: Any, runtime: CatalogRuntime, *, job_id: str = "", pinned_revision_ids: Iterable[str] = ()
    ) -> dict[str, Any]:
        """Purge obsolete STEP bytes while preserving immutable revision evidence.

        The asset row, hash, revision link, and audit history remain intact. A file
        is removed only when a newer current revision for that component has a
        different 3D model and no revision linking the asset, in any component, is
        protected. A revision is protected while it is its component's current or
        released revision, or once it has ever been released, so released STEP
        evidence is never deleted. A revision in ``pinned_revision_ids`` (one a
        System Builder instance or harness end pins, which the catalog cannot see)
        is protected too.

        Each file's ``catalog_asset_file_purges`` row is committed before the
        file is unlinked, one file at a time, so a crash never leaves a deleted
        file without its row. The reverse failure is benign: a row whose unlink
        failed or never ran names a file that is still there, the row only
        excuses a missing file, and the next run, which still finds the asset
        eligible, deletes it. This commits ``conn``. Audit verification accepts
        a missing never-released draft STEP only through that row.

        Each candidate is purged only under its ``asset_bytes_lock_key`` lock,
        after re-checking under it that no protected revision links the asset.
        The purge only tries the lock: an asset being linked right now is
        skipped until the next run, so the purge never waits and cannot
        deadlock with a linker. It is a session lock, held across the ledger
        commit until the file is unlinked, so a linker of that asset waits for
        the unlink and then refuses the missing file.
        """
        rows = conn.execute(
            f"""
            WITH current_models AS (
                SELECT revision.component_id, link.asset_id
                FROM components component
                JOIN component_revisions revision ON revision.id = component.current_revision_id
                JOIN revision_assets link ON link.revision_id = revision.id
                WHERE link.asset_type = '3dmodel'
            ), superseded_models AS (
                SELECT DISTINCT revision.component_id, link.asset_id
                FROM component_revisions revision
                JOIN components component ON component.id = revision.component_id
                JOIN revision_assets link ON link.revision_id = revision.id
                JOIN current_models replacement
                  ON replacement.component_id = revision.component_id
                 AND replacement.asset_id <> link.asset_id
                WHERE revision.id <> component.current_revision_id
                  AND link.asset_type = '3dmodel'
            ), protected_models AS (
                SELECT DISTINCT link.asset_id
                FROM revision_assets link
                JOIN component_revisions revision ON revision.id = link.revision_id
                JOIN components component ON component.id = revision.component_id
                WHERE ({PROTECTED_REVISION_SQL}) OR revision.id = ANY(%s::text[])
            )
            SELECT DISTINCT asset.id, asset.canonical_path, asset.sha256
            FROM superseded_models superseded
            JOIN assets asset ON asset.id = superseded.asset_id
            LEFT JOIN protected_models protected ON protected.asset_id = superseded.asset_id
            WHERE protected.asset_id IS NULL
              AND (
                lower(asset.canonical_path) LIKE %s
                OR lower(asset.canonical_path) LIKE %s
              )
            """,
            (sorted({str(value) for value in pinned_revision_ids}), "%.step", "%.stp"),
        ).fetchall()
        # Commit the read, and with it the connection's search_path, before any per-file rollback.
        conn.commit()
        purged: list[str] = []
        for row in rows:
            path = Path(str(row["canonical_path"] or "")).resolve()
            try:
                path.relative_to(runtime.store_root)
            except ValueError:
                continue
            if path.suffix.lower() not in STEP_SUFFIXES:
                continue
            if not path.is_file():
                continue
            lock_key = asset_bytes_lock_key(str(row["sha256"]))
            locked = conn.execute("SELECT pg_try_advisory_lock(hashtext(%s)) AS locked", (lock_key,)).fetchone()
            if not locked["locked"]:
                continue
            try:
                if CatalogAssetFiles._purge_locked_file(conn, row, path, job_id=job_id):
                    purged.append(str(row["id"]))
            finally:
                # Ends a skipped re-check or a failed statement; a purged file's row is already committed.
                conn.rollback()
                conn.execute("SELECT pg_advisory_unlock(hashtext(%s))", (lock_key,))
                conn.commit()
        return {"purged": len(purged), "asset_ids": purged}


__all__ = [
    "ASSET_BYTES_MISSING_CODE",
    "CatalogAssetFiles",
    "content_type_for_asset",
    "discover_footprint_name_in_text",
    "discover_symbol_names_in_text",
    "lock_and_check_asset_bytes",
    "purge_excuses_missing_file",
    "raise_if_asset_purged",
]
