"""Stage 2 acceptance: the Documentation Engine.

The decisive properties are that a sheet is *reproducible* -- two renders of
the same inputs are byte-identical, and nothing build-time reaches the page --
and that placed artwork is placed at a stated, measurable scale.
"""

from __future__ import annotations

import io
import re
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

from app.release_studio.documents import compose, render_pdf, render_svg  # noqa: E402
from app.release_studio.documents import artwork as artwork_module  # noqa: E402
from app.release_studio.documents import sheets as sheet_templates  # noqa: E402
from app.release_studio.documents.layout import (  # noqa: E402
    Rect,
    SheetBuilder,
    Table,
    draw_table,
    fit_text,
    fmt,
    text_width,
)

try:  # pragma: no cover - exercised by whichever branch the environment takes
    import pikepdf  # noqa: F401

    _HAS_PIKEPDF = True
except ImportError:  # pragma: no cover
    _HAS_PIKEPDF = False

CONTEXT = {
    "title": "Example Board",
    "document_number": "DOC-1",
    "revision": "A",
    "commit_sha": "a" * 40,
    "variant": "default",
    "commit_date": "2026-08-11",
}
# These mirror the *actual* shapes the R5 projections return for a real board:
# `board` holds pre-formatted strings with units, and `drill_holes` is a list of
# hole groups rather than a summary object. Inventing a friendlier shape here is
# exactly what let the engine ship a table that crashed on real input.
STATS = {
    "board": {
        "width": "50.0000 mm",
        "height": "40.0000 mm",
        "area": "2000.00 mm²",
        "board_thickness": "1.6000 mm",
        "min_drill_diameter": "0.3000 mm",
        "min_track_width": "0.2000 mm",
        "min_track_clearance": "0.2000 mm",
    },
    "pads": {"through_hole": 18, "smd": 119, "npth": 2, "castellated": 0, "press_fit": 0},
    "components": {"total": {"front": 37, "back": 0, "total": 37}},
    "drill_holes": [
        {"count": 21, "plated": True, "shape": "Round", "source": "Via",
         "start_layer": "F.Cu", "stop_layer": "B.Cu",
         "x_size": "0.3000 mm", "y_size": "0.3000 mm"},
        {"count": 12, "plated": True, "shape": "Round", "source": "Pad",
         "start_layer": "F.Cu", "stop_layer": "B.Cu",
         "x_size": "0.4000 mm", "y_size": "0.4000 mm"},
    ],
}
STACKUP = {
    "board_thickness": 1.6,
    "copper_layer_count": 2,
    "settings": {
        "copper_finish": "ENIG",
        "dielectric_constraints": True,
        "edge_connector": None,
        "edge_plating": False,
    },
    "layers": [
        {"name": "F.Cu", "kind": "copper", "type": "signal",
         "thickness": None, "material": None, "epsilon_r": None, "user_name": None},
        {"name": "B.Cu", "kind": "copper", "type": "signal",
         "thickness": None, "material": None, "epsilon_r": None, "user_name": None},
    ],
}
VARIANTS = {"variants": ["default", "lite"], "diverged": False}
PLACEMENTS = [{"side": "top"}] * 3 + [{"side": "bottom"}]
MEMBERS = [
    {"path": "fabrication/gerbers/board-F_Cu.gbr", "canonicalizer": "gerber",
     "released_digest": "a" * 64},
]


def _svg_artwork(width_mm: float, height_mm: float, *, units_per_mm: float = 1.0):
    """A minimal stand-in for `kicad-cli pcb export svg` output."""

    vw = width_mm * units_per_mm
    vh = height_mm * units_per_mm
    text = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width_mm}mm" '
        f'height="{height_mm}mm" viewBox="0 0 {vw} {vh}">'
        f'<rect x="0" y="0" width="{vw}" height="{vh}" fill="none" stroke="black"/>'
        "</svg>"
    )
    return artwork_module.AcquiredArtwork(
        layers=("Edge.Cuts",),
        svg_text=text,
        pdf_bytes=b"",
        view_x=0.0,
        view_y=0.0,
        view_width=width_mm,
        view_height=height_mm,
        digest="d" * 64,
    )


class LayoutTests(unittest.TestCase):
    def test_number_formatting_is_stable_and_has_no_negative_zero(self) -> None:
        self.assertEqual(fmt(0.0), "0")
        self.assertEqual(fmt(-0.0001), "0")
        self.assertEqual(fmt(1.5), "1.5")
        self.assertEqual(fmt(1.0), "1")
        self.assertEqual(fmt(1.23456), "1.235")

    def test_text_is_truncated_visibly_rather_than_clipped(self) -> None:
        long = "a-very-long-member-path/that-will-not-fit-in-the-column.gbr"
        fitted = fit_text(long, 20.0, 2.4)
        self.assertNotEqual(fitted, long)
        self.assertTrue(fitted.endswith("…"))
        self.assertLessEqual(text_width(fitted, 2.4), 20.0)

    def test_monospace_width_is_proportional_to_length(self) -> None:
        one = text_width("x", 3.0, family="mono")
        ten = text_width("x" * 10, 3.0, family="mono")
        self.assertAlmostEqual(ten, one * 10, places=6)


class SerializerTests(unittest.TestCase):
    def _sheet(self):
        builder = SheetBuilder("t", "Test Sheet", "A4")
        builder.rect(Rect(10, 10, 100, 50))
        builder.text(20, 20, "Hello (world)")
        draw_table(
            builder,
            Table(columns=("A", "B"), rows=(("1", "2"),), widths=(20.0, 20.0)),
            (10.0, 70.0),
        )
        return builder.build()

    def test_svg_and_pdf_are_both_reproducible(self) -> None:
        sheet = self._sheet()
        self.assertEqual(render_svg(sheet), render_svg(sheet))
        self.assertEqual(render_pdf(sheet), render_pdf(sheet))

    def test_no_timestamp_or_generator_metadata_reaches_the_output(self) -> None:
        sheet = self._sheet()
        svg = render_svg(sheet)
        pdf = render_pdf(sheet)
        for banned in ("CreationDate", "ModDate", "Producer", "Creator"):
            self.assertNotIn(banned, svg)
            self.assertNotIn(banned.encode("ascii"), pdf)
        # A fixed /ID is what keeps the trailer from varying per render.
        self.assertIn(b"/ID [<00000000000000000000000000000000>", pdf)

    def test_the_default_pdf_is_searchable_from_its_embedded_face(self) -> None:
        """Geist sets the visible glyphs, so the text layer is the real text."""

        from pypdf import PdfReader

        pdf = render_pdf(self._sheet())
        text = PdfReader(io.BytesIO(pdf)).pages[0].extract_text()
        self.assertIn("Hello (world)", text)
        self.assertIn(b"/Subtype /Type0", pdf)
        self.assertIn(b"/FontFile2", pdf)
        self.assertIn(b"/ToUnicode", pdf)

    def test_a_newstroke_pdf_stays_searchable_behind_its_vectors(self) -> None:
        """NewStroke draws paths, so search relies on a hidden Base-14 layer.

        The shim exists because the pinned Monkey wheel ships stroke data but no
        embeddable NewStroke face; it goes away once upstream packages one.
        """

        from pypdf import PdfReader

        builder = SheetBuilder("t", "Test Sheet", "A4", typography="kicad-newstroke")
        builder.text(20, 20, "Hello (world)")
        pdf = render_pdf(builder.build())
        text = PdfReader(io.BytesIO(pdf)).pages[0].extract_text()
        self.assertIn("Hello (world)", text)
        self.assertIn(b"/Subtype /Type1", pdf)
        self.assertIn(b"/BaseFont /Helvetica", pdf)
        self.assertIn(b"/Encoding /WinAnsiEncoding", pdf)
        self.assertNotIn(b"/FontFile", pdf)

    def test_pdf_declares_the_sheet_size_in_points(self) -> None:
        sheet = self._sheet()
        pdf = render_pdf(sheet)
        match = re.search(rb"/MediaBox \[0 0 ([0-9.]+) ([0-9.]+)\]", pdf)
        self.assertIsNotNone(match)
        width = float(match.group(1))  # type: ignore[union-attr]
        self.assertAlmostEqual(width, 297.0 * 72.0 / 25.4, places=2)


