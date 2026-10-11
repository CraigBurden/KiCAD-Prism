from __future__ import annotations

import hashlib
import io
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.services.catalog.field_rules import missing_metadata_findings
from app.services.component_catalog_service import catalog_service
from app.services.kicad_library_discovery import discover_library
from app.services.kicad_library_reader import property_value, single_symbol_library, top_level_symbol_blocks
from app.services.local_artifact_store import artifact_store


SUPPORTED_SUFFIXES = {
    ".kicad_sym",
    ".kicad_mod",
    ".step",
    ".stp",
    ".wrl",
    ".lib",
    ".mod",
    ".mdl",
    ".cir",
    ".sub",
    ".subckt",
    ".spice",
}
SPICE_SUFFIXES = {".lib", ".mod", ".mdl", ".cir", ".sub", ".subckt", ".spice"}


def configured_import_roots() -> dict[str, Path]:
    roots: dict[str, Path] = {}
    for index, entry in enumerate(settings.CATALOG_IMPORT_ROOTS.split(","), start=1):
        entry = entry.strip()
        if not entry:
            continue
        name, separator, raw_path = entry.partition("=")
        if not separator:
            raw_path = name
            name = f"root-{index}"
        path = Path(raw_path).expanduser().resolve()
        if path.is_dir():
            roots[name.strip() or f"root-{index}"] = path
    return roots


def resolve_server_import_path(root_name: str, subpath: str) -> Path:
    root = configured_import_roots().get(root_name)
    if root is None:
        raise ValueError("Configured import root not found")
    candidate = (root / subpath).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError("Import path escapes the configured root") from exc
    if not candidate.is_dir():
        raise ValueError("Import directory not found")
    return candidate


def capture_server_snapshot(snapshot_id: str, root_name: str, subpath: str) -> None:
    source = resolve_server_import_path(root_name, subpath)
    for path in sorted(item for item in source.rglob("*") if item.is_file()):
        if path.suffix.lower() not in SUPPORTED_SUFFIXES and path.name not in {"sym-lib-table", "fp-lib-table"}:
            continue
        artifact = artifact_store.put_file(
            path,
            artifact_kind="source",
            max_bytes=settings.CATALOG_IMPORT_MAX_FILE_BYTES,
        )
        artifact_store.add_snapshot_file(snapshot_id, path.relative_to(source).as_posix(), artifact)
    artifact_store.complete_snapshot(snapshot_id)


def _staged_asset(
    *,
    session_id: str,
    artifact: dict[str, Any],
    asset_type: str,
    filename: str,
    target_library: str,
    target_name: str,
) -> dict[str, Any]:
    destination = (
        catalog_service.store_root
        / "imports"
        / session_id
        / "assets"
        / "sha256"
        / str(artifact["sha256"])[:2]
        / str(artifact["sha256"])
        / Path(filename).name
    )
    artifact_store.materialize(str(artifact["sha256"]), destination)
    return {
        "asset_type": asset_type,
        "filename": Path(filename).name,
        "staged_path": str(destination),
        "sha256": str(artifact["sha256"]),
        "size_bytes": int(artifact["size_bytes"]),
        "target_library": target_library,
        "target_name": target_name,
        "source_path": str(artifact["relative_path"]),
    }


def _store_generated(payload: bytes) -> dict[str, Any]:
    artifact = artifact_store.put_stream(io.BytesIO(payload), artifact_kind="source")
    return {
        "sha256": artifact.sha256,
        "size_bytes": artifact.size_bytes,
        "object_path": str(artifact.path),
    }


def _model_finding(model: dict[str, Any]) -> dict[str, str]:
    reference = str(model.get("reference") or "")
    if model.get("status") == "ambiguous":
        return {
            "code": "ambiguous_3d_model",
            "severity": "warning",
            "message": (
                f"Footprint model reference {reference} matches {len(model.get('candidates') or [])} files; "
                "none was imported."
            ),
        }
    return {
        "code": "unresolved_3d_model",
        "severity": "warning",
        "message": f"Footprint model reference could not be resolved: {reference}",
    }


