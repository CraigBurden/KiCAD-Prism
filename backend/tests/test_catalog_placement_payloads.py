"""Direct contracts for placement payload rewriting, signing, and DBL naming."""

from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.services.catalog.asset_files import CatalogAssetFiles  # noqa: E402
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
from app.services.catalog.runtime import CatalogRuntime  # noqa: E402
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

    def test_models_are_matched_to_nodes_by_file_name_not_asset_order(self) -> None:
        payload = (
            '(footprint "SW_Combo"\n'
            '  (model "${KICAD8_3DMODEL_DIR}/Button/Zeta_Cap.STEP" (offset (xyz 0 0 0)))\n'
            '  (model "${KICAD8_3DMODEL_DIR}/Switch/alpha_body.step")\n'
            ")\n"
        ).encode("utf-8")
        # Revision assets are ordered by target_name, not by node order.
        models = [
            {"canonical_path": "/store/3dmodel/Lib/alpha_body.step"},
            {"canonical_path": "/store/3dmodel/Lib/zeta_cap.step"},
        ]
        with (
            patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "Remote"),
            patch.object(settings, "REMOTE_PROVIDER_DESTINATION_DIR", "/RemoteLibrary"),
        ):
            rewritten = rewrite_footprint_payload(payload, {}, models).decode("utf-8")
        self.assertEqual(
            rewritten,
            '(footprint "SW_Combo"\n'
            '  (model "${KIPRJMOD}/RemoteLibrary/remote_3d/zeta_cap.step" (offset (xyz 0 0 0)))\n'
            '  (model "${KIPRJMOD}/RemoteLibrary/remote_3d/alpha_body.step")\n'
            ")\n",
        )

    def test_single_model_output_is_unchanged_when_names_differ(self) -> None:
        payload = b'(footprint "R_0402"\n  (model "${KICAD8_3DMODEL_DIR}/legacy.wrl" (offset (xyz 0 0 0)))\n)\n'
        models = [{"canonical_path": "/store/3dmodel/Lib/R.step"}]
        with (
            patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "Remote"),
            patch.object(settings, "REMOTE_PROVIDER_DESTINATION_DIR", "/RemoteLibrary"),
        ):
            rewritten = rewrite_footprint_payload(payload, {}, models)
        self.assertEqual(
            rewritten,
            b'(footprint "R_0402"\n  (model "${KIPRJMOD}/RemoteLibrary/remote_3d/R.step" (offset (xyz 0 0 0)))\n)\n',
        )

    def _rewrite(self, node_paths: list[str], asset_paths: list[str]) -> list[str]:
        payload = '(footprint "F"\n' + "".join(f'  (model "{path}")\n' for path in node_paths) + ")\n"
        with (
            patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "Remote"),
            patch.object(settings, "REMOTE_PROVIDER_DESTINATION_DIR", "/RemoteLibrary"),
        ):
            rewritten = rewrite_footprint_payload(
                payload.encode("utf-8"), {}, [{"canonical_path": path} for path in asset_paths]
            ).decode("utf-8")
        return [line.split('"')[1] for line in rewritten.splitlines() if line.strip().startswith("(model ")]

    def test_fallback_never_reuses_a_name_matched_asset(self) -> None:
        assets = ["/store/3dmodel/Lib/alpha.step", "/store/3dmodel/Lib/zeta.step"]
        out = "${KIPRJMOD}/RemoteLibrary/remote_3d/"
        self.assertEqual(
            self._rewrite(["${M}/zeta.step", "${M}/legacy_body.wrl"], assets),
            [out + "zeta.step", out + "alpha.step"],
        )
        self.assertEqual(
            self._rewrite(["${M}/legacy_body.wrl", "${M}/alpha.step"], assets),
            [out + "zeta.step", out + "alpha.step"],
        )

    def test_exact_case_wins_over_case_insensitive_match(self) -> None:
        assets = ["/store/3dmodel/A/Part.step", "/store/3dmodel/B/part.step"]
        out = "${KIPRJMOD}/RemoteLibrary/remote_3d/"
        self.assertEqual(self._rewrite(["x/Part.step", "y/part.step"], assets), [out + "Part.step", out + "part.step"])
        self.assertEqual(self._rewrite(["y/part.step", "x/Part.step"], assets), [out + "part.step", out + "Part.step"])

    def test_uploaded_names_match_through_upload_normalization(self) -> None:
        runtime = CatalogRuntime(store_root=Path("/store"))
        assets = [
            str(CatalogAssetFiles.aux_destination(runtime, "3dmodel", "Lib", name))
            for name in ("alpha body.step", "zeta cap.step")
        ]
        self.assertEqual([Path(path).name for path in assets], ["alpha_body.step", "zeta_cap.step"])
        out = "${KIPRJMOD}/RemoteLibrary/remote_3d/"
        self.assertEqual(
            self._rewrite(["${M}/zeta cap.step", "${M}/alpha body.step"], assets),
            [out + "zeta_cap.step", out + "alpha_body.step"],
        )

    def test_repeated_references_share_their_matched_asset(self) -> None:
        assets = ["/store/3dmodel/Lib/alpha.step", "/store/3dmodel/Lib/zeta.step"]
        out = "${KIPRJMOD}/RemoteLibrary/remote_3d/"
        self.assertEqual(self._rewrite(["${M}/zeta.step", "${M}/zeta.step"], assets), [out + "zeta.step"] * 2)
        self.assertEqual(
            self._rewrite(["${M}/zeta.step", "legacy.wrl", "x/ZETA.step", "${M}/zeta.step"], assets),
            [out + "zeta.step", out + "alpha.step", out + "zeta.step", out + "zeta.step"],
        )

    def test_upload_normalization_and_case_compose(self) -> None:
        assets = ["/store/3dmodel/Lib/alpha_body.step", "/store/3dmodel/Lib/zeta_cap.step"]
        out = "${KIPRJMOD}/RemoteLibrary/remote_3d/"
        self.assertEqual(
            self._rewrite(["${M}/zeta cap.STEP", "${M}/alpha body.STEP"], assets),
            [out + "zeta_cap.step", out + "alpha_body.step"],
        )

    def test_ambiguous_tier_defers_to_the_first_unique_one(self) -> None:
        # "i̇" sanitizes to "i_", which two assets share, but casefolds
        # to the same text as "İ", which only one asset has.
        assets = ["/store/3dmodel/A/i_.step", "/store/3dmodel/B/i_.step", "/store/3dmodel/C/İ.step"]
        self.assertEqual(
            self._rewrite(["${M}/i̇.step"], assets), ["${KIPRJMOD}/RemoteLibrary/remote_3d/İ.step"]
        )

    def test_single_asset_keeps_positional_pick_for_several_nodes(self) -> None:
        out = "${KIPRJMOD}/RemoteLibrary/remote_3d/R.step"
        assets = ["/store/3dmodel/Lib/R.step"]
        self.assertEqual(self._rewrite(["legacy.wrl", "${M}/R.step"], assets), [out, "${M}/R.step"])
        self.assertEqual(self._rewrite(["${M}/R.step", "${M}/R.step"], assets), [out, "${M}/R.step"])

    def test_unmatched_nodes_keep_positional_order(self) -> None:
        assets = ["/store/3dmodel/Lib/b.step", "/store/3dmodel/Lib/a.step"]
        out = "${KIPRJMOD}/RemoteLibrary/remote_3d/"
        self.assertEqual(
            self._rewrite(["x.wrl", "y.wrl", "z.wrl"], assets), [out + "b.step", out + "a.step", "z.wrl"]
        )

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