class ArtworkPlacementTests(unittest.TestCase):
    def test_extents_are_reported_in_millimetres(self) -> None:
        art = _svg_artwork(50.0, 40.0, units_per_mm=10.0)
        x, y, width, height = artwork_module.extents(art.svg_text)
        self.assertAlmostEqual(width, 50.0, places=6)
        self.assertAlmostEqual(height, 40.0, places=6)
        self.assertEqual((x, y), (0.0, 0.0))
        self.assertAlmostEqual(artwork_module.user_units_per_mm(art.svg_text), 10.0, places=6)

    def test_a_one_to_one_placement_measures_the_board(self) -> None:
        """The scale oracle: 50.000 mm of board occupies 50.000 mm of sheet."""

        art = _svg_artwork(50.0, 40.0, units_per_mm=10.0)
        window = Rect(0.0, 0.0, 200.0, 150.0)
        element, used = artwork_module.place(art, window, scale=1.0)

        self.assertEqual(used, 1.0)
        # The artwork is 10 user units per millimetre, so a 1:1 sheet placement
        # is a group scale of 1/10 -- get this wrong and the drawing lies.
        self.assertAlmostEqual(element.scale, 0.1, places=9)
        # 50 board-mm at scale 1.0, centred in a 200 mm window.
        self.assertAlmostEqual(element.offset_x, 75.0, places=6)
        self.assertAlmostEqual(element.offset_y, 55.0, places=6)

    def test_an_omitted_scale_fits_the_window_and_is_reported(self) -> None:
        art = _svg_artwork(100.0, 50.0)
        element, used = artwork_module.place(art, Rect(0.0, 0.0, 50.0, 50.0))
        self.assertAlmostEqual(used, 0.5, places=9)
        self.assertAlmostEqual(element.scale, 0.5, places=9)

    def test_acquisition_strips_the_plot_time_from_artwork(self) -> None:
        """KiCad stamps the plot time into the SVG title; placing it would make
        every composed sheet differ per build, and hashing it would move the
        clip-path id as well."""

        from app.release_studio.documents.artwork import sanitize_artwork

        raw = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" '
            'viewBox="0 0 10 10">\n'
            "<title>SVG Image created as board.svg date 2026-08-11T17:09:53 </title>\n"
            "<!-- Created by KiCad, date 2026-08-11 -->\n"
            '<rect x="0" y="0" width="10" height="10"/>\n'
            "</svg>"
        )
        cleaned = sanitize_artwork(raw)
        self.assertNotIn("2026-08-11", cleaned)
        self.assertNotIn("SVG Image created", cleaned)
        # Semantically null: the geometry survives untouched.
        self.assertIn('<rect x="0" y="0" width="10" height="10"/>', cleaned)

    def test_scale_labels_read_the_way_a_drawing_states_them(self) -> None:
        self.assertEqual(artwork_module.scale_label(1.0), "1:1")
        self.assertEqual(artwork_module.scale_label(0.5), "1:2")
        self.assertEqual(artwork_module.scale_label(2.0), "2:1")

    def test_placed_artwork_keeps_the_source_geometry_verbatim(self) -> None:
        art = _svg_artwork(50.0, 40.0)
        sheet, _scale = sheet_templates.fabrication_sheet(CONTEXT, STATS, STACKUP, art)
        svg = render_svg(sheet)
        # The acquired markup is inlined, not re-projected.
        self.assertIn('<rect x="0" y="0" width="50.0" height="40.0"', svg)
        self.assertIn("clip-path", svg)


class SheetSizingTests(unittest.TestCase):
    """The sheet is chosen for the drawing, not fixed to one board."""

    def _size(self, width: float, height: float) -> str:
        return sheet_templates.select_sheet_size(width, height)

    def test_bigger_boards_get_bigger_sheets(self) -> None:
        ladder = [
            self._size(w, h)
            for w, h in ((50, 40), (200, 150), (300, 250), (500, 400), (900, 700))
        ]
        self.assertEqual(ladder, ["A4", "A3", "A2", "A1", "A0"])

    def test_content_never_makes_the_sheet_grow(self) -> None:
        """A long table is a reason to draw smaller, not to use more paper.

        Sizing the page for the tables gives a 40 mm board an A2 sheet because
        its stackup has rows, which is exactly the waste this avoids.
        """

        few = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
        )
        many = compose(
            context=CONTEXT, stats=STATS,
            stackup={**STACKUP, "layers": STACKUP["layers"] * 20},
            variants=VARIANTS, placements=PLACEMENTS,
            members=[
                dict(MEMBERS[0], path=f"fabrication/gerbers/layer-{index}.gbr")
                for index in range(120)
            ],
        )
        self.assertEqual(few.sheet_size, many.sheet_size)

    def test_tables_are_scaled_to_the_sheet_they_land_on(self) -> None:
        from app.release_studio.documents.layout import MIN_TABLE_FONT, Table, fit_columns

        table = Table(
            columns=("A", "B"),
            rows=tuple(("x", "y") for _ in range(40)),
            widths=(60.0, 60.0),
        )
        fitted, factor = fit_columns([[table]], Rect(0.0, 0.0, 60.0, 90.0))
        self.assertLess(factor, 1.0)
        self.assertLessEqual(fitted[0][0].width(), 60.0)
        self.assertLessEqual(fitted[0][0].height(), 90.0)

    def test_height_alone_never_shrinks_text_below_the_legibility_floor(self) -> None:
        """Too tall has a remedy -- dropping rows. Too wide has none."""

        from app.release_studio.documents.layout import MIN_TABLE_FONT, Table, fit_columns

        table = Table(
            columns=("A", "B"),
            rows=tuple(("x", "y") for _ in range(80)),
            widths=(30.0, 30.0),
        )
        fitted, _factor = fit_columns([[table]], Rect(0.0, 0.0, 120.0, 60.0))
        self.assertGreaterEqual(fitted[0][0].font_size, MIN_TABLE_FONT - 1e-9)
        self.assertLessEqual(fitted[0][0].height(), 60.0)
        self.assertIn("more", fitted[0][0].rows[-1][0])

    def test_a_table_that_cannot_shrink_far_enough_states_what_it_dropped(self) -> None:
        from app.release_studio.documents.layout import Table, fit_columns

        table = Table(
            columns=("A", "B"),
            rows=tuple((str(index), "y") for index in range(400)),
            widths=(60.0, 60.0),
        )
        fitted, _factor = fit_columns([[table]], Rect(0.0, 0.0, 60.0, 40.0))
        result = fitted[0][0]
        self.assertLess(len(result.rows), len(table.rows))
        self.assertLessEqual(result.height(), 40.0)
        # Silently stopping would read as "that is all of them".
        self.assertIn("more", result.rows[-1][0])

    def test_the_ladder_is_monotonic_in_board_size(self) -> None:
        """A larger board never lands on a smaller sheet."""

        order = {size: index for index, size in enumerate(sheet_templates.SHEET_LADDER)}
        previous = -1
        for edge in range(20, 1200, 20):
            index = order[self._size(edge, edge * 0.8)]
            self.assertGreaterEqual(index, previous)
            previous = index

    def test_a_board_larger_than_a0_lands_on_a0_and_is_reduced(self) -> None:
        size = self._size(2000.0, 1500.0)
        self.assertEqual(size, "A0")
        window = sheet_templates.artwork_window(size, sheet_templates.TABLE_WIDTHS["fabrication"])
        from app.release_studio.documents.layout import preferred_scale

        used = preferred_scale(2000.0, 1500.0, window)
        self.assertLess(used, 1.0)
        self.assertAlmostEqual(used, 0.5, places=9)

    def test_the_predicted_body_matches_the_drawn_one(self) -> None:
        """`select_sheet_size` reasons about a sheet it has not drawn yet."""

        from app.release_studio.documents.layout import Artwork

        for size in sheet_templates.SHEET_LADDER:
            sheet, _scale = sheet_templates.fabrication_sheet(
                CONTEXT, STATS, STACKUP, _svg_artwork(20.0, 15.0), size=size
            )
            placed = next(e for e in sheet.elements if isinstance(e, Artwork))
            expected = sheet_templates.artwork_window(
                size, sheet_templates.TABLE_WIDTHS["fabrication"]
            )
            self.assertEqual(
                (placed.rect.x, placed.rect.y, placed.rect.width, placed.rect.height),
                (expected.x, expected.y, expected.width, expected.height),
                f"{size}: the drawn artwork window disagrees with the predicted one",
            )

    def test_placement_ratios_come_from_the_standard_series(self) -> None:
        from app.release_studio.documents.layout import PREFERRED_SCALES, preferred_scale

        window = Rect(0.0, 0.0, 252.0, 233.0)
        for width, height in ((10, 8), (38, 30), (120, 90), (240, 200), (600, 500)):
            used = preferred_scale(float(width), float(height), window)
            self.assertIn(used, PREFERRED_SCALES)

    def test_a_placed_sheet_states_a_standard_ratio(self) -> None:
        art = _svg_artwork(38.0, 30.0)
        sheet, used = sheet_templates.fabrication_sheet(CONTEXT, STATS, STACKUP, art, size="A3")
        self.assertEqual(used, 5.0)
        self.assertIn("SCALE 5:1", render_svg(sheet))

    def test_the_whole_set_shares_one_sheet_size(self) -> None:
        result = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
        )
        self.assertEqual(result.sheet_size, "A4")
        widths = set()
        for payload in result.files().values():
            match = re.search(rb'width="([0-9.]+)mm"', payload)
            if match:
                widths.add(match.group(1))
        self.assertEqual(len(widths), 1, f"sheets disagree about their size: {widths}")


