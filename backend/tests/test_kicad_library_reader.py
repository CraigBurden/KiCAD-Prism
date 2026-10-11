"""The KiCad library reader, against real library text.

The KiCad 10 cases read the System Builder fixture library
(``fixtures/system_builder/p2/sources/mezz_base/F0``); the legacy cases use the
KiCad 5 ``(module …)`` footprint form, which libraries still ship.
"""

from __future__ import annotations

import unittest
from pathlib import Path

from app.services import kicad_library_reader
from app.services.kicad_library_reader import FolderInventory

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "system_builder" / "p2" / "sources" / "mezz_base" / "F0"

# A KiCad 5 footprint: `(module NAME …)`, unquoted name and model path.
LEGACY_FOOTPRINT = """(module R_0603_1608Metric (layer F.Cu) (tedit 5B301BBD)
  (descr "Resistor SMD 0603 (1608 Metric)")
  (attr smd)
  (fp_text reference REF** (at 0 -1.43) (layer F.SilkS))
  (pad 1 smd roundrect (at -0.7875 0) (size 0.875 0.95) (layers F.Cu F.Paste F.Mask))
  (model ${KISYS3DMOD}/Resistor_SMD.3dshapes/R_0603_1608Metric.wrl
    (at (xyz 0 0 0))
    (scale (xyz 1 1 1))
    (rotate (xyz 0 0 0))
  )
)
"""


def _fixture(name: str) -> str:
    return (FIXTURE / name).read_text(encoding="utf-8")


class SymbolLibraryTests(unittest.TestCase):
    def test_a_kicad_10_library_lists_its_symbols_without_unit_blocks(self) -> None:
        text = _fixture("PrismFixture.kicad_sym")

        self.assertEqual(
            [name for name, _ in kicad_library_reader.library_symbols(text)],
            ["ADM6_4x30", "ADF6_4x30", "Header_1x04_RA", "Socket_1x04_RA", "Socket_1x04_V", "Conn_Custom_2x05"],
        )
        self.assertEqual(
            kicad_library_reader.symbol_names(text),
            ["ADM6_4x30", "ADF6_4x30", "Header_1x04_RA", "Socket_1x04_RA", "Socket_1x04_V", "Conn_Custom_2x05"],
        )

    def test_a_symbol_block_carries_its_properties_and_nested_units(self) -> None:
        text = _fixture("PrismFixture.kicad_sym")
        block = dict(kicad_library_reader.library_symbols(text))["ADM6_4x30"]
        properties = kicad_library_reader.symbol_properties(block)

        self.assertIn('(symbol "ADM6_4x30_1_1"', block)
        self.assertEqual(properties["Footprint"], "PrismFixture:Samtec_ADM6-30-03.5-L-4-0-A")
        self.assertEqual(properties["Datasheet"], "")
        self.assertEqual(kicad_library_reader.property_value(properties, "footprint"), properties["Footprint"])
        self.assertEqual(kicad_library_reader.property_value(properties, "Data Sheet", "Description"), "ADM6_4x30")

    def test_one_symbol_splits_out_with_the_source_header(self) -> None:
        text = _fixture("PrismFixture.kicad_sym")
        payload = kicad_library_reader.single_symbol_library(text, "ADF6_4x30").decode()

        self.assertTrue(payload.startswith('(kicad_symbol_lib (version 20251024) (generator "prism_fixture")\n'))
        self.assertEqual([name for name, _ in kicad_library_reader.library_symbols(payload)], ["ADF6_4x30"])
        with self.assertRaisesRegex(ValueError, "^Selected symbol was not found in the library$"):
            kicad_library_reader.single_symbol_library(text, "Missing")

    def test_top_level_unit_blocks_belong_to_their_listed_symbol(self) -> None:
        text = '(kicad_symbol_lib (symbol "Amp") (symbol "Amp_1_1") (symbol "Lone_1_1"))'

        self.assertEqual([name for name, _ in kicad_library_reader.library_symbols(text)], ["Amp", "Lone_1_1"])

    def test_custom_fields_and_escapes_survive(self) -> None:
        properties = kicad_library_reader.symbol_properties(
            '(symbol "Part" (property "Value" "10k") '
            '(property "Manufacturer Part Number" "ACME-10K") '
            '(property "Note" "a \\"quoted\\" (word)") '
            '(property "Voltage Rating" "50V"))'
        )
        self.assertEqual(properties["Manufacturer Part Number"], "ACME-10K")
        self.assertEqual(properties["Voltage Rating"], "50V")
        self.assertEqual(properties["Note"], 'a "quoted" (word)')


