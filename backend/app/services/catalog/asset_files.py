"""Filesystem paths and immutable catalog asset writes.

KiCad text is read by ``app.services.kicad_library_reader``; the symbol helpers
here keep the catalog's historical names for it.
"""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Any

from app.services import kicad_library_reader
from app.services.catalog.normalization import sanitize_name, sha256_bytes
from app.services.catalog.runtime import CatalogRuntime


STEP_SUFFIXES = frozenset({".step", ".stp"})


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
    def purge_superseded_step_files(conn: Any, runtime: CatalogRuntime) -> dict[str, Any]:
        """Purge obsolete STEP bytes while preserving immutable revision evidence.

        The asset row, hash, revision link, and audit history remain intact. A file
        is removed only when a newer current revision for that component has a
        different 3D model and no revision linking the asset, in any component, is
        protected. A revision is protected while it is its component's current or
        released revision, or once it has ever been released, so released STEP
        evidence is never deleted. Purging a never-released draft STEP still
        makes audit-chain verification report ``asset_content_mismatch``.
        """
        rows = conn.execute(
            """
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
                WHERE revision.id = component.current_revision_id
                   OR revision.id = component.released_revision_id
                   OR revision.release_status = 'released'
                   OR EXISTS (
                       SELECT 1 FROM component_release_records record
                       WHERE record.revision_id = revision.id
                   )
            )
            SELECT DISTINCT asset.id, asset.canonical_path
            FROM superseded_models superseded
            JOIN assets asset ON asset.id = superseded.asset_id
            LEFT JOIN protected_models protected ON protected.asset_id = superseded.asset_id
            WHERE protected.asset_id IS NULL
              AND (
                lower(asset.canonical_path) LIKE %s
                OR lower(asset.canonical_path) LIKE %s
              )
            """,
            ("%.step", "%.stp"),
        ).fetchall()
        purged: list[str] = []
        for row in rows:
            path = Path(str(row["canonical_path"] or "")).resolve()
            try:
                path.relative_to(runtime.store_root)
            except ValueError:
                continue
            if path.suffix.lower() not in STEP_SUFFIXES:
                continue
            if path.is_file():
                path.unlink()
                purged.append(str(row["id"]))
        return {"purged": len(purged), "asset_ids": purged}


__all__ = [
    "CatalogAssetFiles",
    "content_type_for_asset",
    "discover_footprint_name_in_text",
    "discover_symbol_names_in_text",
]
