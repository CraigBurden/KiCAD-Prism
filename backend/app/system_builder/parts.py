"""The catalog parts a system build reads (CONTRACTS.md §8.10).

A body occurrence places a mechanical catalog part and its body connectors place
connector parts on it; a harness names housing, contact, cable and covering
parts (§16.2), which also carry their harness attributes and, for a housing,
the parts it mates with. ``prism-kicad system build --parts`` receives those parts
as one ``prism.system_parts.a0`` document: each part's resolved revision, name
and MPN, its symbol and footprint staged beside the document, and its converted
model's box in the part's frame. The reference is exactly what the document
spells, ``<componentId>`` or ``<componentId>@<revisionId>``; a reference the
catalog cannot resolve is left out.

The document's canonical bytes are also a system bundle key input (§8.1), so
:func:`digest` hashes exactly the bytes the job writes.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

from app.services.catalog import mates, models
from app.services.catalog.harness_fields import harness_facts
from app.services.catalog.normalization import json_loads
from app.services.catalog.workflow_policy import normalize_workflow_stage
from app.services.design_bundle import schemas
from app.system_builder import members as member_view

SCHEMA = "prism.system_parts.a0"
RELEASED = "released"

SYMBOL_SUFFIX = ".kicad_sym"
FOOTPRINT_SUFFIX = ".kicad_mod"


@dataclass(frozen=True)
class SymbolAsset:
    """A revision's symbol library, staged beside the parts document."""

    canonical_path: Path
    sha256: str
    name: str


@dataclass(frozen=True)
class FootprintAsset:
    """A revision's footprint, staged beside the parts document."""

    canonical_path: Path
    sha256: str


@dataclass(frozen=True)
class ModelAsset:
    """A revision's converted model, its alignment applied; bounds in millimetres."""

    glb_key: str
    step_sha256: str
    bounds_min_mm: tuple[float, float, float]
    bounds_max_mm: tuple[float, float, float]


@dataclass(frozen=True)
class ResolvedPart:
    """One catalog part as the build reads it."""

    component_id: str
    revision_id: str
    name: str
    mpn: str | None = None
    symbol: SymbolAsset | None = None
    footprint: FootprintAsset | None = None
    model: ModelAsset | None = None
    harness: Mapping[str, Any] | None = None
    mates_with: tuple[tuple[str, str], ...] = ()


# ------------------------------------------------------------- references


def _reference(component_id: str, revision_id: str | None) -> str:
    return component_id if not revision_id else f"{component_id}@{revision_id}"


def _part_ref(value: Mapping[str, Any] | None) -> tuple[str, str | None] | None:
    source = value or {}
    component_id = str(source.get("componentId") or "")
    if not component_id:
        return None
    revision_id = str(source.get("revisionId") or "") or None
    return component_id, revision_id


def references(document: Mapping[str, Any]) -> list[tuple[str, str, str | None]]:
    """Every distinct part the document names, as ``(ref, componentId, revisionId)``.

    Each body occurrence's source, each body connector's ``part``, and each
    harness's housings, contacts, cable parts and covering parts, keyed by the
    reference exactly as the document spells it; sorted by ``ref``.
    """

    found: dict[str, tuple[str, str | None]] = {}
    for occurrence in document.get("occurrences") or []:
        source = occurrence.get("source") or {}
        if source.get("kind") != "body":
            continue
        part = _part_ref(source)
        if part is not None:
            found.setdefault(_reference(*part), part)
    named: list[Mapping[str, Any] | None] = [
        connector.get("part") for connector in document.get("bodyConnectors") or []
    ]
    for harness in document.get("harnesses") or []:
        for end in harness.get("ends") or []:
            named.append(end.get("housing"))
            named.extend((end.get("contacts") or {}).values())
        named.extend(item.get("part") for item in harness.get("cables") or [])
        named.extend(item.get("part") for item in harness.get("coverings") or [])
    for value in named:
        part = _part_ref(value)
        if part is not None:
            found.setdefault(_reference(*part), part)
    return [(ref, *found[ref]) for ref in sorted(found)]


# ------------------------------------------------------------- alignment


