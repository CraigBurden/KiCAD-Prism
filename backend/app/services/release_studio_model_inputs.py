"""A Release Studio candidate's 3D model inputs and the acknowledgement they need.

The closure (``app.release_studio.closure_models``) resolves every model a board
names.  This module turns that into what the release records and gates on:

- one row per model reference (``ws_release_model_inputs``), kept with the
  candidate;
- ``self_contained``: the build reads nothing outside the commit and the
  pinned toolchain, so no host model either;
- the models that are not pinned (``unreadable``, or a missing ``.wrl`` KiCad
  may swap for a STEP model).  Approving or publishing such a build needs an
  explicit acknowledgement naming every one of them; nothing is refused
  outright (issue #698, decision D3).
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence

from app.core import errors

# Model locations whose bytes the build did not pin.
UNPINNED_LOCATIONS = ("unreadable", "substitutable")
# The closure's reason wording for those locations (``closure._UNRESOLVED_WORDING``),
# used to read candidates made before model inputs were recorded.
_LEGACY_WORDING = {
    "unreadable": " is a 3D model outside the release closure that the build cannot read",
    "substitutable": " is a VRML model missing from the release closure",
}


def model_key(source_path: str, reference: str) -> str:
    """The stable name an acknowledgement uses for one model reference."""

    return f"{source_path}::{reference}"


def closure_model_rows(closure: Any) -> list[dict[str, Any]]:
    """The model references of *closure* as ``ws_release_model_inputs`` rows."""

    from app.release_studio.closure_models import is_model_reference

    rows: dict[tuple[str, str], dict[str, Any]] = {}
    for item in closure.library_references:
        if not is_model_reference(item.reference):
            continue
        rows[(item.source_path, item.reference)] = {
            "source_path": item.source_path,
            "reference": item.reference,
            "location": item.location,
            "resolved_path": item.resolved_path,
            "digest": item.digest,
            "advisory": bool(item.advisory),
        }
    return [rows[key] for key in sorted(rows)]


def is_self_contained(hermetic: bool, model_rows: Iterable[Mapping[str, Any]]) -> bool:
    """Hermetic, and no model read from the worker's own files."""

    return bool(hermetic) and all(str(row.get("location")) != "host" for row in model_rows)


def unpinned_models(
    candidate: Mapping[str, Any], model_rows: Sequence[Mapping[str, Any]]
) -> list[dict[str, str]]:
    """The models an approval or publish of *candidate* must acknowledge.

    A candidate made before model inputs were recorded has no rows; its
    non-hermetic reasons still name the models, so they are read from there.
    """

    found: dict[str, dict[str, str]] = {}
    if model_rows:
        for row in model_rows:
            location = str(row.get("location") or "")
            if location not in UNPINNED_LOCATIONS or row.get("advisory"):
                continue
            source, reference = str(row.get("source_path") or ""), str(row.get("reference") or "")
            found[model_key(source, reference)] = {
                "key": model_key(source, reference),
                "source_path": source,
                "reference": reference,
                "location": location,
            }
    else:
        for reason in candidate.get("non_hermetic_reasons") or ():
            parsed = _legacy_model(str(reason))
            if parsed is not None:
                found[parsed["key"]] = parsed
    return [found[key] for key in sorted(found)]


def require_acknowledgement(
    unpinned: Sequence[Mapping[str, str]], acknowledged: Iterable[str], *, action: str
) -> list[str]:
    """The acknowledged keys to record; 409 naming the models still unacknowledged."""

    given = {str(key) for key in acknowledged}
    missing = [row for row in unpinned if row["key"] not in given]
    if missing:
        names = ", ".join(row["reference"] for row in missing)
        raise errors.Conflict(
            f"{action} needs an acknowledgement of {len(missing)} unpinned 3D "
            f"model{'' if len(missing) == 1 else 's'}: {names}"
        )
    return sorted(row["key"] for row in unpinned)


def _legacy_model(reason: str) -> dict[str, str] | None:
    for location, wording in _LEGACY_WORDING.items():
        head, separator, _ = reason.partition(wording)
        source, colon, reference = head.partition(": ")
        if separator and colon and reference:
            return {
                "key": model_key(source, reference),
                "source_path": source,
                "reference": reference,
                "location": location,
            }
    return None


__all__ = [
    "UNPINNED_LOCATIONS",
    "closure_model_rows",
    "is_self_contained",
    "model_key",
    "require_acknowledgement",
    "unpinned_models",
]
