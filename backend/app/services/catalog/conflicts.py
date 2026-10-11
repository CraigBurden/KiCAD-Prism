"""Typed catalog write conflicts.

The status is classified by this type, not by scanning the human message. The
app's domain-error handler (``app.core.errors``) renders the one flat body
``{"detail": message, "code": code}``. Callers may change wording without
changing the machine code or status.

A component's ETag is ``"component:<component id>:<revision id>"``
(``component_etag``); single-component writes take it as ``If-Match``. A write
against an older revision is 412 ``revision_conflict`` (with the current ETag
when the raise site knows it). Referential and manifest conflicts stay 409.
"""

from __future__ import annotations

from typing import Mapping

from app.core import errors, preconditions


REVISION_CONFLICT_CODE = "revision_conflict"
ASSET_REFERENCED_CODE = "asset_referenced"
MANIFEST_CONFLICT_CODE = "manifest_conflict"

DEFAULT_REVISION_CONFLICT_MESSAGE = (
    "Component revision conflict: refresh the component before saving"
)
DEFAULT_ASSET_REFERENCED_MESSAGE = (
    "Asset is referenced by a representation; remove or reassign it first"
)
DEFAULT_MANIFEST_CONFLICT_MESSAGE = (
    "Component manifest conflict: refresh the component before changing workflow"
)


def component_etag(component_id: str, revision_id: str) -> str:
    return preconditions.etag("component", component_id, revision_id)


class CatalogConflict(errors.Conflict, ValueError):
    """A catalog write that must not be applied.

    ``revision_conflict`` (the default) is a stale revision: 412, like every
    guarded write. The referential and manifest codes are 409.
    """

    def __init__(
        self,
        message: str = DEFAULT_REVISION_CONFLICT_MESSAGE,
        *,
        code: str = REVISION_CONFLICT_CODE,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        status = errors.StaleVersion.status_code if code == REVISION_CONFLICT_CODE else None
        super().__init__(message, code=code, status_code=status, headers=headers)


def revision_conflict(
    message: str = DEFAULT_REVISION_CONFLICT_MESSAGE, *, component_id: str = "", current_revision_id: str = "",
) -> CatalogConflict:
    """412 ``revision_conflict``, with the current component ETag when the raise site knows it."""
    headers = {"ETag": component_etag(component_id, current_revision_id)} if component_id and current_revision_id else None
    return CatalogConflict(message, code=REVISION_CONFLICT_CODE, headers=headers)


def asset_referenced_conflict(
    message: str = DEFAULT_ASSET_REFERENCED_MESSAGE,
) -> CatalogConflict:
    return CatalogConflict(message, code=ASSET_REFERENCED_CODE)


def manifest_conflict(message: str = DEFAULT_MANIFEST_CONFLICT_MESSAGE) -> CatalogConflict:
    return CatalogConflict(message, code=MANIFEST_CONFLICT_CODE)


__all__ = [
    "ASSET_REFERENCED_CODE",
    "CatalogConflict",
    "DEFAULT_ASSET_REFERENCED_MESSAGE",
    "DEFAULT_MANIFEST_CONFLICT_MESSAGE",
    "DEFAULT_REVISION_CONFLICT_MESSAGE",
    "MANIFEST_CONFLICT_CODE",
    "REVISION_CONFLICT_CODE",
    "asset_referenced_conflict",
    "component_etag",
    "manifest_conflict",
    "revision_conflict",
]
