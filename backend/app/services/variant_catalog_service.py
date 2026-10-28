"""The design-variant catalog from a project revision's design bundle (VAR-07).

A revision's catalog is the bundle's ``projections/semantic-index.json``
member: its ``assembly.catalog`` is the ordered catalog and its own diagnostics
are the catalog's diagnostics. The member is produced by ``prism-kicad`` from
the parsed design, so this module never reads KiCad design text (WP-X).

The catalog's order and fold rules are frozen in the design-variant contract
packet v1.0 section 2.1: the project registry first, then board-header names,
then schematic instance names in hierarchy walk order, then footprint variant
names. Board-side names fold case-insensitively into the first matching entry,
with a ``catalog-name-case-mismatch`` diagnostic; schematic names stay distinct
because KiCad's schematic variant names are case-sensitive. A microstructure
that cannot be read keeps its ``source-unparseable`` diagnostic while the rest
of the catalog still answers.

The API consumer (``project_variants``), the semantic index and Release Studio
all read this bundle member. A member that is still building raises
``DesignDataPending`` and one that failed ``DesignDataFailed`` from
``design_bundle.errors``; there is no source-text fallback.
"""

from __future__ import annotations

from typing import Any, Optional

from app.services import project_revision
from app.services.variant_catalog_cache import CatalogResultCache

SCHEMA = "prism.project_variants_a0"

#: The shaped catalog, keyed by bundle key + member SHA-256 + project directory.
#: A member's bytes are immutable and its SHA-256 names them, so an entry can
#: only be reused for exactly the bytes it was built from. The project directory
#: is part of the answer (diagnostic paths are project-relative), so it is part
#: of the key too. The cache is bounded and shared by the API and Release
#: Studio; see ``variant_catalog_cache`` for its limits and copy semantics.
_CATALOG_CACHE = CatalogResultCache()

#: The semantic index member a bundled catalog answers from (bundle-format.md §2).
SEMANTIC_INDEX_MEMBER = "projections/semantic-index.json"

#: Today's catalog-diagnostic keys, in the order the bundle's producer inserts
#: them, so a bundle-derived diagnostic serializes with the same key order.
_CATALOG_DIAGNOSTIC_KEYS = ("code", "severity", "source", "path", "message", "detail")


def _project_relative(path: str, project_dir: str) -> str:
    """A bundle ``RepoPath`` in today's project-relative spelling (D9).

    The bundle spells paths relative to its source root (the repository root,
    conventions §8); today's catalog spells them relative to the project
    directory. A path outside the project directory keeps today's bare-name
    fallback (``_relative``).
    """

    if project_dir and path.startswith(project_dir + "/"):
        return path[len(project_dir) + 1:]
    if project_dir:
        return path.rsplit("/", 1)[-1]
    return path


def _catalog_diagnostic(diagnostic: Any, project_dir: str) -> dict[str, Any]:
    """One catalog diagnostic from the bundle, in today's key order and paths."""

    shaped = {
        key: diagnostic[key]
        for key in _CATALOG_DIAGNOSTIC_KEYS
        if key in diagnostic
    }
    if "path" in shaped:
        shaped["path"] = _project_relative(str(shaped["path"]), project_dir)
    return shaped


def _catalog_body_from_assembly(assembly: Any, project_dir: str) -> dict[str, Any]:
    """Today's catalog body (``variants`` + ``diagnostics``) from an ``assembly``.

    ``assembly`` is the bundle member's ``assembly`` block (ADR §9.6): its
    ``catalog`` is today's ``variants`` in catalog order, and the catalog's own
    diagnostics are the members of ``assembly.diagnostics`` that carry a
    ``source`` — only the catalog builder writes that key, so the resolver's
    diagnostics (``source-state-mismatch`` and friends) stay out. Values are
    copied out so the caller never shares or mutates the parsed member.
    """

    variants = [
        {
            "name": entry["name"],
            "description": entry["description"],
            "sources": list(entry["sources"]),
        }
        for entry in (assembly.get("catalog") or [])
    ]
    diagnostics = [
        _catalog_diagnostic(diagnostic, project_dir)
        for diagnostic in (assembly.get("diagnostics") or [])
        if "source" in diagnostic
    ]
    return {"variants": variants, "diagnostics": diagnostics}