def _plot_paths(origin_x: float, origin_y: float, width: float, height: float) -> str:
    """Four subpaths of one outline, in KiCad's two separator styles.

    Stroked outlines are written ``M126.0000 90.0000`` and filled shapes
    ``M 0.0000,0.0000`` -- an offset reader that understands only one of them
    finds nothing at all on an outline-only plot, which is the drill sheet.
    """

    corners = (
        (origin_x, origin_y),
        (origin_x + width, origin_y),
        (origin_x + width, origin_y + height),
        (origin_x, origin_y + height),
    )
    return "".join(
        f'<path d="M{x:.4f} {y:.4f}\nL{x:.4f} {y:.4f}" />'
        if index % 2
        else f'<path d="M {x:.4f},{y:.4f}\n{x:.4f},{y:.4f}"/>'
        for index, (x, y) in enumerate(corners)
    )


def _page_svg(offset_x: float, offset_y: float, width: float, height: float,
              page: tuple[float, float] = (297.0, 210.0)) -> str:
    """A full-page plot of the same geometry `_cropped_svg` crops to."""

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{page[0]}mm" '
        f'height="{page[1]}mm" viewBox="0 0 {page[0]} {page[1]}">'
        + _plot_paths(offset_x, offset_y, width, height)
        + "</svg>"
    )


def _cropped_svg(width: float, height: float, *, units_per_mm: float = 1.0) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}mm" '
        f'height="{height}mm" viewBox="0 0 {width * units_per_mm} {height * units_per_mm}">'
        + _plot_paths(0.0, 0.0, width * units_per_mm, height * units_per_mm)
        + "</svg>"
    )


class ArtworkPageOffsetTests(unittest.TestCase):
    """`pcb export pdf` cannot crop, so the artwork has to be located on its page.

    Without this the PDF composite fits KiCad's *whole page* into the artwork
    window, which draws the board at the ratio of board-to-page -- about eight
    times smaller than the SCALE the sheet prints, and disagreeing with the SVG
    rendering of the very same sheet.
    """

    def test_the_offset_is_the_translation_between_the_two_plots(self) -> None:
        offset = artwork_module.page_offset(
            _cropped_svg(38.0, 30.0), _page_svg(108.6, 95.6, 38.0, 30.0)
        )
        self.assertEqual(offset, (108.6, 95.6))

    def test_both_of_kicads_separator_styles_are_read(self) -> None:
        """An outline-only plot writes `M126.0000 90.0000`, with no comma."""

        pairs = artwork_module._coordinate_pairs(_cropped_svg(38.0, 30.0))
        self.assertEqual(len(pairs), 4)

    def test_differing_user_units_are_reconciled_before_comparing(self) -> None:
        offset = artwork_module.page_offset(
            _cropped_svg(38.0, 30.0, units_per_mm=10.0),
            _page_svg(108.6, 95.6, 38.0, 30.0),
        )
        self.assertIsNotNone(offset)
        self.assertAlmostEqual(offset[0], 108.6, places=3)  # type: ignore[index]

    def test_plots_that_do_not_line_up_yield_no_offset(self) -> None:
        """A wrong offset would be worse than no composite."""

        # Same number of subpaths, but not the same geometry: the deltas
        # disagree, so there is no single translation between the two plots.
        mismatched = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" '
            'viewBox="0 0 297 210">'
            + _plot_paths(108.6, 95.6, 12.0, 9.0)
            + "</svg>"
        )
        self.assertIsNone(artwork_module.page_offset(_cropped_svg(38.0, 30.0), mismatched))
        self.assertIsNone(artwork_module.page_offset(_cropped_svg(38.0, 30.0), "<svg></svg>"))