class FootprintTests(unittest.TestCase):
    def test_a_kicad_10_footprint_names_itself_and_its_model(self) -> None:
        text = _fixture("PrismFixture.pretty/Samtec_ADM6-30-03.5-L-4-0-A.kicad_mod")

        self.assertEqual(kicad_library_reader.footprint_name(text), "Samtec_ADM6-30-03.5-L-4-0-A")
        self.assertEqual(
            kicad_library_reader.model_references(text),
            ["${KIPRJMOD}/../../../vendor/samtec/ADM6-30-03.5-L-4-0-A-TR.stp"],
        )
        self.assertEqual(kicad_library_reader.model_references(_fixture("PrismFixture.pretty/Conn_Custom_2x05.kicad_mod")), [])

    def test_a_legacy_module_names_itself_and_its_unquoted_model(self) -> None:
        self.assertEqual(kicad_library_reader.footprint_name(LEGACY_FOOTPRINT), "R_0603_1608Metric")
        self.assertEqual(
            kicad_library_reader.model_references(LEGACY_FOOTPRINT),
            ["${KISYS3DMOD}/Resistor_SMD.3dshapes/R_0603_1608Metric.wrl"],
        )
        self.assertEqual(kicad_library_reader.footprint_name('(module "Quoted Name" (layer F.Cu))'), "Quoted Name")
        self.assertEqual(kicad_library_reader.footprint_name("(kicad_symbol_lib)"), "")

    def test_the_pretty_directory_is_the_library(self) -> None:
        self.assertEqual(
            kicad_library_reader.footprint_identity("footprints/Resistor_SMD.pretty/R_0603.kicad_mod"),
            ("Resistor_SMD", "R_0603"),
        )
        self.assertEqual(kicad_library_reader.footprint_identity("loose/R_0603.kicad_mod"), ("loose", "R_0603"))


class FolderInventoryTests(unittest.TestCase):
    MODELS = frozenset({".step", ".stp", ".wrl"})

    def _folder(self, *paths: str) -> FolderInventory:
        return FolderInventory([{"relative_path": path} for path in paths])

    def test_a_kicad_10_model_reference_resolves_by_its_unique_name(self) -> None:
        text = _fixture("PrismFixture.pretty/Samtec_ADM6-30-03.5-L-4-0-A.kicad_mod")
        folder = self._folder(
            "PrismFixture.pretty/Samtec_ADM6-30-03.5-L-4-0-A.kicad_mod",
            "vendor/samtec/ADM6-30-03.5-L-4-0-A-TR.stp",
        )
        link = folder.resolve(
            kicad_library_reader.model_references(text)[0],
            owner_relative_path="PrismFixture.pretty/Samtec_ADM6-30-03.5-L-4-0-A.kicad_mod",
            suffixes=self.MODELS,
        )
        self.assertEqual(link.status, "resolved")
        self.assertEqual(link.selected, {"relative_path": "vendor/samtec/ADM6-30-03.5-L-4-0-A-TR.stp"})

    def test_a_path_under_the_folder_root_wins_over_name_matches(self) -> None:
        folder = self._folder("Resistor_SMD.3dshapes/R.wrl", "elsewhere/R.wrl")
        link = folder.resolve(
            "${KISYS3DMOD}/Resistor_SMD.3dshapes/R.wrl",
            owner_relative_path="Resistor_SMD.pretty/R.kicad_mod",
            suffixes=self.MODELS,
        )
        self.assertEqual(link.status, "resolved")
        self.assertEqual(link.selected, {"relative_path": "Resistor_SMD.3dshapes/R.wrl"})

    def test_several_same_named_files_are_ambiguous_and_none_is_selected(self) -> None:
        folder = self._folder("a/Body.step", "b/Body.step")
        link = folder.resolve("${MODELS}/x/Body.step", owner_relative_path="fp.pretty/Body.kicad_mod")

        self.assertEqual(link.status, "ambiguous")
        self.assertIsNone(link.selected)
        self.assertEqual([item["relative_path"] for item in link.candidates], ["a/Body.step", "b/Body.step"])

    def test_a_match_with_the_wrong_suffix_is_missing(self) -> None:
        folder = self._folder("Body.step.txt", "notes/Body.step")
        link = folder.resolve("Body.step", owner_relative_path="fp.pretty/Body.kicad_mod", suffixes=frozenset({".wrl"}))

        self.assertEqual(link.status, "missing")
        self.assertEqual(link.candidates, [])


