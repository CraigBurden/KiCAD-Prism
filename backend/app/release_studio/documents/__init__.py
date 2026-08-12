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
#: d7 -- the default frame/title block is emitted by Monkey's public KiCad
#: worksheet API and visible technical text uses Monkey's pinned NewStroke
#: geometry. A deterministic hidden PDF text layer preserves search/copy.
RENDERER_VERSION = "release-studio-documents/d7"

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