def _cache_key(read: Any) -> Optional[tuple[str, str]]:
    """``(bundle key, member SHA-256)`` for a ready read, or ``None`` when unknown.

    Test doubles and a revision served outside a stored archive have no bundle
    key; they simply never touch the cache.
    """

    opened = getattr(read, "opened", None)
    bundle_key = getattr(opened, "bundle_key", None)
    archive = getattr(opened, "archive", None)
    member = archive.member(SEMANTIC_INDEX_MEMBER) if archive is not None else None
    if not bundle_key or member is None:
        return None
    return (str(bundle_key), str(member["sha256"]))


def _catalog_body_from_bundle(project: Any, resolved_commit: str, read: Any = None) -> dict[str, Any]:
    """The bundle's catalog body for a commit.

    ``bundle_read`` raises ``DesignDataPending`` while the member builds (it
    queues the job) and ``DesignDataFailed`` when it cannot be built; a final
    non-member (a project with no semantic index) has no variants. ``read`` is
    an already-opened ``BundleRead``, so a caller that needed the same revision
    for its response headers opens the bundle once.

    A ready member is inflated, hashed and parsed once per (bundle key, member
    SHA-256, project directory): later calls are served from the bounded
    cache in ``variant_catalog_cache``.
    """

    from app.services.design_bundle.consumer import bundle_read

    # Bundles are keyed by project id; a caller with only a checkout path
    # has no bundle to read.
    project_id = str(getattr(project, "id", "") or "")
    if not project_id:
        raise ValueError("A project id is required to read the variant catalog")
    if read is None:
        read = bundle_read(
            "SEMANTIC_INDEX",
            project_id,
            resolved_commit,
            [SEMANTIC_INDEX_MEMBER],
        )
    if not read.ready(SEMANTIC_INDEX_MEMBER):
        return {"variants": [], "diagnostics": []}
    project_dir = project_revision.locate(project).relative_path
    key = _cache_key(read)
    if key is not None:
        cached = _CATALOG_CACHE.get((*key, project_dir))
        if cached is not None:
            return cached
    try:
        document = read.json(SEMANTIC_INDEX_MEMBER)
    except Exception as error:  # noqa: BLE001 - a corrupt member is a typed failure
        from app.services.design_bundle.errors import DesignDataFailed

        raise DesignDataFailed([SEMANTIC_INDEX_MEMBER], f"the member could not be read: {error}") from error
    assembly = document.get("assembly") if isinstance(document, dict) else None
    if not isinstance(assembly, dict):
        return {"variants": [], "diagnostics": []}
    body = _catalog_body_from_assembly(assembly, project_dir)
    if key is not None:
        _CATALOG_CACHE.put((*key, project_dir), body)
    return body


def reset_variant_catalog_cache() -> None:
    """Drop every cached catalog result (tests, and an explicit operator reset)."""

    _CATALOG_CACHE.clear()


def variant_catalog_cache_stats() -> dict[str, int]:
    """Entries, accounted bytes, and hit/miss counters of the catalog cache."""

    return _CATALOG_CACHE.stats()


def discover_variant_catalog(project: Any, commit: Optional[str] = None, read: Any = None) -> dict[str, Any]:
    """Discover the variant catalog for one project revision.

    ``project`` must already have passed the caller's role check; this service
    performs no authorization. ``commit`` is any ref accepted by the design
    bundle, resolved to a SHA here, or ``None`` for the checkout's ``HEAD``.
    ``read`` is an already-opened ``BundleRead`` for the same revision (the API
    opens it for its response headers); it also supplies the resolved commit.

    The bundle member is the only source (ADR §9.7 R1 and X). A member that is
    still building raises the typed pending answer; there is no source scan.
    """

    location = project_revision.locate(project)
    opened_commit = getattr(getattr(read, "opened", None), "commit", None) if read is not None else None
    resolved_commit = (
        str(opened_commit)
        if opened_commit
        else project_revision.resolve_commit(location, commit or "HEAD")
    )
    return {
        "schema": SCHEMA,
        "projectId": str(getattr(project, "id", "")),
        "commit": resolved_commit,
        "sourceRevisionKey": resolved_commit,
        **_catalog_body_from_bundle(project, resolved_commit, read),
    }
