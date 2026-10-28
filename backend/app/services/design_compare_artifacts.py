"""Manufacturing artifacts: the fabrication output.

Neither fabrication output nor layer renders are design objects, so they do not
go through the object diff. The comparison comes back from the plotted
Gerbers; the stackup and every other tab are computed by ``prism-kicad
compare`` (amendment C2r, ADR §9.7 R1).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from app.services import fabrication_compare_service


def _empty_fabrication(*warnings: str) -> Dict[str, Any]:
    """The fabrication domain with nothing to show yet, or nothing to show.

    The partial result is published while the PCB pass is still running, so the
    reviewer reads this shape before any Gerber has been plotted. Deriving it
    from the comparison engine rather than re-authoring it keeps one definition
    of the payload: a placeholder that drifts from the real thing takes the
    whole Design Comparison view down mid-render, not just this tab.
    """

    return {
        **fabrication_compare_service.compare_layers([], []),
        "warnings": sorted(set(warnings)),
    }


def _diff_fabrication(
    base_rev: Dict[str, Any],
    head_rev: Dict[str, Any],
    render_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Compare the two revisions' plotted Gerber packages, if both exist."""

    base_export = base_rev.get("fabrication") or {}
    head_export = head_rev.get("fabrication") or {}
    reasons = [
        str(export.get("reason") or "fabrication output unavailable")
        for export in (base_export, head_export)
        if not export.get("present")
    ]
    if reasons:
        return _empty_fabrication(*reasons)
    base_dir = Path(str(base_export.get("dir")))
    head_dir = Path(str(head_export.get("dir")))
    if not base_dir.is_dir() or not head_dir.is_dir():
        return _empty_fabrication("cached fabrication output was removed")
    comparison = fabrication_compare_service.compare_directories(
        base_dir, head_dir, render_dir
    )
    export_warnings = [
        warning
        for export in (base_export, head_export)
        for warning in (export.get("warnings") or [])
    ]
    if export_warnings:
        comparison["warnings"] = sorted(
            set(comparison.get("warnings") or []) | set(export_warnings)
        )
    return comparison


def _manifest_entry(prepared: Any) -> Dict[str, Any]:
    return {
        "digest": prepared.digest,
        "sizeBytes": prepared.size_bytes,
        "mediaType": prepared.media_type,
    }