def build_folder_proposals(
    snapshot_id: str,
    session_id: str,
    approved_component_ids: set[str] | None = None,
    footprint_resolutions: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Stage one proposal per discovered symbol, from the discovery result.

    Discovery decides which footprint and models a symbol links to (including
    the reviewer's footprint choices); this only turns its outcome into staged
    assets and findings, so the import cannot disagree with what was reviewed.
    """

    snapshot = artifact_store.get_snapshot(snapshot_id)
    if not snapshot or snapshot.get("status") != "ready":
        raise ValueError("Folder snapshot is not ready")
    files = artifact_store.snapshot_files(snapshot_id)
    files_by_relative = {str(item["relative_path"]).casefold(): item for item in files}
    files_by_name: dict[str, list[dict[str, Any]]] = {}
    for item in files:
        files_by_name.setdefault(Path(str(item["relative_path"])).name.casefold(), []).append(item)

    discovery = discover_library(
        files,
        [{"relative_path": item["relative_path"], "size_bytes": item["size_bytes"]} for item in files],
        footprint_resolutions,
    )

    def snapshot_file(relative_path: str) -> dict[str, Any]:
        return files_by_relative[relative_path.casefold()]

    symbol_blocks: dict[str, list[tuple[str, str]]] = {}
    proposals: list[dict[str, Any]] = []
    for component in discovery["components"]:
        discovery_id = str(component["id"])
        if approved_component_ids is not None and discovery_id not in approved_component_ids:
            continue
        symbol_name = str(component["symbol_name"])
        symbol_path = str(component["symbol"]["relative_path"])
        source = snapshot_file(symbol_path)
        text = Path(str(source["object_path"])).read_text(encoding="utf-8", errors="replace")
        blocks = symbol_blocks.setdefault(symbol_path, top_level_symbol_blocks(text))
        try:
            symbol_payload = single_symbol_library(text, symbol_name, blocks)
        except ValueError:
            continue
        symbol_artifact = _store_generated(symbol_payload)
        library = str(component["library"])
        discovered = component["metadata"]
        properties = dict(discovered["fields"])
        value = str(discovered["value"])
        manufacturer = str(discovered["manufacturer"])
        mpn = str(discovered["manufacturer_part_number"])
        description = str(discovered["description"])
        datasheet = str(discovered["datasheet"])
        findings: list[dict[str, str]] = missing_metadata_findings({
            "value": value,
            "description": description,
            "datasheet": datasheet,
            "manufacturer": manufacturer,
            "manufacturer_part_number": mpn,
        })
        assets = [
            _staged_asset(
                session_id=session_id,
                artifact={**symbol_artifact, "relative_path": symbol_path},
                asset_type="symbol",
                filename=f"{symbol_name}.kicad_sym",
                target_library=library,
                target_name=symbol_name,
            )
        ]
        footprint = component["footprint"]["selected"]
        if footprint:
            assets.append(
                _staged_asset(
                    session_id=session_id,
                    artifact=snapshot_file(str(footprint["relative_path"])),
                    asset_type="footprint",
                    filename=Path(str(footprint["relative_path"])).name,
                    target_library=str(footprint["library"]),
                    target_name=str(footprint["name"]),
                )
            )
            for model in component["models"]:
                if model["status"] != "resolved":
                    findings.append(_model_finding(model))
                    continue
                model_path = str(model["candidates"][0]["relative_path"])
                assets.append(
                    _staged_asset(
                        session_id=session_id,
                        artifact=snapshot_file(model_path),
                        asset_type="3dmodel",
                        filename=Path(model_path).name,
                        target_library=str(footprint["library"]),
                        target_name=Path(model_path).stem,
                    )
                )
        else:
            findings.extend(
                finding for finding in component["findings"]
                if str(finding["code"]).endswith("_footprint_mapping") or finding["code"] == "missing_footprint_property"
            )

        spice_name = Path(property_value(properties, "Spice_Model", "Spice Model")).name.casefold()
        if spice_name:
            for spice in files_by_name.get(spice_name, []):
                if Path(str(spice["relative_path"])).suffix.casefold() in SPICE_SUFFIXES:
                    assets.append(
                        _staged_asset(
                            session_id=session_id,
                            artifact=spice,
                            asset_type="spice",
                            filename=Path(str(spice["relative_path"])).name,
                            target_library=library,
                            target_name=Path(str(spice["relative_path"])).stem,
                        )
                    )
        identity = [manufacturer.casefold(), mpn.casefold()] if manufacturer and mpn else [library, symbol_name, symbol_artifact["sha256"]]
        proposals.append({
            "dedupe_key": hashlib.sha256("\0".join(identity).encode("utf-8")).hexdigest(),
            "reference": symbol_name,
            "metadata": {
                "reference": symbol_name,
                "references": [symbol_name],
                "value": value,
                "footprint": str(component["footprint_reference"]),
                "manufacturer": manufacturer,
                "manufacturer_part_number": mpn,
                "description": description,
                "datasheet": datasheet,
                "fields": properties,
            },
            "assets": assets,
            "provenance": [{
                "source": "folder_snapshot",
                "snapshotId": snapshot_id,
                "manifestSha256": str(snapshot.get("manifest_sha256") or ""),
                "symbolPath": symbol_path,
            }],
            "findings": findings,
        })
    return proposals


def run_folder_import_session(
    session_id: str,
    snapshot_id: str,
    server_source: dict[str, str] | None = None,
    approved_component_ids: set[str] | None = None,
    footprint_resolutions: dict[str, str] | None = None,
) -> None:
    try:
        catalog_service.update_project_import_session(session_id, status="scanning")
        if server_source:
            capture_server_snapshot(snapshot_id, server_source["root_name"], server_source.get("subpath", ""))
        proposals = build_folder_proposals(
            snapshot_id,
            session_id,
            approved_component_ids,
            footprint_resolutions,
        )
        catalog_service.stage_project_import_proposals(session_id, proposals)
    except Exception as exc:
        catalog_service.update_project_import_session(session_id, status="failed", error_message=str(exc))
        raise
