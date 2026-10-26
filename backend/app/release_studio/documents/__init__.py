"""Documentation Engine (Stage 2).

A member producer plugged into the Stage 1 pipeline: it composes drawing sheets
from board projections and acquired artwork, and hands them back as files. It
does not touch the digest graph, the policy engine, or the approval model.
"""

import hashlib

from app.release_studio.documents.engine import (
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

    Fonts are one such resource; the native artwork configurations are another,
    because they decide what the assembly and testpoint drawings contain.  The
    vendor pack configuration is a third: it decides which parts reach a fab
    house's BOM, which is a released member rather than a drawing.  All feed
    ``toolchain_digest``, so editing any of them moves the build key rather
    than silently producing different output under an unchanged one.
    """

    from app.release_studio.documents.artwork_bundle import (
        ASSEMBLY_CONFIG,
        TESTPOINT_CONFIG,
        config_path,
    )
    from app.release_studio.vendors.jlcpcb import VENDOR_CONFIG

    return hashlib.sha256(
        "\0".join(
            [
                resource_bundle_digest(),
                hashlib.sha256(config_path(ASSEMBLY_CONFIG).read_bytes()).hexdigest(),
                hashlib.sha256(config_path(TESTPOINT_CONFIG).read_bytes()).hexdigest(),
                hashlib.sha256(VENDOR_CONFIG.read_bytes()).hexdigest(),
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
#: d29 -- a fabrication sheet's caption sits under the overall width
#: dimension instead of over it, and the notes stay under the drawing only
#: when that caption clears them. `kicad` keeps the d23 look.
#: d28 -- the 2026-10-22 documentation review: `prism` chooses one set ratio
#: against the full body (the paper as before) and continues a sheet's tables
#: on their own pages when they do not fit beside the art; a part whose
#: assembly outline covers other parts is a dashed outline on top with its
#: designator outside; drills sit at the pad and offset pads' copper moves;
#: the cover's component split, slot sizes and testpoint coordinates are
#: corrected (divergence rs-3). `kicad` keeps the d23 look.
#: d27 -- Release Studio is bundle-only: the assembly and testpoint artwork
#: come from ``prism-kicad artwork`` and the DNP legend reads the native
#: artwork configuration, so the Cruncher view configs and their loader are
#: gone (C3 F4c).
#: d26 -- artwork line weights are paper sizes by default: `paper` is the
#: default `artwork_line_weights`, and the committed assembly/testpoint configs
#: are tuned to ISO 128-20 widths and the ISO 3098 1.8 mm minimum text height.
#: d24 -- the Prism sheet style is the default: ink-black worksheet and title
#: block with grey tints, boxed/tinted/striped tables, captions under the
#: placed artwork, the full ISO scale series with a 10 mm margin, shortened
#: hierarchical testpoint nets, and the DNP designator list. `kicad` keeps the
#: d23 bytes selectable.
#: d23 -- testpoint drawings render a Monkey-derived TP-only staging board and
#: promote legacy fp_text references for released Cruncher compatibility.
#: d21 -- Cruncher views honor the checked-in board-outline canvas policy via
#: Monkey's public bounding boxes, keeping SVG and PDF placement identical.
#: d20 -- bordered schedule cells inset from the grid on both sides so
#: wrapping text cannot sit on the rule.
#: d19 -- manufacturing/IPC/finish callouts are cover tables, not title-block
#: comment 4; BOM schedule is a bordered table with Qty second plus
#: Manufacturer/MPN, wrapping capped at two lines.
#: d18 -- Document Name / tag / user date on the title block; cover history
#: prepends this forge Release; manufacturing view adds silkscreen; optional
#: impedance table and manufacturer stackup PDF append onto fabrication; BOM PDF
#: is typeset from the KiCad-preset CSV.
#: d17 -- release configuration carries manufacturing/assembly IPC classes,
#: solder-mask colour and via treatment onto the cover; the drill drawing adds
#: projected via type, span, layer-count and quantity statistics.
#: d15 -- released members are PDFs only (page SVGs stay in memory for tests);
#: the fabrication opening page is the first copper layer rather than a second
#: Edge.Cuts+F.Cu plot of the same geometry.
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
RENDERER_VERSION = "release-studio-documents/d29"

__all__ = [
    "ASSEMBLY_SIDES",
    "DOCUMENT_DOMAIN",
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
