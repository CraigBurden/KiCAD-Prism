"""Catalog parts as the harness outputs name them (§16.7).

A reference is what the bundle or document spells, ``<componentId>`` or
``<componentId>@<revisionId>``; without a revision the newest released one is
read, as the build does (§16.1). A part the catalog cannot resolve is None.
"""

from __future__ import annotations

from typing import Any

from app.system_builder import parts as system_parts
from app.system_builder.harness_outputs.model import Part


def lookup(reference: str) -> Part | None:
    return _lookup(reference, kinds=("part",))


def lookup_entry(reference: str) -> Part | None:
    """A catalog part or a published system (an entry, §12), as the ICD names occurrences."""

    return _lookup(reference, kinds=None)


def _lookup(reference: str, *, kinds: tuple[str, ...] | None) -> Part | None:
    component_id, _, revision_id = reference.partition("@")
    if not component_id:
        return None
    from app.system_builder.publishing import CatalogGateway

    with CatalogGateway().connection() as conn:
        component = conn.execute(
            "SELECT is_active, COALESCE(kind, 'part') AS kind FROM components WHERE id = %s",
            (component_id,),
        ).fetchone()
        if component is None or not bool(component["is_active"]) or (kinds is not None and str(component["kind"]) not in kinds):
            return None
        revision = system_parts._revision(conn, component_id, revision_id or None)
    if revision is None:
        return None
    return part_of(reference, revision)


def part_of(reference: str, revision: dict[str, Any]) -> Part:
    def text(key: str) -> str:
        return str(revision.get(key) or "").strip()

    return Part(
        reference=reference,
        name=text("value") or text("name"),
        mpn=text("mpn"),
        manufacturer=text("manufacturer"),
        description=text("description"),
    )