@unittest.skipUnless(_HAS_PIKEPDF, "pikepdf is required to composite artwork")
class ArtworkCompositeTests(unittest.TestCase):
    def _overlay(self, page_mm: tuple[float, float] = (297.0, 210.0)) -> bytes:
        import pikepdf

        from app.release_studio.documents.pdf import MM_TO_PT

        pdf = pikepdf.new()
        pdf.add_blank_page(page_size=(page_mm[0] * MM_TO_PT, page_mm[1] * MM_TO_PT))
        out = io.BytesIO()
        pdf.save(out)
        return out.getvalue()

    def _art(self) -> artwork_module.AcquiredArtwork:
        return artwork_module.AcquiredArtwork(
            layers=("Edge.Cuts",),
            svg_text=_cropped_svg(38.0, 30.0),
            pdf_bytes=self._overlay(),
            view_x=0.0, view_y=0.0, view_width=38.0, view_height=30.0,
            digest="d" * 64,
            page_offset_x=108.6,
            page_offset_y=95.6,
        )

    def _cm(self, pdf_bytes: bytes) -> tuple[float, ...]:
        import pikepdf

        with pikepdf.open(io.BytesIO(pdf_bytes)) as document:
            content = pikepdf.Page(document.pages[0]).obj["/Contents"]
            streams = content if isinstance(content, pikepdf.Array) else [content]
            text = b"".join(bytes(stream.read_bytes()) for stream in streams).decode("latin-1")
        match = re.findall(
            r"([-0-9.]+) 0 0 ([-0-9.]+) ([-0-9.]+) ([-0-9.]+) cm\n/PrismArtwork Do", text
        )
        self.assertEqual(len(match), 1, "expected exactly one artwork placement")
        return tuple(float(value) for value in match[0])

    def test_the_composite_uses_the_stated_ratio_not_the_page_ratio(self) -> None:
        from app.release_studio.documents.pdf import MM_TO_PT

        sheet, used = sheet_templates.fabrication_sheet(
            CONTEXT, STATS, STACKUP, self._art(), size="A3"
        )
        window = sheet_templates.artwork_window("A3", sheet_templates.TABLE_WIDTHS["fabrication"])
        composed = artwork_module.composite_pdf(
            render_pdf(sheet), self._art(), window, used
        )
        sx, sy, tx, ty = self._cm(composed)

        # The board is drawn at the ratio the sheet states. Fitting the whole
        # A4 overlay page into the window instead would give 252/297 = 0.85.
        self.assertAlmostEqual(sx, used, places=4)
        self.assertAlmostEqual(sy, used, places=4)

        # And the artwork's left edge lands where the SVG backend puts it.
        drawn_width = 38.0 * used
        expected_left = window.x + (window.width - drawn_width) / 2
        placed_left = (sx * 108.6 * MM_TO_PT + tx) / MM_TO_PT
        self.assertAlmostEqual(placed_left, expected_left, places=3)

    def test_an_artwork_of_unknown_page_position_is_refused(self) -> None:
        art = artwork_module.AcquiredArtwork(
            layers=("Edge.Cuts",), svg_text=_cropped_svg(38.0, 30.0),
            pdf_bytes=self._overlay(), view_x=0.0, view_y=0.0,
            view_width=38.0, view_height=30.0, digest="d" * 64,
        )
        sheet, used = sheet_templates.fabrication_sheet(CONTEXT, STATS, STACKUP, art, size="A3")
        window = sheet_templates.artwork_window("A3", sheet_templates.TABLE_WIDTHS["fabrication"])
        with self.assertRaises(artwork_module.ArtworkError):
            artwork_module.composite_pdf(render_pdf(sheet), art, window, used)

    def test_compositing_is_byte_reproducible(self) -> None:
        sheet, used = sheet_templates.fabrication_sheet(
            CONTEXT, STATS, STACKUP, self._art(), size="A3"
        )
        window = sheet_templates.artwork_window("A3", sheet_templates.TABLE_WIDTHS["fabrication"])
        base = render_pdf(sheet)
        first = artwork_module.composite_pdf(base, self._art(), window, used)
        second = artwork_module.composite_pdf(base, self._art(), window, used)
        self.assertEqual(first, second)


class ProjectionShapeTests(unittest.TestCase):
    """The tables consume R5's real output, not a shape invented for them."""

    def test_drill_holes_is_a_list_of_groups(self) -> None:
        from app.release_studio.documents.tables import drill_table

        table = drill_table(STACKUP, STATS)
        self.assertEqual(len(table.rows), 2)
        self.assertEqual(table.rows[0][0], "Via")
        self.assertIn("F.Cu", table.rows[0][1])
        self.assertEqual(table.rows[0][2], "0.3000 mm")
        self.assertEqual(table.rows[0][4], "21")

    def test_a_summary_shaped_drill_projection_does_not_crash_the_sheet(self) -> None:
        from app.release_studio.documents.tables import board_summary

        # Defensive: an older or future projection shape yields an empty
        # schedule rather than an AttributeError mid-render.
        pairs = dict(board_summary({"drill_holes": {"total": 3}}))
        self.assertEqual(pairs["Drilled holes"], "—")

    def test_characteristics_pass_through_kicad_formatted_values(self) -> None:
        from app.release_studio.documents.tables import board_characteristics

        pairs = dict(board_characteristics(STATS, STACKUP))
        # A lowercase ASCII "x", because that is what `wxString::Format` emits.
        self.assertEqual(pairs["Board overall dimensions"], "50.0000 mm x 40.0000 mm")
        self.assertEqual(pairs["Min hole diameter"], "0.3000 mm")
        self.assertEqual(pairs["Min track/spacing"], "0.2000 mm / 0.2000 mm")
        self.assertEqual(pairs["Copper layer count"], "2")
        self.assertEqual(pairs["Copper finish"], "ENIG")
        self.assertEqual(pairs["Impedance control"], "Yes")
        self.assertEqual(pairs["Castellated pads"], "No")
        self.assertEqual(pairs["Plated board edge"], "No")
        self.assertEqual(pairs["Edge card connectors"], "No")

    def test_the_summary_carries_what_kicads_table_omits(self) -> None:
        from app.release_studio.documents.tables import (
            KICAD_CHARACTERISTIC_LABELS,
            board_summary,
        )

        pairs = dict(board_summary(STATS))
        self.assertEqual(pairs["Drilled holes"], "33")
        self.assertEqual(pairs["Components"], "37")
        # The summary is a separate table precisely so the characteristics one
        # keeps its correspondence with KiCad's; a row that drifted into it
        # would break that without any test noticing.
        self.assertFalse(set(pairs) & set(KICAD_CHARACTERISTIC_LABELS))

    def test_the_characteristics_table_reproduces_kicads_own_rows(self) -> None:
        """Stage 2's conformance criterion, against the recorded rendering."""

        from tests.kicad_conformance import load_conformance
        from app.release_studio.documents.tables import (
            KICAD_CHARACTERISTIC_LABELS,
            board_characteristics,
        )

        recorded = load_conformance("board-characteristics")["labels"]
        self.assertEqual(list(KICAD_CHARACTERISTIC_LABELS), recorded)
        # And the table actually emits them -- in order, with nothing added.
        drawn = [label for label, _value in board_characteristics(STATS, STACKUP)]
        self.assertEqual(drawn, recorded)

    def test_the_recorded_kicad_rendering_is_still_what_kicad_renders(self) -> None:
        """The half that catches a KiCad upgrade, where the source is present."""

        from tests.kicad_conformance import (
            KICAD_SOURCE_ENV,
            characteristic_labels_from_source,
            kicad_source_root,
            load_conformance,
        )

        root = kicad_source_root()
        if root is None:
            self.skipTest(
                f"no pinned KiCad source tree; set {KICAD_SOURCE_ENV} to check "
                "the recorded rendering against it"
            )
        self.assertEqual(
            characteristic_labels_from_source(root),
            load_conformance("board-characteristics")["labels"],
            "KiCad's characteristics table changed: re-record the conformance "
            "fixture and update KICAD_CHARACTERISTIC_LABELS together",
        )

    def test_an_edge_connector_is_rendered_in_kicads_three_words(self) -> None:
        from app.release_studio.documents.tables import board_characteristics

        def connectors(value):
            stackup = {**STACKUP, "settings": {**STACKUP["settings"], "edge_connector": value}}
            return dict(board_characteristics(STATS, stackup))["Edge card connectors"]

        self.assertEqual(connectors(None), "No")
        self.assertEqual(connectors("yes"), "Yes")
        self.assertEqual(connectors("bevelled"), "Yes, Bevelled")

    def test_a_layer_without_a_declared_thickness_renders_a_dash(self) -> None:
        from app.release_studio.documents.tables import stackup_table

        table = stackup_table(STACKUP)
        self.assertEqual(table.rows[0][0], "F.Cu")
        self.assertEqual(table.rows[0][2], "—")