def aligned_bounds(
    bounds: Mapping[str, Any],
    alignment: Mapping[str, Any] | None = None,
) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    """A model box's min/max after ``alignment``, in millimetres.

    ``bounds`` is the converted GLB's ``{minMm, maxMm}``; the alignment is the
    part's ``alignment_matrix`` (column-major) as :mod:`app.services.catalog.models`
    defines it.
    """

    low = [float(value) for value in (bounds.get("minMm") or [0.0, 0.0, 0.0])]
    high = [float(value) for value in (bounds.get("maxMm") or [0.0, 0.0, 0.0])]
    matrix = models.alignment_matrix(alignment or models.IDENTITY)
    points = []
    for index in range(8):
        x = high[0] if index & 1 else low[0]
        y = high[1] if index & 2 else low[1]
        z = high[2] if index & 4 else low[2]
        points.append((
            matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
            matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
            matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
        ))
    return (
        tuple(min(point[axis] for point in points) for axis in range(3)),
        tuple(max(point[axis] for point in points) for axis in range(3)),
    )


# --------------------------------------------------------------- catalog


def _revision(conn: Any, component_id: str, revision_id: str | None) -> dict[str, Any] | None:
    """The named revision of this component, else its newest released one."""

    if revision_id:
        row = conn.execute(
            "SELECT * FROM component_revisions WHERE id = %s AND component_id = %s",
            (revision_id, component_id),
        ).fetchone()
        return dict(row) if row is not None else None
    rows = conn.execute(
        "SELECT * FROM component_revisions WHERE component_id = %s"
        " ORDER BY created_at DESC, id DESC",
        (component_id,),
    ).fetchall()
    for row in rows:
        if normalize_workflow_stage(str(row["release_status"] or "")) == RELEASED:
            return dict(row)
    return None


