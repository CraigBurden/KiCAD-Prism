"""Documentation Engine (Stage 2).

A member producer plugged into the Stage 1 pipeline: it composes drawing sheets
from board projections and acquired artwork, and hands them back as files. It
does not touch the digest graph, the policy engine, or the approval model.
"""

from app.release_studio.documents.engine import (
    ARTWORK_LAYERS,
    DOCUMENT_DOMAIN,
    DocumentOutput,
    DocumentSet,
    compose,
)
from app.release_studio.documents.layout import Sheet, SheetBuilder
from app.release_studio.documents.pdf import render_pdf
from app.release_studio.documents.svg import render_svg

#: Bumped whenever a change alters composed output for unchanged input; it
#: feeds `toolchain_digest` as the renderer version.
#:
#: Forgetting to bump this is not a cosmetic slip: two builds would then share a
#: `build_key` while producing different sheets, which is precisely the
#: reproducibility claim the key exists to make. The golden-digest tests in
#: `test_release_studio_documents.py` fail on any rendering change, so the bump
#: cannot be skipped silently.
#: d4 -- the sheet is sized from the ISO A ladder for the *board*, tables are
#: scaled to the sheet the board earned rather than growing it, placement ratios
#: are quantized to ISO 5455, the drill sheet carries the drill map, and the PDF
#: composite is positioned from the artwork's location on KiCad's page rather
#: than by fitting that whole page into the artwork window.
RENDERER_VERSION = "release-studio-documents/d4"

__all__ = [
    "ARTWORK_LAYERS",
    "DOCUMENT_DOMAIN",
    "RENDERER_VERSION",
    "DocumentOutput",
    "DocumentSet",
    "Sheet",
    "SheetBuilder",
    "compose",
    "render_pdf",
    "render_svg",
]
