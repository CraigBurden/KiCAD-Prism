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
    "settings": {"copper_finish": "ENIG", "edge_plating": False},
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

    def test_pdf_escapes_literal_parentheses(self) -> None:
        pdf = render_pdf(self._sheet())
        self.assertIn(rb"(Hello \(world\)) Tj", pdf)

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

    def _size(self, width: float, height: float, members=MEMBERS) -> str:
        return sheet_templates.select_sheet_size(
            width,
            height,
            table_height=sheet_templates.required_table_height(
                STATS, STACKUP, VARIANTS, members, "default"
            ),
            table_width=sheet_templates.required_body_width(members),
        )

    def test_bigger_boards_get_bigger_sheets(self) -> None:
        ladder = [self._size(w, h) for w, h in ((50, 40), (300, 250), (500, 400), (900, 700))]
        self.assertEqual(ladder, ["A3", "A2", "A1", "A0"])

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

    def test_a_long_member_list_can_be_what_makes_the_sheet_grow(self) -> None:
        """Sizing is content-driven, not only board-driven."""

        many = [dict(MEMBERS[0], path=f"fabrication/gerbers/layer-{index}.gbr") for index in range(40)]
        self.assertEqual(
            sheet_templates.required_table_height(STATS, STACKUP, VARIANTS, many, "default"),
            sheet_templates.required_table_height(STATS, STACKUP, VARIANTS, many, "default"),
        )
        self.assertGreater(
            sheet_templates.required_table_height(STATS, STACKUP, VARIANTS, many, "default"),
            sheet_templates.required_table_height(STATS, STACKUP, VARIANTS, MEMBERS, "default"),
        )

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
        self.assertEqual(result.sheet_size, "A3")
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
        from app.release_studio.documents.tables import board_characteristics

        # Defensive: an older or future projection shape yields an empty
        # schedule rather than an AttributeError mid-render.
        pairs = dict(board_characteristics({"drill_holes": {"total": 3}}, {}))
        self.assertEqual(pairs["Total holes"], "—")

    def test_characteristics_pass_through_kicad_formatted_values(self) -> None:
        from app.release_studio.documents.tables import board_characteristics

        pairs = dict(board_characteristics(STATS, STACKUP))
        self.assertEqual(pairs["Board size"], "50.0000 mm × 40.0000 mm")
        self.assertEqual(pairs["Min drill diameter"], "0.3000 mm")
        self.assertEqual(pairs["Total holes"], "33")
        self.assertEqual(pairs["Copper layers"], "2")
        self.assertEqual(pairs["Copper finish"], "ENIG")

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

    def test_every_glyph_a_sheet_uses_survives_the_pdf_backend(self) -> None:
        """The two backends must show the same text, not near-enough text.

        The PDF backend writes base-14 fonts in WinAnsi, so a character outside
        that set becomes a literal `?` in the PDF while the SVG shows it -- a
        silent divergence between two renderings of one sheet.
        """

        from app.release_studio.documents.layout import Text

        sheets = [
            sheet_templates.technical_cover(CONTEXT, STATS, STACKUP, VARIANTS, MEMBERS),
            sheet_templates.fabrication_sheet(CONTEXT, STATS, STACKUP, None)[0],
            sheet_templates.assembly_sheet(CONTEXT, "top", None, PLACEMENTS)[0],
            sheet_templates.drill_sheet(CONTEXT, STATS, STACKUP, None)[0],
        ]
        for sheet in sheets:
            for element in sheet.elements:
                if not isinstance(element, Text):
                    continue
                try:
                    element.value.encode("cp1252")
                except UnicodeEncodeError as exc:  # pragma: no cover - the failure path
                    self.fail(
                        f"{sheet.key}: {element.value!r} cannot be rendered by the "
                        f"PDF backend ({exc})"
                    )

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


class RendererVersionTests(unittest.TestCase):
    """A rendering change must be a deliberate, versioned change.

    `build_key` includes `renderer_version`, so if composed output moves while
    the version stays put, two builds claim to be the same release and are not.
    These digests are the tripwire: when one fails, either the change was
    unintended, or `RENDERER_VERSION` needs bumping and these digests updating
    in the same commit.
    """

    #: Recorded for RENDERER_VERSION d2. These and the version move together,
    #: never one without the other.
    GOLDEN = {
        "documentation/assembly-bottom.pdf":
            "497c1c0f2c25efc22a80e7bc3feb534160ce66b759c77eef735acbd66254684b",
        "documentation/assembly-bottom.svg":
            "3f8057bada680ac9baec80118f7c5ddc59587f239f8aad3f74afae44c92a7f85",
        "documentation/assembly-top.pdf":
            "8b08e8fd2acf6f5eed38432b1eb92aa8db54b991f1f9813d282e97dc6cfd53b1",
        "documentation/assembly-top.svg":
            "891ac75808b4124b2d63d4e62717952c8a2d55c647df91136525d43b5c6f9de1",
        "documentation/cover.pdf":
            "a62572a87f58d38ba48c26fd2bb578214d088f26b6eb359385c22b850b4ec624",
        "documentation/cover.svg":
            "5eff62fb29ddc5118f0690b922d5a97aaec463eaa53dbdacd70571316b360f43",
        "documentation/drill.pdf":
            "8eddf2abe3698666de887e6e3f5d0922cbe7a61456f283bd538b79091076d4c5",
        "documentation/drill.svg":
            "de1feefb210032898e5b01193a2bd30ba186a58a7612aa05256e94bc67bc8c8c",
        "documentation/fabrication.pdf":
            "87c004c174c690e397eb70dcdcb542ed85584fb82c30270bb17aae1ca8d27399",
        "documentation/fabrication.svg":
            "66640cd0e759153b32b27c4910e8923e1bb2da7a9c02d2cb44064d2e86205c57",
    }

    #: A placed sheet, so a change to sheet selection or to the scale ladder
    #: trips this too -- the set above carries no artwork and would not.
    GOLDEN_PLACED = "6bf1b09ef3d5c7b07fd3287d37acef712e70ef54780b6585e52887510580509c"

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
            "release-studio-documents/d3",
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
