"""Documentation Engine (Stage 2).

A member producer plugged into the Stage 1 pipeline: it composes drawing sheets
from board projections and acquired artwork, and hands them back as files. It
does not touch the digest graph, the policy engine, or the approval model.
"""

import hashlib

from app.release_studio.documents.artwork import PCB_SVG_CONFIG
from app.release_studio.documents.engine import (
    ARTWORK_LAYERS,
    ASSEMBLY_SIDES,
    DOCUMENT_DOMAIN,
    DocumentOutput,
    DocumentPage,
    DocumentSet,
    compose,
)
from app.release_studio.documents.fonts import resource_bundle_digest
from app.release_studio.documents.layout import Sheet, SheetBuilder
from app.release_studio.documents.pdf import render_pdf
from app.release_studio.documents.svg import render_svg


def renderer_resource_digest() -> str:
    """Identity of every bundled resource that can change a composed sheet.

    Fonts are one such resource; the Cruncher view configuration is another,
    because it decides what the assembly drawings contain.  Both feed
    ``toolchain_digest``, so editing either moves the build key rather than
    silently producing different sheets under an unchanged one.
    """

    return hashlib.sha256(
        "\0".join(
            [
                resource_bundle_digest(),
                hashlib.sha256(PCB_SVG_CONFIG.read_bytes()).hexdigest(),
            ]
        ).encode("utf-8")
    ).hexdigest()

#: Bumped whenever a change alters composed output for unchanged input; it
#: feeds `toolchain_digest` as the renderer version.
#:
#: Forgetting to bump this is not a cosmetic slip: two builds would then share a
#: `build_key` while producing different sheets, which is precisely the
#: reproducibility claim the key exists to make. The golden-digest tests in
#: `test_release_studio_documents.py` fail on any rendering change, so the bump
#: cannot be skipped silently.
#: d14 -- drawings that belong together are one PDF with pages: every plotted
#: layer of the board in the fabrication document, both sides in the assembly
#: and testpoint ones, and continuation schedules as pages rather than files.
#: The cover carries a raytraced view of the board; assembly counts come from
#: the board rather than the position file, so "do not populate" is a stated
#: number instead of a note that was not true.
#: d13 -- testpoint drawings: two further Cruncher views in the one checked-in
#: configuration label only `TP*` and omit the component outlines, with a
#: schedule of designator and position beside them; the cover spreads its three
#: columns across the body instead of packing them left, and an untagged
#: project gets a stated revision history rather than a missing column.
#: d12 -- schedules never truncate: the fit is measured rather than predicted
#: and what still does not fit continues on its own sheet; the cover is three
#: columns with the note block measured off the bottom; assembly views ask
#: Cruncher for the model outline and report what each component was actually
#: drawn from.
#: d11 -- package size from board stats only; table slack capped with wrapped
#: cells; assembly HLR binds KIPRJMOD/packages3D and defaults to bounding_box;
#: cover carries richer summary and Git tag revision history.
#: d10 -- fabrication sheets carry overall width/height dimensions from board
#: statistics; assembly views are placed as Cruncher emitted them (no ingest).
#: d9 -- assembly views come from `kicad-cruncher pcb-svg`; one scale for the
#: whole set; table columns claim the width the board does not need; the cell
#: gutter is proportional to the drawn font; the cover states what it lists.
#: d8 -- Geist is the default face again; it reads better than a single-weight
#: plotter font at table sizes. NewStroke stays selectable as `kicad-newstroke`
#: for projects needing KiCad's full drawing vocabulary (⌀, ✓).
#: d7 -- the default frame/title block is emitted by Monkey's public KiCad
#: worksheet API and visible technical text uses Monkey's pinned NewStroke
#: geometry. A deterministic hidden PDF text layer preserves search/copy.
RENDERER_VERSION = "release-studio-documents/d14"

__all__ = [
    "ARTWORK_LAYERS",
    "ASSEMBLY_SIDES",
    "DOCUMENT_DOMAIN",
    "PCB_SVG_CONFIG",
    "RENDERER_VERSION",
    "DocumentOutput",
    "DocumentPage",
    "DocumentSet",
    "Sheet",
    "SheetBuilder",
    "compose",
    "render_pdf",
    "render_svg",
    "renderer_resource_digest",
]
