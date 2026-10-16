"""The one place a Wave 3 consumer decides between the bundle and its legacy path.

A consumer calls :func:`bundle_read` with its switch name (ADR §8) and the
member paths it needs. The answer is a :class:`BundleRead` only when the
switch is ``bundle`` and every member has a final answer (bundle-format.md
§3.3). In every other case it is ``None`` and the consumer serves its legacy
result for this request:

- the switch is ``legacy``;
- a member is not ready yet (``pending`` or ``unavailable``): the
  ``design_bundle`` job is queued, deduplicated on the bundle key, so a later
  request reads the bundle;
- a member failed, or the bundle could not be opened: logged, then legacy.

This is the rollout policy, decided for every consumer: the UI stays identical
while bundles fill in. Wave 4 deletes the legacy paths and replaces the
fallback with a pending state.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from app.core.config import settings
from app.services.design_bundle import reader
from app.services.design_bundle.manifest import Readiness

logger = logging.getLogger(__name__)

#: ADR §8's consumer switches, by the suffix of ``PRISM_DESIGN_SOURCE_<CONSUMER>``.
CONSUMERS = (
    "SEMANTIC_INDEX",
    "DESIGN_COMPARISON",
    "RELEASE_STUDIO",
    "SYSTEM_BUILDER",
    "VIEWER_3D",
    "PROJECT_METADATA",
    "CATALOG_IMPORT",
)


def source(consumer: str) -> str:
    """``legacy`` or ``bundle``: the consumer's switch."""

    if consumer not in CONSUMERS:
        raise ValueError(f"unknown design-source consumer {consumer!r}")
    return getattr(settings, f"PRISM_DESIGN_SOURCE_{consumer}")


@dataclass
class BundleRead:
    """The opened revision and every requested member's final answer."""

    opened: reader.OpenedRevision
    states: Mapping[str, Readiness]

    def ready(self, path: str) -> bool:
        return self.states[path].state == "ready"

    def json(self, path: str) -> Any:
        """A ready member's parsed JSON (verified, bundle-format.md §9)."""

        return self.opened.read_json(path)

    def bytes(self, path: str) -> bytes:
        return self.opened.read(path)

    def extract(self, paths: Iterable[str]) -> Path:
        """Ready members as files in the verified version directory (§8)."""

        return self.opened.extract(paths)


def bundle_read(
    consumer: str,
    project_id: str,
    commit: str | None,
    paths: Iterable[str],
    *,
    requested_by: str = "",
) -> BundleRead | None:
    """The bundle's answer for ``paths``, or ``None`` to serve the legacy path (module docs).

    ``skipped`` and ``not-applicable`` are final answers the consumer handles
    itself (e.g. a project without a board); only ``pending``, ``unavailable``
    and ``failed`` fall back.
    """

    if source(consumer) != "bundle":
        return None
    wanted = list(paths)
    try:
        opened = reader.open_revision(project_id, commit, queue=True, requested_by=requested_by)
    except Exception:  # noqa: BLE001 - any bundle-side fault must not break the legacy path
        logger.exception("design bundle: %s could not open %s@%s; serving legacy", consumer, project_id, commit)
        return None
    if opened.absent:
        return None
    states = opened.readiness(wanted)
    waiting = [path for path, answer in states.items() if answer.state in ("pending", "unavailable")]
    if waiting:
        logger.info("design bundle: %s waits for %s of %s; serving legacy", consumer, ", ".join(waiting), project_id)
        return None
    failed = {path: answer.detail for path, answer in states.items() if answer.state == "failed"}
    if failed:
        logger.warning("design bundle: %s members failed for %s: %s; serving legacy", consumer, project_id, failed)
        return None
    return BundleRead(opened, states)
