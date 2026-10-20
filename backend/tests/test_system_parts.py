"""The catalog parts input of ``prism-kicad system build --parts``
(docs/system-builder/CONTRACTS.md §8.10). No database: the catalog is a fake lookup."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.services.design_bundle import schemas
from app.system_builder import parts
from app.system_builder.parts import (
    FootprintAsset,
    ModelAsset,
    ResolvedPart,
    SymbolAsset,
    aligned_bounds,
    build_input,
    digest,
    references,
)

SYMBOL_SHA = "a" * 64
FOOTPRINT_SHA = "b" * 64
STEP_SHA = "c" * 64


def document() -> dict:
    """Two bodies and three body connectors; one connector part is repeated."""

    return {
        "occurrences": [
            {
                "id": "occ_body_a",
                "source": {"kind": "body", "componentId": "cmp_a", "revisionId": "rev_a"},
            },
            {"id": "occ_body_b", "source": {"kind": "body", "componentId": "cmp_b"}},
        ],
        "bodyConnectors": [
            {
                "id": "bcn_1",
                "occurrence": "occ_body_a",
                "refdes": "J1",
                "part": {"componentId": "cmp_c", "revisionId": "rev_c"},
            },
            {"id": "bcn_2", "occurrence": "occ_body_a", "refdes": "J2",
             "part": {"componentId": "cmp_d"}},
            {"id": "bcn_3", "occurrence": "occ_body_b", "refdes": "J1",
             "part": {"componentId": "cmp_d"}},
        ],
    }


class ReferencesTest(unittest.TestCase):
    def test_each_distinct_reference_sorted(self) -> None:
        self.assertEqual(
            references(document()),
            [
                ("cmp_a@rev_a", "cmp_a", "rev_a"),
                ("cmp_b", "cmp_b", None),
                ("cmp_c@rev_c", "cmp_c", "rev_c"),
                ("cmp_d", "cmp_d", None),
            ],
        )

    def test_a_board_is_not_a_part(self) -> None:
        self.assertEqual(
            references({
                "occurrences": [
                    {"id": "occ_board", "source": {"kind": "board", "projectId": "prj_1"}},
                    {"id": "occ_entry", "source": {"kind": "entry", "componentId": "cmp_s"}},
                ],
                "bodyConnectors": [],
            }),
            [],
        )


class BuildInputTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.symbol = self.tmp / "connector.kicad_sym"
        self.symbol.write_text("(kicad_symbol_lib)", encoding="utf-8")
        self.footprint = self.tmp / "connector.kicad_mod"
        self.footprint.write_text("(footprint)", encoding="utf-8")
        self.resolved = {
            ("cmp_a", "rev_a"): ResolvedPart(
                component_id="cmp_a",
                revision_id="rev_a",
                name="Housing",
                mpn="MF40100V2",
                symbol=SymbolAsset(self.symbol, SYMBOL_SHA, "Conn_01x04"),
                footprint=FootprintAsset(self.footprint, FOOTPRINT_SHA),
                model=ModelAsset(
                    glb_key="glb_key_a",
                    step_sha256=STEP_SHA,
                    bounds_min_mm=(-20.0, 0.0, 1.2345678),
                    bounds_max_mm=(20.0, 10.0, 2.0),
                ),
            ),
            ("cmp_b", None): ResolvedPart(
                component_id="cmp_b",
                revision_id="rev_b2",
                name="Bracket",
            ),
            ("cmp_c", "rev_c"): ResolvedPart(
                component_id="cmp_c",
                revision_id="rev_c",
                name="Contact",
                mpn="CONTACT-1",
            ),
            # cmp_d is left for the catalog to refuse.
        }

    def lookup(self, component_id: str, revision_id: str | None) -> ResolvedPart | None:
        return self.resolved.get((component_id, revision_id))

    def test_the_document_is_schema_valid_sorted_and_leaves_out_unresolved(self) -> None:
        built, files = build_input(document(), self.tmp, lookup=self.lookup)
        schemas.validate(built, "prism.system_parts.a0")
        self.assertEqual([entry["ref"] for entry in built["parts"]],
                         ["cmp_a@rev_a", "cmp_b", "cmp_c@rev_c"])
        self.assertNotIn("cmp_d", [entry["ref"] for entry in built["parts"]])
        self.assertEqual(
            {entry["ref"]: entry["revisionId"] for entry in built["parts"]},
            {"cmp_a@rev_a": "rev_a", "cmp_b": "rev_b2", "cmp_c@rev_c": "rev_c"},
        )

    def test_bounds_are_whole_nanometres(self) -> None:
        built, _ = build_input(document(), self.tmp, lookup=self.lookup)
        model = built["parts"][0]["model"]
        self.assertEqual(
            model["boundsMin"], {"xNm": -20_000_000, "yNm": 0, "zNm": 1_234_568}
        )
        self.assertEqual(
            model["boundsMax"], {"xNm": 20_000_000, "yNm": 10_000_000, "zNm": 2_000_000}
        )

    def test_staged_files_are_named_by_sha(self) -> None:
        built, files = build_input(document(), self.tmp, lookup=self.lookup)
        entry = built["parts"][0]
        self.assertEqual(
            entry["symbol"],
            {"path": f"parts/{SYMBOL_SHA}.kicad_sym", "sha256": SYMBOL_SHA, "name": "Conn_01x04"},
        )
        self.assertEqual(
            entry["footprint"],
            {"path": f"parts/{FOOTPRINT_SHA}.kicad_mod", "sha256": FOOTPRINT_SHA},
        )
        self.assertEqual(
            files,
            [
                (self.symbol, Path(f"parts/{SYMBOL_SHA}.kicad_sym")),
                (self.footprint, Path(f"parts/{FOOTPRINT_SHA}.kicad_mod")),
            ],
        )

    def test_staging_copies_each_file(self) -> None:
        built, files = build_input(document(), self.tmp, lookup=self.lookup)
        staging = self.tmp / "staging"
        parts.stage(staging, files)
        for _, relative in files:
            self.assertEqual((staging / relative).read_bytes(),
                             next(source.read_bytes() for source, rel in files if rel == relative))

    def test_a_missing_asset_file_is_not_named_or_staged(self) -> None:
        self.symbol.unlink()
        built, files = build_input(document(), self.tmp, lookup=self.lookup)
        self.assertNotIn("symbol", built["parts"][0])
        self.assertEqual([source for source, _ in files], [self.footprint])


class AlignedBoundsTest(unittest.TestCase):
    def test_a_quarter_turn_about_z_swaps_the_x_and_y_extents(self) -> None:
        low, high = aligned_bounds(
            {"minMm": [0.0, 0.0, 0.0], "maxMm": [10.0, 20.0, 30.0]},
            {"offsetMm": [0.0, 0.0, 0.0], "rotationDeg": [0.0, 0.0, 90.0], "scale": 1.0},
        )
        self.assertAlmostEqual(high[0] - low[0], 20.0)
        self.assertAlmostEqual(high[1] - low[1], 10.0)
        self.assertAlmostEqual(high[2] - low[2], 30.0)

    def test_identity_keeps_the_box(self) -> None:
        self.assertEqual(
            aligned_bounds({"minMm": [-1.0, -2.0, -3.0], "maxMm": [1.0, 2.0, 3.0]}),
            ((-1.0, -2.0, -3.0), (1.0, 2.0, 3.0)),
        )


class DigestTest(unittest.TestCase):
    def test_equal_documents_digest_the_same_and_a_change_moves_it(self) -> None:
        first = {"schema": parts.SCHEMA, "parts": [
            {"ref": "cmp_a", "componentId": "cmp_a", "revisionId": "rev_a", "name": "Housing"}
        ]}
        second = {"schema": parts.SCHEMA, "parts": [
            {"name": "Housing", "revisionId": "rev_a", "componentId": "cmp_a", "ref": "cmp_a"}
        ]}
        changed = {"schema": parts.SCHEMA, "parts": [
            {"ref": "cmp_a", "componentId": "cmp_a", "revisionId": "rev_a", "name": "Other"}
        ]}
        self.assertEqual(digest(first), digest(second))
        self.assertNotEqual(digest(first), digest(changed))


if __name__ == "__main__":
    unittest.main()