class DocumentSetTests(unittest.TestCase):
    def _compose(self, **overrides):
        payload = dict(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
        )
        payload.update(overrides)
        return compose(**payload)

    def test_the_full_sheet_set_is_produced_in_both_formats(self) -> None:
        result = self._compose()
        keys = [output.key for output in result.outputs]
        self.assertEqual(
            keys, ["cover", "fabrication", "assembly-top", "assembly-bottom", "drill"]
        )
        paths = sorted(result.files())
        self.assertIn("documentation/fabrication.svg", paths)
        self.assertIn("documentation/fabrication.pdf", paths)
        self.assertEqual(len(paths), 10)

    def test_the_document_set_is_byte_reproducible(self) -> None:
        first = self._compose().files()
        second = self._compose().files()
        self.assertEqual(first, second)

    def test_missing_artwork_degrades_one_sheet_and_is_stated(self) -> None:
        result = self._compose()
        self.assertTrue(any("kicad-cli unavailable" in w for w in result.warnings))
        svg = result.files()["documentation/fabrication.svg"].decode("utf-8")
        self.assertIn("board artwork unavailable", svg)


    def test_the_cover_states_the_commit_date_not_a_render_date(self) -> None:
        svg = self._compose().files()["documentation/cover.svg"].decode("utf-8")
        self.assertIn("2026-08-11", svg)
        self.assertIn(CONTEXT["commit_sha"][:12], svg)

    def test_the_cover_lists_released_members_with_digests(self) -> None:
        svg = self._compose().files()["documentation/cover.svg"].decode("utf-8")
        self.assertIn("RELEASED MEMBERS", svg)
        self.assertIn("a" * 16, svg)

    def test_the_assembly_sheets_count_only_their_own_side(self) -> None:
        files = self._compose().files()
        top = files["documentation/assembly-top.svg"].decode("utf-8")
        bottom = files["documentation/assembly-bottom.svg"].decode("utf-8")
        self.assertIn("ASSEMBLY DRAWING — TOP", top)
        self.assertIn("ASSEMBLY DRAWING — BOTTOM", bottom)
        # Three top placements, one bottom.
        self.assertRegex(top, r">3<")
        self.assertRegex(bottom, r">1<")

    def test_a_variant_disagreement_is_reported_rather_than_resolved(self) -> None:
        result = self._compose(variants={"variants": ["default"], "diverged": True})
        svg = result.files()["documentation/cover.svg"].decode("utf-8")
        self.assertIn("disagree", svg)


    def test_no_build_identity_reaches_a_sheet(self) -> None:
        """A sheet carrying a build id or a render time would not be reproducible."""

        # Scan for identity and time *shapes* rather than words: the notes
        # legitimately mention approvers, and a keyword scan would flag prose
        # while missing an actual leaked id.
        leaks = {
            "record id": re.compile(r"\b(?:build|cand|eval|appr|rel|wv)-[0-9a-f]{12,}\b"),
            "wall-clock time": re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}"),
        }
        result = self._compose()
        for path, payload in result.files().items():
            text = payload.decode("utf-8", errors="replace")
            for label, pattern in leaks.items():
                found = pattern.search(text)
                self.assertIsNone(found, f"{label} leaked into {path}: {found}")

    def test_every_sheet_text_survives_the_pdf_backend(self) -> None:
        """The two backends must show the same text, not near-enough text.

        The PDF backend emits glyph IDs, so the ToUnicode map is what makes the
        resulting technical drawing searchable and copyable.
        """

        from pypdf import PdfReader
        from app.release_studio.documents.layout import Text

        sheets = [
            sheet_templates.technical_cover(CONTEXT, STATS, STACKUP, VARIANTS, MEMBERS),
            sheet_templates.fabrication_sheet(CONTEXT, STATS, STACKUP, None)[0],
            sheet_templates.assembly_sheet(CONTEXT, "top", None, PLACEMENTS)[0],
            sheet_templates.drill_sheet(CONTEXT, STATS, STACKUP, None)[0],
        ]
        for sheet in sheets:
            extracted = PdfReader(io.BytesIO(render_pdf(sheet))).pages[0].extract_text()
            for element in sheet.elements:
                if not isinstance(element, Text) or not element.value:
                    continue
                self.assertIn(element.value, extracted, f"{sheet.key}: {element.value!r}")


class TypographyTests(unittest.TestCase):
    def test_a_bundled_face_is_the_default_and_travels_with_the_sheet(self) -> None:
        """The default sheet embeds its face rather than naming a host font."""

        svg = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
        ).files()["documentation/cover.svg"].decode("utf-8")
        self.assertIn('data-typography="geist-pixel-square"', svg)
        # Embedded, so the SVG renders identically on a machine that has never
        # heard of Geist.
        self.assertIn("data:font/ttf;base64,", svg)

    def test_newstroke_draws_vectors_instead_of_embedding_a_face(self) -> None:
        svg = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
            typography="kicad-newstroke",
        ).files()["documentation/cover.svg"].decode("utf-8")
        self.assertIn('data-typography="kicad-newstroke"', svg)
        self.assertIn('data-renderer="kicad-monkey.newstroke"', svg)
        self.assertNotIn("data:font/ttf;base64,", svg)

    def test_a_legacy_bundled_face_remains_a_technical_configuration_choice(self) -> None:
        common = dict(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
        )
        square = compose(**common, typography="kicad-newstroke").files()
        grid = compose(**common, typography="geist-pixel-grid").files()
        self.assertNotEqual(
            square["documentation/cover.svg"], grid["documentation/cover.svg"]
        )
        self.assertNotEqual(
            square["documentation/cover.pdf"], grid["documentation/cover.pdf"]
        )

    def test_an_unknown_preset_fails_before_document_generation(self) -> None:
        with self.assertRaisesRegex(ValueError, "unknown typography preset"):
            compose(
                context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
                placements=PLACEMENTS, members=MEMBERS, typography="host-font",
            )



