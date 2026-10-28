"""Released revisions the remote provider may serve (issue #698, D4).

The panel lists them and passes the chosen one as ``revision`` to the
component detail, part manifest and inline bundle. Which revisions qualify is
decided once, by ``CatalogPlacement.released_revisions``: ever released and
not archived since, never a draft.
"""

from __future__ import annotations

from typing import Any

from app.core.errors import NotFound
from app.services.catalog.placement import CatalogPlacement
from app.services.component_catalog_service import catalog_service


def released_revisions(component_id: str) -> list[dict[str, Any]]:
    """``[{revision_id, version, released_at}]``, newest first."""
    catalog_service.initialize()
    with catalog_service.connection() as conn:
        revisions = CatalogPlacement.released_revisions(conn, component_id)
        conn.rollback()
    return revisions


def released_component(component_id: str, revision_id: str = "", representation_id: str = "") -> dict[str, Any] | None:
    """The component as its released revision ``revision_id`` (default: the current one), or ``None``.

    ``None`` when the component itself is not placeable; a revision that is
    not one of ``released_revisions`` is a typed 404 ``revision_not_released``.
    """
    current = catalog_service.get_component(
        component_id, include_inactive=False, released_only=True, representation_id=representation_id
    )
    if not current or not revision_id or revision_id == current.get("revision_id"):
        return current
    if revision_id not in {item["revision_id"] for item in released_revisions(component_id)}:
        raise NotFound("The component has no released revision with this id", code="revision_not_released")
    return catalog_service.get_component_revision(component_id, revision_id)


__all__ = ["released_component", "released_revisions"]
