"""Direct contracts for placement payload rewriting, signing, and DBL naming."""

from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.services.catalog.dbl_export import (  # noqa: E402
    dbl_symbol_library_name,
    part_number_nocolon,
    quote_identifier,
    sexpr_string,
)
from app.services.catalog.placement_payloads import (  # noqa: E402
    remote_library_nickname,
    rewrite_footprint_payload,
    rewrite_symbol_payload,
)
from app.services.catalog.signed_urls import CatalogAssetUrlSigner  # noqa: E402


SYMBOL = (
    '(kicad_symbol_lib (version 20231120) (generator "prism")\n'
    '  (symbol "R_Test"\n'
    '    (property "Reference" "R" (at 0 0 0)\n'
    "      (effects (font (size 1.27 1.27)))\n"
    "    )\n"
    '    (property "Value" "old" (at 0 0 0)\n'
    "      (effects (font (size 1.27 1.27)))\n"
    "    )\n"
    '    (property "Footprint" "Old:FP" (at 0 0 0)\n'
    "      (effects (font (size 1.27 1.27)) hide)\n"
    "    )\n"
    '    (symbol "R_Test_0_1"\n'
    "      (rectangle (start -1 -2) (end 1 2))\n"
    "    )\n"
    "  )\n"
    ")\n"
)