class ConfiguredNotesTests(unittest.TestCase):
    """D5: the issuing organization's own text reaches the sheet."""

    def _svg(self, key: str, **overrides) -> str:
        payload = dict(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
        )
        payload.update(overrides)
        return compose(**payload).files()[f"documentation/{key}.svg"].decode("utf-8")

    def test_configured_notes_replace_the_default_ones(self) -> None:
        svg = self._svg("drill", notes={"drill": ["All holes plated unless noted."]})
        self.assertIn("All holes plated unless noted.", svg)
        self.assertNotIn("finished diameters", svg)

    def test_a_note_can_interpolate_the_revision_and_the_board(self) -> None:
        svg = self._svg(
            "fabrication",
            notes={"fabrication": ["Built to {{release.revision}} at {{board.board_thickness}}."]},
            fields={"ipc_class": "3"},
        )
        self.assertIn("Built to A at 1.6000 mm.", svg)

    def test_a_configured_field_reaches_the_title_block_of_every_sheet(self) -> None:
        for key in ("cover", "fabrication", "assembly-top", "drill"):
            with self.subTest(sheet=key):
                svg = self._svg(key, fields={"ipc_class": "3", "customer": "Acme"})
                self.assertIn("IPC CLASS", svg)
                self.assertIn("Acme", svg)

    def test_fields_are_drawn_in_key_order_not_declaration_order(self) -> None:
        # `technical_config_digest` canonicalizes with sorted keys, so two
        # configurations that differ only in field order share a build key --
        # and must therefore produce the same sheet.
        forward = self._svg("cover", fields={"alpha": "1", "beta": "2"})
        reverse = self._svg("cover", fields={"beta": "2", "alpha": "1"})
        self.assertEqual(forward, reverse)
        self.assertLess(forward.index("ALPHA"), forward.index("BETA"))

    def test_an_unresolvable_note_keeps_the_default_and_says_why(self) -> None:
        result = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
            notes={"drill": ["Class {{fields.missing}}"]},
        )
        svg = result.files()["documentation/drill.svg"].decode("utf-8")
        # Never the raw token: a released drawing must not carry braces.
        self.assertNotIn("{{", svg)
        self.assertIn("finished diameters", svg)
        self.assertTrue(
            any("configured notes for drill were not used" in w for w in result.warnings),
            result.warnings,
        )

    def test_newstroke_sets_the_whole_drawing_vocabulary(self) -> None:
        """`kicad-newstroke` is the face to select when a note needs symbols.

        KiCad's own font covers the drawing vocabulary, which the default text
        face does not.  This is the property that makes it worth keeping as a
        selectable preset rather than deleting it.
        """

        note = "All holes ⌀ 0.3 mm ±0.05, 90° chamfer, Ω-pads ✓"
        result = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
            typography="kicad-newstroke",
            notes={"drill": [note]},
        )
        self.assertEqual(len(result.files()), 10)
        drill = result.files()["documentation/drill.svg"].decode("utf-8")
        for symbol in ("⌀", "±", "°", "Ω", "✓"):
            with self.subTest(symbol=symbol):
                self.assertIn(symbol, drill)
        self.assertEqual([w for w in result.warnings if "notes" in w], [])

    def test_the_default_face_names_the_symbols_it_cannot_set(self) -> None:
        """Geist has no U+2300, and the sheet says so instead of guessing.

        The failure is scoped and legible: the standard note is drawn, the set
        is intact, and the warning names the codepoint so the author can either
        reword the note or select `kicad-newstroke`.
        """

        result = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
            notes={"drill": ["All holes ⌀ 0.3 mm minimum."]},
        )
        self.assertEqual(len(result.files()), 10)
        drill = result.files()["documentation/drill.svg"].decode("utf-8")
        self.assertNotIn("⌀", drill)
        self.assertIn("finished diameters", drill)
        self.assertTrue(
            any("U+2300" in warning for warning in result.warnings), result.warnings
        )

    def test_an_unsupported_note_glyph_falls_back_without_losing_documents(self) -> None:
        """A glyph the face genuinely lacks costs one note, never the set."""

        result = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
            notes={"drill": ["表面処理 immersion gold"]},
        )
        # All ten files still present: the degradation is scoped to the note.
        self.assertEqual(len(result.files()), 10)
        drill = result.files()["documentation/drill.svg"].decode("utf-8")
        self.assertNotIn("表面処理", drill)
        self.assertIn("finished diameters", drill)
        self.assertTrue(
            any("U+8868" in warning for warning in result.warnings),
            result.warnings,
        )

    def test_notes_for_a_sheet_that_does_not_exist_are_reported(self) -> None:
        result = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
            notes={"pick-and-place": ["Never rendered"]},
        )
        self.assertTrue(
            any("not a sheet in this set" in w for w in result.warnings), result.warnings
        )

    def test_a_field_naming_the_build_time_cannot_be_interpolated(self) -> None:
        # The substitution namespaces are the guard against a released sheet
        # moving for a reason that has nothing to do with the design.
        result = compose(
            context={**CONTEXT, "built_at": "2026-08-12T09:00:00"},
            stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
            fields={"stamp": "{{release.built_at}}"},
        )
        svg = result.files()["documentation/cover.svg"].decode("utf-8")
        self.assertNotIn("2026-08-12T09:00:00", svg)
        self.assertTrue(
            any("title-block field 'stamp' was not drawn" in w for w in result.warnings),
            result.warnings,
        )

    def test_extra_fields_grow_the_title_block_instead_of_overlapping(self) -> None:
        from app.release_studio.documents import sheets as sheet_templates
        from app.release_studio.documents.layout import TitleBlockField

        extra = tuple(TitleBlockField(f"F{index}", "x") for index in range(6))
        plain = sheet_templates.title_block_height(CONTEXT)
        grown = sheet_templates.title_block_height(CONTEXT, extra)
        self.assertGreater(grown, plain)
        # And the body shrinks by exactly as much, so nothing is drawn under it.
        self.assertAlmostEqual(
            sheet_templates.body_rect("A3", plain).height
            - sheet_templates.body_rect("A3", grown).height,
            grown - plain,
        )

#: A stand-in for one `kicad-cruncher pcb-svg` assembly view.
#:
#: Every construct the real renderer emits is present: a styled group, a
#: nested group carrying a transform, a filled polygon, a drill circle, an
#: arc-bearing outline path, and a rotated designator with a central baseline.
CRUNCHER_VIEW = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" '
    'viewBox="0 0 20 10" data-source="board.kicad_pcb">'
    '<metadata id="pcb-enrichment-a0"></metadata>'
    '<path d="M 0 0 L 20 0 L 20 10 L 0 10 Z" fill="none" stroke="#000000" '
    'stroke-width="0.15" data-feature="board-outline" />'
    '<g style="fill:none; stroke:#000000; stroke-width:0.12">'
    '<line x1="2" y1="2" x2="6" y2="2"/>'
    "</g>"
    '<g transform="translate(10 5) rotate(90)">'
    '<circle cx="0" cy="0" r="0.3" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="0"/>'
    "</g>"
    '<polygon points="1,1 3,1 3,2 1,2" fill="#000000" stroke="none" stroke-width="0"/>'
    '<path d="M 4 4 A 1 1 0 0 1 6 4" fill="none" stroke="#000000" stroke-width="0.1"/>'
    '<text x="5" y="5" font-size="1.6" text-anchor="middle" '
    'dominant-baseline="central" fill="#000000" '
    "font-family=\"Consolas, 'Liberation Mono', monospace\" font-weight=\"700\" "
    'transform="rotate(-90 5 5)" data-component="R1">R1</text>'
    "</svg>"
)