class BalancedSExpressionTests(unittest.TestCase):
    """The scanner steps between structural characters rather than over all of
    them, so the cases that matter are the ones where a paren is not structural."""

    def test_it_returns_the_offset_past_the_closing_paren(self) -> None:
        text = "(symbol (at 1 2))tail"
        self.assertEqual(
            kicad_library_reader.form_end(text, 0),
            len("(symbol (at 1 2))"),
        )

    def test_parens_inside_a_string_do_not_change_depth(self) -> None:
        text = '(property "Value" "TPS55289 (rev B)")after'
        end = kicad_library_reader.form_end(text, 0)
        self.assertEqual(text[:end], '(property "Value" "TPS55289 (rev B)")')

    def test_an_escaped_quote_does_not_end_the_string(self) -> None:
        text = r'(property "Note" "a \" (b" ) rest'
        end = kicad_library_reader.form_end(text, 0)
        self.assertEqual(text[:end], r'(property "Note" "a \" (b" )')

    def test_an_unterminated_form_reports_no_end(self) -> None:
        self.assertIsNone(
            kicad_library_reader.form_end("(symbol (at 1", 0)
        )

    def test_an_unterminated_string_reports_no_end(self) -> None:
        self.assertIsNone(
            kicad_library_reader.form_end('(property "open', 0)
        )

    def test_an_escaped_backslash_still_closes_the_string(self) -> None:
        # The escape consumes the second backslash, so the quote after it is
        # a real terminator and the following paren is structural again. Read
        # the other way, the string would swallow the rest of the form.
        text = r'(property "Path" "C:\\" ) rest'
        end = kicad_library_reader.form_end(text, 0)
        self.assertEqual(text[:end], r'(property "Path" "C:\\" )')

    def test_an_empty_string_is_not_mistaken_for_an_unterminated_one(self) -> None:
        text = '(property "Value" "")tail'
        end = kicad_library_reader.form_end(text, 0)
        self.assertEqual(text[:end], '(property "Value" "")')

    def test_a_start_past_the_opening_paren_reports_no_end(self) -> None:
        self.assertIsNone(
            kicad_library_reader.form_end("(symbol (at 1 2))", 8 + 9)
        )

    def test_nested_forms_close_at_the_outermost_paren(self) -> None:
        text = "(footprint (pad (at 0 0)) (pad (at 1 1)))after"
        end = kicad_library_reader.form_end(text, 0)
        self.assertEqual(text[:end], "(footprint (pad (at 0 0)) (pad (at 1 1)))")


if __name__ == "__main__":
    unittest.main()