class SymbolRewriteTests(unittest.TestCase):
    def test_metadata_properties_and_footprint_are_rewritten_in_stable_order(self) -> None:
        component = {
            "value": "10k",
            "description": "Resistor",
            "manufacturer": "Prism",
            "mpn": "PG-R-1",
            "extra_fields": {"Tolerance": "1%", "Footprint": "ignored", "Reference": "ignored"},
        }
        with patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "Remote"):
            rewritten = rewrite_symbol_payload(SYMBOL.encode("utf-8"), "remote_prism_fp:R_0402", component).decode(
                "utf-8"
            )
        names = [line.split('"')[1] for line in rewritten.splitlines() if line.strip().startswith("(property ")]
        self.assertEqual(names[:3], ["Reference", "Value", "Footprint"])
        self.assertIn("Tolerance", names)
        self.assertEqual(names.index("SAP Code") + 1, names.index("Tolerance"))
        self.assertIn('(property "Value" "10k" (at 0 0 0)\n      (effects (font (size 1.27 1.27)))\n', rewritten)
        self.assertIn('(property "Footprint" "remote_prism_fp:R_0402"', rewritten)
        self.assertIn('(property "Manufacturer Part Number" "PG-R-1"', rewritten)
        self.assertEqual(rewritten.count('(property "Footprint"'), 1)
        self.assertTrue(rewritten.endswith('    (symbol "R_Test_0_1"\n      (rectangle (start -1 -2) (end 1 2))\n    )\n  )\n)\n'))
        self.assertEqual(
            rewrite_symbol_payload(SYMBOL.encode("utf-8"), "remote_prism_fp:R_0402", component),
            rewritten.encode("utf-8"),
        )

    def test_placement_stamp_is_hidden_last_and_idempotent(self) -> None:
        component = {
            "id": "0F1E2D3C-0000-4000-8000-000000000001",
            "revision_id": "0f1e2d3c-0000-4000-8000-0000000000a1",
            "value": "10k",
            "extra_fields": {"Tolerance": "1%", "Prism_Revision": "spoof", "prism_component": "spoof"},
        }
        stamped = rewrite_symbol_payload(SYMBOL.encode("utf-8"), "lib:FP", component, stamp=True)
        text = stamped.decode("utf-8")
        names = [line.split('"')[1] for line in text.splitlines() if line.strip().startswith("(property ")]
        self.assertEqual(names[-3:], ["Tolerance", "Prism_Component", "Prism_Revision"])
        self.assertEqual(sum(name.lower().startswith("prism_") for name in names), 2)
        self.assertIn(
            '(property "Prism_Component" "0f1e2d3c-0000-4000-8000-000000000001" (at 0 0 0)\n'
            "      (effects (font (size 1.27 1.27)) hide)\n",
            text,
        )
        self.assertIn(
            '(property "Prism_Revision" "0f1e2d3c-0000-4000-8000-0000000000a1" (at 0 0 0)\n'
            "      (effects (font (size 1.27 1.27)) hide)\n",
            text,
        )
        self.assertNotIn("spoof", text)
        # Same inputs give the same bytes, and re-placing the stamped output
        # (or a stored symbol that already carries a stamp) does not duplicate it.
        self.assertEqual(rewrite_symbol_payload(SYMBOL.encode("utf-8"), "lib:FP", component, stamp=True), stamped)
        self.assertEqual(rewrite_symbol_payload(stamped, "lib:FP", component, stamp=True), stamped)

        next_revision = {**component, "revision_id": "0f1e2d3c-0000-4000-8000-0000000000a2"}
        restamped = rewrite_symbol_payload(stamped, "lib:FP", next_revision, stamp=True).decode("utf-8")
        self.assertIn('(property "Prism_Revision" "0f1e2d3c-0000-4000-8000-0000000000a2"', restamped)
        self.assertNotIn("0000000000a1", restamped)
        self.assertEqual(restamped.count('(property "Prism_Revision"'), 1)

    def test_stamp_is_opt_in_and_needs_both_catalog_ids(self) -> None:
        component = {"id": "c1", "revision_id": "r1", "value": "10k"}
        unstamped = rewrite_symbol_payload(SYMBOL.encode("utf-8"), "lib:FP", component).decode("utf-8")
        self.assertNotIn("Prism_", unstamped)
        no_revision = rewrite_symbol_payload(SYMBOL.encode("utf-8"), "lib:FP", {"id": "c1"}, stamp=True)
        self.assertNotIn(b"Prism_", no_revision)

    def test_only_the_two_stamp_names_are_reserved(self) -> None:
        component = {
            "id": "c1",
            "revision_id": "r1",
            "value": "10k",
            "extra_fields": {"prism_internal_sku": "SKU-7", "Prism_Revision": "custom"},
        }
        stored = SYMBOL.replace(
            '    (symbol "R_Test_0_1"',
            '    (property "prism_component" "stale" (at 0 0 0)\n'
            "      (effects (font (size 1.27 1.27)) hide)\n"
            "    )\n"
            '    (symbol "R_Test_0_1"',
        ).encode("utf-8")

        def names(payload: bytes) -> list[str]:
            return [
                line.split('"')[1]
                for line in payload.decode("utf-8").splitlines()
                if line.strip().startswith("(property ")
            ]

        # Without the stamp (the DBL export) the output is what it was before
        # the stamp existed: nothing reserved is dropped or added.
        unstamped = rewrite_symbol_payload(stored, "lib:FP", component)
        self.assertEqual(
            names(unstamped)[:4] + names(unstamped)[-3:],
            ["Reference", "Value", "Footprint", "prism_component", "SAP Code", "Prism_Revision", "prism_internal_sku"],
        )
        self.assertIn(b'(property "Prism_Revision" "custom"', unstamped)
        self.assertIn(b'(property "prism_component" "stale"', unstamped)

        stamped = rewrite_symbol_payload(stored, "lib:FP", component, stamp=True)
        self.assertEqual(names(stamped)[-3:], ["prism_internal_sku", "Prism_Component", "Prism_Revision"])
        self.assertIn(b'(property "prism_internal_sku" "SKU-7"', stamped)
        self.assertNotIn(b"stale", stamped)
        self.assertNotIn(b"custom", stamped)

    def test_symbol_without_properties_is_returned_unchanged(self) -> None:
        payload = b'(kicad_symbol_lib (version 1) (generator "x")\n  (symbol "Bare"\n  )\n)\n'
        self.assertEqual(rewrite_symbol_payload(payload, None, None), payload)

    def test_missing_footprint_ref_keeps_the_existing_footprint_block(self) -> None:
        rewritten = rewrite_symbol_payload(SYMBOL.encode("utf-8"), None, None).decode("utf-8")
        self.assertIn('(property "Footprint" "Old:FP"', rewritten)