class VectorIngestTests(unittest.TestCase):
    """Cruncher's assembly view becomes ordinary sheet primitives."""

    def setUp(self) -> None:
        from app.release_studio.documents import vector

        self.vector = vector
        self.drawing = vector.ingest_svg(CRUNCHER_VIEW)

    def test_the_drawing_reports_its_own_extent_in_millimetres(self) -> None:
        self.assertEqual(
            (
                self.drawing.view_x, self.drawing.view_y,
                self.drawing.view_width, self.drawing.view_height,
            ),
            (0.0, 0.0, 20.0, 10.0),
        )

    def test_every_construct_becomes_a_layout_primitive(self) -> None:
        from app.release_studio.documents.layout import Circle, Line, Polyline, Text

        kinds = {type(element).__name__ for element in self.drawing.elements}
        self.assertEqual(kinds, {"Line", "Circle", "Polyline", "Text"})
        # Nothing is dropped: an ingester that skipped an unknown element would
        # produce a drawing missing a drill and still looking plausible.
        self.assertEqual(
            len([e for e in self.drawing.elements if isinstance(e, Circle)]), 1
        )
        self.assertEqual(len([e for e in self.drawing.elements if isinstance(e, Line)]), 1)
        self.assertGreaterEqual(
            len([e for e in self.drawing.elements if isinstance(e, Polyline)]), 3
        )
        self.assertEqual(len([e for e in self.drawing.elements if isinstance(e, Text)]), 1)

    def test_a_group_transform_moves_the_geometry_it_wraps(self) -> None:
        from app.release_studio.documents.layout import Circle

        drill = next(e for e in self.drawing.elements if isinstance(e, Circle))
        self.assertAlmostEqual(drill.cx, 10.0)
        self.assertAlmostEqual(drill.cy, 5.0)

    def test_a_designator_keeps_its_rotation_and_loses_its_host_font(self) -> None:
        from app.release_studio.documents.layout import Text

        label = next(e for e in self.drawing.elements if isinstance(e, Text))
        self.assertEqual(label.value, "R1")
        self.assertEqual(label.rotation, -90.0)
        self.assertEqual(label.baseline, "central")
        self.assertTrue(label.bold)
        # `family` is one of the sheet's own roles, never the source's
        # `Consolas, 'Liberation Mono', monospace`.
        self.assertEqual(label.family, "mono")

    def test_an_arc_is_flattened_into_measurable_chords(self) -> None:
        from app.release_studio.documents.layout import Polyline

        arc = next(
            element
            for element in self.drawing.elements
            if isinstance(element, Polyline)
            and any(abs(point[0] - 4.0) < 1e-6 and abs(point[1] - 4.0) < 1e-6
                    for point in element.points)
        )
        # A semicircle of radius 1 bulges 1 mm above its chord; endpoints alone
        # would place the outline a millimetre off.
        self.assertLess(min(point[1] for point in arc.points), 3.2)
        self.assertGreater(len(arc.points), 8)

    def test_placement_maps_the_drawing_onto_a_window_at_a_stated_ratio(self) -> None:
        window = Rect(100.0, 50.0, 40.0, 20.0)
        placed = self.drawing.placed(window, 2.0)
        from app.release_studio.documents.layout import Circle

        drill = next(e for e in placed if isinstance(e, Circle))
        # The 10 mm x 5 mm point sits 20 mm x 10 mm into a window whose
        # 40 x 20 mm exactly holds the 20 x 10 mm drawing at 2:1.
        self.assertAlmostEqual(drill.cx, 120.0)
        self.assertAlmostEqual(drill.cy, 60.0)
        self.assertAlmostEqual(drill.r, 0.6)

    def test_an_unsupported_element_is_refused_rather_than_skipped(self) -> None:
        with self.assertRaises(self.vector.VectorIngestError):
            self.vector.ingest_svg(
                '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" '
                'viewBox="0 0 10 10"><image href="x.png"/></svg>'
            )

    def test_a_translucent_primitive_is_refused(self) -> None:
        with self.assertRaises(self.vector.VectorIngestError):
            self.vector.ingest_svg(
                '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" '
                'viewBox="0 0 10 10"><circle cx="1" cy="1" r="1" fill="#000000" '
                'opacity="0.5"/></svg>'
            )

    def test_a_non_uniform_transform_is_refused(self) -> None:
        with self.assertRaises(self.vector.VectorIngestError):
            self.vector.ingest_svg(
                '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" '
                'viewBox="0 0 10 10"><g transform="scale(2 3)">'
                '<circle cx="1" cy="1" r="1" fill="#000000"/></g></svg>'
            )

    def test_a_paint_server_is_refused_rather_than_painted_black(self) -> None:
        with self.assertRaises(self.vector.VectorIngestError):
            self.vector.ingest_svg(
                '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" '
                'viewBox="0 0 10 10"><circle cx="1" cy="1" r="1" '
                'fill="url(#grad)"/></svg>'
            )


class AssemblySheetTests(unittest.TestCase):
    """The assembly sheets draw Cruncher's view, not KiCad's F.Fab layer."""

    def setUp(self) -> None:
        from app.release_studio.documents import vector

        self.drawing = vector.ingest_svg(CRUNCHER_VIEW)

    def test_the_sheet_carries_the_ingested_designator(self) -> None:
        sheet, _used = sheet_templates.assembly_sheet(
            CONTEXT, "top", self.drawing, PLACEMENTS, size="A3", scale=1.0
        )
        rendered = render_svg(sheet)
        self.assertIn(">R1<", rendered)
        # The released sheet never names a host font: every face it uses is
        # bundled, digest-checked, and embedded.
        self.assertNotIn("Consolas", rendered)
        self.assertNotIn("monospace", rendered)

    def test_both_backends_draw_the_same_view(self) -> None:
        sheet, _used = sheet_templates.assembly_sheet(
            CONTEXT, "top", self.drawing, PLACEMENTS, size="A3", scale=1.0
        )
        # One model, two backends: neither may fail on a primitive the other
        # accepts, which is the whole reason the view is ingested.
        self.assertIn("R1", render_svg(sheet))
        self.assertGreater(len(render_pdf(sheet)), 1000)

    def test_a_designator_too_small_to_read_is_dropped_and_counted(self) -> None:
        """A 0.16 mm designator is a smudge, not small lettering.

        Real boards produce them: an 0402 pad pair is 1.0 x 0.5 mm, and a
        designator fitted inside it cannot be read at any ratio, because density
        does not change with scale.  Leaving them in makes the drawing look as
        though it carries data the reader merely failed to see.
        """

        from app.release_studio.documents import vector
        from app.release_studio.documents.layout import Text

        tiny = vector.ingest_svg(CRUNCHER_VIEW.replace('font-size="1.6"', 'font-size="0.2"'))
        sheet, _used = sheet_templates.assembly_sheet(
            CONTEXT, "top", tiny, PLACEMENTS, size="A3", scale=1.0
        )
        drawn = [
            element for element in sheet.elements
            if isinstance(element, Text) and element.value == "R1"
        ]
        self.assertEqual(drawn, [])
        # ...and the sheet says how many it left out, rather than quietly
        # producing a drawing with no designators on it.
        self.assertIn("Designators omitted", render_svg(sheet))

    def test_a_missing_view_states_its_absence(self) -> None:
        sheet, used = sheet_templates.assembly_sheet(
            CONTEXT, "top", None, PLACEMENTS, size="A3"
        )
        self.assertEqual(used, 1.0)
        self.assertIn("assembly artwork unavailable", render_svg(sheet))

    def test_the_engine_asks_cruncher_for_both_sides(self) -> None:
        asked: list[tuple[str, str]] = []

        def fake(cruncher_path, board, side, workdir):
            asked.append((cruncher_path, side))
            return CRUNCHER_VIEW

        result = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
            board=Path("/nonexistent/board.kicad_pcb"),
            cruncher_path="kicad-cruncher",
            workdir=Path("/tmp"),
            assembly_acquirer=fake,
        )
        self.assertEqual([side for _path, side in asked], ["top", "bottom"])
        digests = {
            output.key: output.artwork_digest
            for output in result.outputs
            if output.key.startswith("assembly-")
        }
        # Provenance: the sheet names the exact drawing it was composed from.
        self.assertEqual(len(digests), 2)
        self.assertTrue(all(len(value) == 64 for value in digests.values()))

    def test_a_failed_view_degrades_one_sheet_and_says_so(self) -> None:
        def fake(cruncher_path, board, side, workdir):
            raise artwork_module.ArtworkError("geometer refused the board")

        result = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
            board=Path("/nonexistent/board.kicad_pcb"),
            cruncher_path="kicad-cruncher",
            workdir=Path("/tmp"),
            assembly_acquirer=fake,
        )
        self.assertEqual(len(result.outputs), 5)
        self.assertTrue(
            any("geometer refused the board" in warning for warning in result.warnings),
            result.warnings,
        )


