"""Compose the documentation sheets into released members (D6-D8, D10).

This is the Documentation Engine's seam with Stage 1: it is a *member producer*.
It adds files to the dossier under the ``documentation`` domain and changes
nothing about the digest graph, the policy engine, or the approval model.

Artwork acquisition is optional by design.  Without ``kicad-cli`` the sheets
still compose -- frame, tables, notes, and a stated absence where the artwork
would be -- because a build that cannot plot copper should still produce the
document set and say what is missing, rather than fail.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from app.release_studio.documents import sheets as sheet_templates
from app.release_studio.documents.artwork import AcquiredArtwork, ArtworkError, acquire, composite_pdf
from app.release_studio.documents.layout import Rect, Sheet
from app.release_studio.documents.pdf import render_pdf
from app.release_studio.documents.svg import render_svg

logger = logging.getLogger(__name__)

DOCUMENT_DOMAIN = "documentation"

# Which layers each sheet plots. Kept here rather than in the templates so the
# sheet code stays about layout and this stays about what KiCad is asked for.
ARTWORK_LAYERS: dict[str, tuple[str, ...]] = {
    "fabrication": ("Edge.Cuts", "F.Cu"),
    "assembly-top": ("F.Fab", "F.Silkscreen", "Edge.Cuts"),
    "assembly-bottom": ("B.Fab", "B.Silkscreen", "Edge.Cuts"),
    "drill": ("Edge.Cuts",),
}


@dataclass(frozen=True, slots=True)
class DocumentOutput:
    """One composed sheet, in both serializations."""

    key: str
    title: str
    svg_path: str
    pdf_path: str
    svg_bytes: bytes
    pdf_bytes: bytes
    scale: float
    artwork_digest: str = ""


@dataclass(frozen=True, slots=True)
class DocumentSet:
    outputs: tuple[DocumentOutput, ...]
    warnings: tuple[str, ...] = ()

    def files(self) -> dict[str, bytes]:
        """Released path -> bytes, ready to become dossier members."""

        payload: dict[str, bytes] = {}
        for output in self.outputs:
            payload[output.svg_path] = output.svg_bytes
            payload[output.pdf_path] = output.pdf_bytes
        return payload


def compose(
    *,
    context: Mapping[str, Any],
    stats: Mapping[str, Any],
    stackup: Mapping[str, Any],
    variants: Mapping[str, Any],
    placements: Sequence[Mapping[str, Any]],
    members: Sequence[Mapping[str, Any]],
    board: Path | None = None,
    cli_path: str | None = None,
    workdir: Path | None = None,
    sheet_size: str = sheet_templates.DEFAULT_SIZE,
    acquirer: Callable[..., AcquiredArtwork] | None = None,
) -> DocumentSet:
    """Compose the full document set.

    ``acquirer`` is injectable so the templates can be exercised without a
    KiCad installation; the default acquires from ``kicad-cli``.
    """

    warnings: list[str] = []
    art: dict[str, AcquiredArtwork] = {}

    if board is not None and cli_path and workdir is not None:
        fetch = acquirer or acquire
        for key, layers in ARTWORK_LAYERS.items():
            try:
                art[key] = fetch(
                    cli_path, board, layers, workdir / key,
                    variant=str(context.get("variant") or ""),
                )
            except (ArtworkError, OSError) as exc:
                # A missing view degrades one sheet, never the document set.
                warnings.append(f"artwork for {key} unavailable: {exc}")
                logger.warning("Release Studio artwork for %s unavailable: %s", key, exc)
    else:
        warnings.append("kicad-cli unavailable: sheets composed without board artwork")

    outputs: list[DocumentOutput] = []

    cover = sheet_templates.technical_cover(
        context, stats, stackup, variants, members, size=sheet_size
    )
    outputs.append(_serialize(cover, "cover", 1.0, None, None))

    fabrication, fab_scale = sheet_templates.fabrication_sheet(
        context, stats, stackup, art.get("fabrication"), size=sheet_size
    )
    outputs.append(
        _serialize(fabrication, "fabrication", fab_scale, art.get("fabrication"),
                   _artwork_window(fabrication))
    )

    for side in ("top", "bottom"):
        key = f"assembly-{side}"
        sheet, scale = sheet_templates.assembly_sheet(
            context, side, art.get(key), placements, size=sheet_size
        )
        outputs.append(_serialize(sheet, key, scale, art.get(key), _artwork_window(sheet)))

    drill, drill_scale = sheet_templates.drill_sheet(
        context, stats, stackup, art.get("drill"), size=sheet_size
    )
    outputs.append(
        _serialize(drill, "drill", drill_scale, art.get("drill"), _artwork_window(drill))
    )

    return DocumentSet(outputs=tuple(outputs), warnings=tuple(warnings))


def _artwork_window(sheet: Sheet) -> Rect | None:
    from app.release_studio.documents.layout import Artwork

    for element in sheet.elements:
        if isinstance(element, Artwork):
            return element.rect
    return None


def _serialize(
    sheet: Sheet,
    key: str,
    scale: float,
    art: AcquiredArtwork | None,
    window: Rect | None,
) -> DocumentOutput:
    svg_bytes = render_svg(sheet).encode("utf-8")
    pdf_bytes = render_pdf(sheet)

    if art is not None and window is not None:
        try:
            pdf_bytes = composite_pdf(pdf_bytes, art, window, scale)
        except Exception as exc:  # noqa: BLE001 - the furniture-only PDF still stands
            logger.warning("Artwork could not be composited into %s: %s", key, exc)

    return DocumentOutput(
        key=key,
        title=sheet.title,
        svg_path=f"documentation/{key}.svg",
        pdf_path=f"documentation/{key}.pdf",
        svg_bytes=svg_bytes,
        pdf_bytes=pdf_bytes,
        scale=scale,
        artwork_digest=art.digest if art else "",
    )