class FootprintRewriteTests(unittest.TestCase):
    def test_model_paths_point_at_the_remote_destination(self) -> None:
        payload = (
            '(footprint "R_0402"\n'
            '  (model "${KICAD8_3DMODEL_DIR}/R.step" (offset (xyz 0 0 0)))\n'
            '  (model "other.wrl")\n'
            ")\n"
        ).encode("utf-8")
        models = [{"canonical_path": "/store/3dmodel/Lib/R.step"}]
        with (
            patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "Remote"),
            patch.object(settings, "REMOTE_PROVIDER_DESTINATION_DIR", "/RemoteLibrary"),
        ):
            rewritten = rewrite_footprint_payload(payload, {}, models).decode("utf-8")
        self.assertIn('(model "${KIPRJMOD}/RemoteLibrary/remote_3d/R.step" (offset', rewritten)
        self.assertIn('(model "other.wrl")', rewritten)

    def test_no_models_leaves_bytes_untouched(self) -> None:
        payload = b'(footprint "R_0402"\n  (model "x.step")\n)\n'
        self.assertEqual(rewrite_footprint_payload(payload, {}, []), payload)

    def test_remote_library_nickname_is_sanitized_and_lowercase(self) -> None:
        with patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "Remote Lib"):
            self.assertEqual(remote_library_nickname("Prism Footprints"), "remote_lib_prism_footprints")


class SignedUrlTests(unittest.TestCase):
    def test_signature_binds_asset_revision_representation_and_expiry(self) -> None:
        with (
            patch.object(settings, "SESSION_SECRET", "secret"),
            patch("app.services.catalog.signed_urls.time.time", return_value=1_700_000_000),
        ):
            url = CatalogAssetUrlSigner.build_signed_asset_url("a1", "r1", "https://prism/", representation_id="rep1")
            self.assertTrue(url.startswith("https://prism/api/remote-provider/assets/a1?rev=r1&representation=rep1&exp=1700000300&sig="))
            sig = url.rsplit("sig=", 1)[1]
            self.assertTrue(CatalogAssetUrlSigner.validate_asset_signature("a1", "r1", 1_700_000_300, sig, "rep1"))
            self.assertFalse(CatalogAssetUrlSigner.validate_asset_signature("a1", "r2", 1_700_000_300, sig, "rep1"))
            self.assertFalse(CatalogAssetUrlSigner.validate_asset_signature("a1", "r1", 1_700_000_300, sig, ""))
        with (
            patch.object(settings, "SESSION_SECRET", "secret"),
            patch("app.services.catalog.signed_urls.time.time", return_value=1_700_000_300),
        ):
            self.assertFalse(CatalogAssetUrlSigner.validate_asset_signature("a1", "r1", 1_700_000_300, sig, "rep1"))

    def test_missing_secret_refuses_to_sign(self) -> None:
        with patch.object(settings, "SESSION_SECRET", ""), self.assertRaises(RuntimeError):
            CatalogAssetUrlSigner.sign("anything")


class DblNamingTests(unittest.TestCase):
    def test_helpers_are_stable(self) -> None:
        self.assertEqual(part_number_nocolon("  LM:317 T "), "LM_317_T")
        self.assertEqual(part_number_nocolon(":::"), "_")
        self.assertEqual(part_number_nocolon(""), "PART")
        self.assertEqual(quote_identifier('Res "1"'), '"Res ""1"""')
        self.assertEqual(sexpr_string('a"b\\c'), 'a\\"b\\\\c')
        self.assertEqual(dbl_symbol_library_name("PN", None), "")
        self.assertEqual(
            dbl_symbol_library_name("PN", {"target_library": "Lib A", "target_name": "R Test"}),
            "Prism_PN_Lib_A_R_Test",
        )


if __name__ == "__main__":
    unittest.main()