class SheetSetConsistencyTests(unittest.TestCase):
    """Properties that hold across the whole package, not one sheet."""

    def _composed(self):
        return compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
            board=Path("/nonexistent/board.kicad_pcb"),
            cruncher_path="kicad-cruncher",
            workdir=Path("/tmp"),
            assembly_acquirer=lambda *args, **kwargs: CRUNCHER_VIEW,
        )

    def test_every_sheet_states_the_same_ratio(self) -> None:
        result = self._composed()
        stated = set()
        for payload in result.files().values():
            stated.update(re.findall(rb"SCALE (\d+:\d+)", payload))
            # NewStroke and Geist both emit the ratio as text; the vector path
            # writes it as glyphs, so the accessible copy is read instead.
            stated.update(re.findall(rb'data-text="SCALE ([^"]+)"', payload))
        self.assertLessEqual(
            len(stated), 1, f"the set states more than one scale: {stated}"
        )

    def test_a_table_column_leaves_a_gutter_at_its_trailing_edge(self) -> None:
        from app.release_studio.documents.layout import Text

        builder = SheetBuilder("t", "T", "A3")
        table = Table(
            columns=("Thickness", "Material"),
            rows=(("0.0895", "I-TERA MT40"),),
            widths=(20.0, 40.0),
            align=("end", "start"),
            font_size=1.8,
        )
        draw_table(builder, table, (0.0, 0.0))
        sheet = builder.build()
        values = [element for element in sheet.elements if isinstance(element, Text)]
        thickness = next(element for element in values if element.value == "0.0895")
        material = next(element for element in values if element.value == "I-TERA MT40")
        # The right-aligned number ends before the left-aligned text starts.
        self.assertLess(thickness.x, material.x)
        self.assertGreaterEqual(material.x - thickness.x, 0.5)

    def test_a_truncation_notice_is_never_itself_truncated(self) -> None:
        from app.release_studio.documents.layout import Text

        builder = SheetBuilder("t", "T", "A3")
        table = Table(
            columns=("Layer",),
            rows=tuple((f"layer {index}",) for index in range(10)),
            widths=(12.0,),
            font_size=2.4,
        ).truncated(2)
        draw_table(builder, table, (0.0, 0.0))
        drawn = {
            element.value
            for element in builder.build().elements
            if isinstance(element, Text)
        }
        self.assertIn("and 8 more", drawn)

    def test_an_embedded_face_carries_only_the_glyphs_the_sheet_sets(self) -> None:
        """Three whole faces per sheet is ~383 KiB of unread outlines."""

        result = self._composed()
        sizes = {
            output.key: len(output.pdf_bytes)
            for output in result.outputs
        }
        for key, size in sizes.items():
            # Whole-face embedding put every sheet above 380 KiB; a subset
            # sheet is a small fraction of that, and a regression here means
            # the subsetter silently fell back to the full face.
            self.assertLess(size, 200_000, f"{key} embeds more font than it sets")

    def test_a_project_without_variants_says_so(self) -> None:
        from app.release_studio.documents import tables

        table = tables.variant_table({"variants": []}, "")
        self.assertEqual(len(table.rows), 1)
        self.assertIn("no variants declared", table.rows[0][0])

    def test_the_cover_does_not_claim_to_list_every_released_byte(self) -> None:
        note = sheet_templates.DEFAULT_NOTES["cover"][0]
        self.assertIn("manifest.json", note)
        self.assertNotIn("The files listed above are the released bytes", note)


class RendererVersionTests(unittest.TestCase):
    """A rendering change must be a deliberate, versioned change.

    `build_key` includes `renderer_version`, so if composed output moves while
    the version stays put, two builds claim to be the same release and are not.
    These digests are the tripwire: when one fails, either the change was
    unintended, or `RENDERER_VERSION` needs bumping and these digests updating
    in the same commit.
    """

    #: Recorded for RENDERER_VERSION d8 under the pinned kicad-monkey /
    #: kicad-cruncher 2026.8.11 toolchain, and verified stable across two runs.
    #: The version and these digests move together, never one without the other.
    GOLDEN = {
        "documentation/assembly-bottom.pdf":
            "f18253f3036c05d0aff5a9668b949ceb4f1db7180edee0cdc49c7a431a3abf5f",
        "documentation/assembly-bottom.svg":
            "21de5173587a91809d0200779d7d0763a0dae5ab2d03ec0df44ba9e9fe601dac",
        "documentation/assembly-top.pdf":
            "8d2a550c019aa85861de8c7c576693348ed4bad1c4f0985073732d9ed1e070b3",
        "documentation/assembly-top.svg":
            "c3e60ab03cc45524c47b9e9cc533e718c8b74940759d5ec370da1c903899ec6d",
        "documentation/cover.pdf":
            "a55e0a8b6b62c7a14c2b984fca32836f7fb650bca2df081be4053a77ad8e92fc",
        "documentation/cover.svg":
            "1b33ac956f96538526e6ae9f44ca001a00901c4856e06b8bcbeaed053850dda7",
        "documentation/drill.pdf":
            "326f99e7235531a76987a5c5bc0269abf7decdb8293b79070903d8fe524194d0",
        "documentation/drill.svg":
            "c47dabd9493f2d7beda21fd45ba2b68a05b05278331ffeffc537a74c7b96b941",
        "documentation/fabrication.pdf":
            "36233b61d79e7db4f560cc154f544a36b92519564e76b5db32538d3cd55d0247",
        "documentation/fabrication.svg":
            "90c7d757e42d85f62d78aed5cc2411e8633b1013530933f0bf322bcf5faceea8",
    }

    #: A placed sheet, so a change to sheet selection or to the scale ladder
    #: trips this too -- the set above carries no artwork and would not.
    GOLDEN_PLACED = "dceaaf66e70ae76edba805d22286c875b2651656ab1d2ceb9a446cb4fc2b2210"

    def test_a_placed_sheet_matches_its_recorded_digest(self) -> None:
        import hashlib

        sheet, used = sheet_templates.fabrication_sheet(
            CONTEXT, STATS, STACKUP, _svg_artwork(38.0, 30.0, units_per_mm=10.0)
        )
        self.assertEqual(used, 5.0)
        digest = hashlib.sha256(render_svg(sheet).encode("utf-8")).hexdigest()
        self.assertEqual(
            digest,
            self.GOLDEN_PLACED,
            "placed-sheet output moved: bump RENDERER_VERSION and re-record together",
        )

    def test_composed_output_matches_the_recorded_digests(self) -> None:
        import hashlib

        from app.release_studio.documents import RENDERER_VERSION

        self.assertEqual(
            RENDERER_VERSION,
            "release-studio-documents/d9",
            "RENDERER_VERSION changed: re-record GOLDEN in the same commit",
        )

        files = compose(
            context=CONTEXT, stats=STATS, stackup=STACKUP, variants=VARIANTS,
            placements=PLACEMENTS, members=MEMBERS,
        ).files()
        actual = {path: hashlib.sha256(payload).hexdigest() for path, payload in files.items()}
        self.assertEqual(
            actual,
            self.GOLDEN,
            "composed output moved: bump RENDERER_VERSION and re-record GOLDEN together",
        )


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