def _asset_rows(conn: Any, revision_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT a.id, a.asset_type, a.name, a.canonical_path, a.sha256, a.target_name
          FROM revision_assets ra
          JOIN assets a ON a.id = ra.asset_id
         WHERE ra.revision_id = %s AND a.asset_type IN ('symbol', 'footprint')
         ORDER BY a.id
        """,
        (revision_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def _first_asset(rows: Sequence[Mapping[str, Any]], asset_type: str) -> Mapping[str, Any] | None:
    for row in rows:
        if str(row["asset_type"]) != asset_type:
            continue
        if not Path(str(row["canonical_path"])).is_file():
            continue
        return row
    return None


def _model(conn: Any, component_id: str, revision_id: str) -> ModelAsset | None:
    steps = models.step_assets(conn, component_id, revision_id)
    if not steps:
        return None
    step = steps[0]
    key = models.glb_key(str(step["sha256"]), models.converter_id())
    glb = models.cached(conn, [key]).get(key)
    if glb is None:
        return None
    alignment = models.alignments(conn, component_id).get(str(step["id"])) or models.IDENTITY
    low, high = aligned_bounds(json.loads(str(glb["bounds_json"])), alignment)
    return ModelAsset(
        glb_key=str(glb["key"]),
        step_sha256=str(step["sha256"]),
        bounds_min_mm=low,
        bounds_max_mm=high,
    )


def catalog_lookup(component_id: str, revision_id: str | None) -> ResolvedPart | None:
    """One part from the production catalog, or None when it cannot be resolved.

    The component must exist, be active and be a ``part``. A named revision must
    be one of its revisions; without one, the newest released revision is used.
    """

    from app.system_builder.publishing import CatalogGateway

    with CatalogGateway().connection() as conn:
        component = conn.execute(
            "SELECT id, is_active, COALESCE(kind, 'part') AS kind FROM components WHERE id = %s",
            (component_id,),
        ).fetchone()
        if component is None:
            return None
        if not bool(component["is_active"]) or str(component["kind"]) != "part":
            return None
        revision = _revision(conn, component_id, revision_id)
        if revision is None:
            return None
        rows = _asset_rows(conn, str(revision["id"]))
        symbol_row = _first_asset(rows, "symbol")
        footprint_row = _first_asset(rows, "footprint")
        model = _model(conn, component_id, str(revision["id"]))
        harness = harness_facts(json_loads(revision.get("extra_fields"), {}))
        mates_with: tuple[tuple[str, str], ...] = ()
        if harness is not None and harness.get("role") == "housing":
            mates_with = tuple(
                (str(item["componentId"]), str(item["mpn"])) for item in mates.list_mates(conn, component_id)
            )

    mpn = str(revision["mpn"] or "").strip() or None
    symbol = None
    if symbol_row is not None:
        symbol = SymbolAsset(
            canonical_path=Path(str(symbol_row["canonical_path"])),
            sha256=str(symbol_row["sha256"]),
            name=str(symbol_row["target_name"] or symbol_row["name"]),
        )
    footprint = None
    if footprint_row is not None:
        footprint = FootprintAsset(
            canonical_path=Path(str(footprint_row["canonical_path"])),
            sha256=str(footprint_row["sha256"]),
        )
    return ResolvedPart(
        component_id=str(revision["component_id"]),
        revision_id=str(revision["id"]),
        name=str(revision["value"] or revision["name"]),
        mpn=mpn,
        symbol=symbol,
        footprint=footprint,
        model=model,
        harness=harness,
        mates_with=mates_with,
    )


# ----------------------------------------------------------------- input


def _nm(value_mm: float) -> int:
    return int(round(value_mm * 1_000_000))


def _vector_nm(values: Sequence[float]) -> dict[str, int]:
    return {"xNm": _nm(values[0]), "yNm": _nm(values[1]), "zNm": _nm(values[2])}


def _staged(sha256: str, suffix: str) -> Path:
    return Path("parts") / f"{sha256}{suffix}"


def build_input(
    document: Mapping[str, Any],
    staging_dir: Path | None = None,
    *,
    lookup: Callable[[str, str | None], ResolvedPart | None] | None = None,
) -> tuple[dict[str, Any], list[tuple[Path, Path]]]:
    """The ``prism.system_parts.a0`` document and the files to stage beside it.

    ``staging_dir`` is the directory the caller will write the document into; the
    document itself never names an absolute path, so only the returned staged
    paths are relative to it. The filesystem is read only to check that a
    catalog asset's file exists. ``lookup`` defaults to the production catalog;
    resolving it here (not as a default argument) lets a caller or test replace
    ``catalog_lookup``.
    """

    resolve_part = lookup or catalog_lookup
    parts: list[dict[str, Any]] = []
    files: list[tuple[Path, Path]] = []
    for ref, component_id, revision_id in references(document):
        part = resolve_part(component_id, revision_id)
        if part is None:
            continue
        entry: dict[str, Any] = {
            "ref": ref,
            "componentId": part.component_id,
            "revisionId": part.revision_id,
            "name": part.name,
        }
        if part.mpn:
            entry["mpn"] = part.mpn
        if part.symbol is not None and part.symbol.canonical_path.is_file():
            staged = _staged(part.symbol.sha256, SYMBOL_SUFFIX)
            entry["symbol"] = {
                "path": staged.as_posix(),
                "sha256": part.symbol.sha256,
                "name": part.symbol.name,
            }
            files.append((part.symbol.canonical_path, staged))
        if part.footprint is not None and part.footprint.canonical_path.is_file():
            staged = _staged(part.footprint.sha256, FOOTPRINT_SUFFIX)
            entry["footprint"] = {"path": staged.as_posix(), "sha256": part.footprint.sha256}
            files.append((part.footprint.canonical_path, staged))
        if part.model is not None:
            entry["model"] = {
                "glbKey": part.model.glb_key,
                "stepSha256": part.model.step_sha256,
                "boundsMin": _vector_nm(part.model.bounds_min_mm),
                "boundsMax": _vector_nm(part.model.bounds_max_mm),
            }
        if part.harness is not None:
            entry["harness"] = dict(part.harness)
        if part.mates_with:
            entry["matesWith"] = [
                {"componentId": component, **({"mpn": mpn} if mpn else {})} for component, mpn in part.mates_with
            ]
        parts.append(entry)
    result = {"schema": SCHEMA, "parts": parts}
    schemas.validate(result, SCHEMA)
    return result, files


def stage(staging_dir: Path, files: Iterable[tuple[Path, Path]]) -> None:
    """Copy each ``(source, staged-relative-path)`` into ``staging_dir``."""

    for source, relative in files:
        destination = Path(staging_dir) / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)


def digest(parts_document: Mapping[str, Any]) -> str:
    """SHA-256 of the document's canonical bytes, exactly as the job writes them."""

    return hashlib.sha256(member_view.canonical_bytes(parts_document)).hexdigest()
