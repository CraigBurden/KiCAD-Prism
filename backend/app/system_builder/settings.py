"""The document limits the operations check, from deployment settings.

``PRISM_SYSTEM_*`` (``app.core.system_builder_config``) raises one limit
without a code change; :func:`limits` reads the current values on every call so
a test or a reloaded environment takes effect immediately.
"""

from __future__ import annotations

from app.core.config import settings
from app.system_builder.integrity import Limits


def limits() -> Limits:
    """The current ``integrity.Limits`` (docs/system-builder/CONTRACTS.md §7)."""

    return Limits(
        document_bytes=settings.PRISM_SYSTEM_MAX_DOCUMENT_BYTES,
        occurrences=settings.PRISM_SYSTEM_MAX_OCCURRENCES,
        connections=settings.PRISM_SYSTEM_MAX_CONNECTIONS,
        harnesses=settings.PRISM_SYSTEM_MAX_HARNESSES,
        ends_per_harness=settings.PRISM_SYSTEM_MAX_ENDS_PER_HARNESS,
        wires=settings.PRISM_SYSTEM_MAX_WIRES,
        ops_per_request=settings.PRISM_SYSTEM_MAX_OPS_PER_REQUEST,
    )
