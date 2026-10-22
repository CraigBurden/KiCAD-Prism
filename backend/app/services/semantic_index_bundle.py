"""The semantic index served from the design bundle (WP-C1, ADR §8 ``SEMANTIC_INDEX``).

``semantic_index_service`` answers every request from the bundle member
``projections/semantic-index.json`` (``prism.semantic_index.a2``;
native/contracts/prism/field-maps/semantic-index.md) instead of building and
storing its own index. A request without a commit reads the checkout's HEAD
(``design_bundle.reader``). This module holds the member's mapping.

``bundle_read`` raises ``DesignDataPending`` while the member builds (it queues
the job) and ``DesignDataFailed`` when it cannot be built; a final non-member
(``not-applicable``, e.g. no root schematic) is likewise the consumer's to
handle. A stored bundle is never rebuilt: a stage only moves from ``pending``
to final (ADR §5).
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any, Self

if TYPE_CHECKING:  # annotations only; the consumer is imported lazily
    from app.services.design_bundle.consumer import BundleRead

MEMBER = "projections/semantic-index.json"


def ready(project_id: str, resolved_commit: str) -> BundleRead:
    """The opened bundle for a resolved commit; raises pending/failed (``consumer``)."""

    from app.services.design_bundle import consumer

    return consumer.bundle_read("SEMANTIC_INDEX", project_id, resolved_commit, [MEMBER])


class ArtifactFile(tuple):
    """``(path, revision_key)`` and the generator the identity route's ETag names (ADR G9).

    A tuple so callers keep unpacking ``path, revision_key``. ``generator`` is
    the bundle's generator digest for the member: one revision must not be
    named by two generators. ``headers`` are the response headers the read
    adds (the dirty working-tree notice).
    """

    generator: str
    headers: dict[str, str]

    def __new__(
        cls, path: Path, revision_key: str, generator: str, headers: dict[str, str] | None = None
    ) -> Self:
        result = super().__new__(cls, (path, revision_key))
        result.generator = generator
        result.headers = dict(headers or {})
        return result


def artifact(read: BundleRead) -> ArtifactFile:
    """The member's file in the verified unpacked cache, keyed by the design revision key."""

    opened = read.opened
    return ArtifactFile(
        read.extract([MEMBER]) / MEMBER,
        str(opened.revision_key),
        opened.generator_digest,
        read.response_headers(),
    )


def status(read: BundleRead, project_id: str, generator: dict[str, Any]) -> dict[str, Any]:
    """The status route's answer for a ready member.

    ``sourceRevisionKey`` is the design revision key (field map D2), not today's
    32-hex semantic key. The member carries no generator record, so
    ``generator`` keeps today's envelope: ``cacheTag`` is the bundle's generator
    digest and ``kicadMonkeyVersion`` is that generator's ``engine_version``,
    the parser engine that produced the member (it used to be the Python
    ``kicad-monkey`` distribution's version).
    """

    opened = read.opened
    manifest = opened.archive.manifest if opened.archive is not None else {}
    engine_version = str((manifest.get("generator") or {}).get("engine_version") or "")
    return {
        "schema": "prism.semantic_index_status_a0",
        "projectId": project_id,
        "sourceRevisionKey": str(opened.revision_key),
        "commit": opened.commit,
        "available": read.ready(MEMBER),
        "generator": {
            **generator,
            "cacheTag": opened.generator_digest,
            "kicadMonkeyVersion": engine_version,
        },
    }
