"""Stage 2 acceptance: the Documentation Engine.

The decisive properties are that a sheet is *reproducible* -- two renders of
the same inputs are byte-identical, and nothing build-time reaches the page --
and that placed artwork is placed at a stated, measurable scale.
"""

from __future__ import annotations

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
            "da0747246fb47719babd844e54e4f9d863c2490f8e828e54591845eaee61d40b",
        "documentation/assembly-bottom.svg":
            "3f8057bada680ac9baec80118f7c5ddc59587f239f8aad3f74afae44c92a7f85",
        "documentation/assembly-top.pdf":
            "982b06f9c9bdfc2ee1f6d8fc4b5e61779ae54a3a446a38901b24be3acb348b1a",
        "documentation/assembly-top.svg":
            "891ac75808b4124b2d63d4e62717952c8a2d55c647df91136525d43b5c6f9de1",
        "documentation/cover.pdf":
            "51d39bc8f82f0d0a1f814cd9df371030ad5cc8262c35ba9900f33830d1fdb57b",
        "documentation/cover.svg":
            "5eff62fb29ddc5118f0690b922d5a97aaec463eaa53dbdacd70571316b360f43",
        "documentation/drill.pdf":
            "f7589eb5f7f584fc033f3a86c75438369db6e7096993ab9553ec3d562be5dbdf",
        "documentation/drill.svg":
            "3ab3140d786afd2488cf3fcb8712c48d17a4d77476f774ac8ee45a4ef44afd68",
        "documentation/fabrication.pdf":
            "d3bc7e4d0433dde20cbd51ec5107ba49725563dd8616aed89f318b694be0b076",
        "documentation/fabrication.svg":
            "86c76203e02ffe6a07415e19d06f8f0043788e1aad85a03044740897a59a2680",
    }

    def test_composed_output_matches_the_recorded_digests(self) -> None:
        import hashlib

        from app.release_studio.documents import RENDERER_VERSION

        self.assertEqual(
            RENDERER_VERSION,
            "release-studio-documents/d2",
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
