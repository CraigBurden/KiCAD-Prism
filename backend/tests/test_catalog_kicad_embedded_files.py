"""KiCad embedded-file encoding and 3D model embedding at placement."""

from __future__ import annotations

import base64
import gzip
import hashlib
from pathlib import Path
import random
import re
import sys
import tempfile
import unittest
from unittest.mock import patch

import zstandard

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.services.catalog import embedded_model_copies, kicad_embedded_files, placement_payloads  # noqa: E402
from app.services.catalog.embedded_model_copies import CompressedModelCopies  # noqa: E402
from app.services.catalog.kicad_embedded_files import (  # noqa: E402
    compress_model,
    decode_embedded_files,
    original_model_name,
    embedded_file_form,
    embedded_model_name,
    kicad_mmh3_128,
)
from app.services.catalog.placement_payloads import materialize_asset, rewrite_footprint_payload  # noqa: E402


FIXTURE_BOARD = (
    Path(__file__).resolve().parents[2] / "fixtures/release-studio/usb-pd/USB-PD-Trigger-Board.kicad_pcb"
)
_FILE_RE = re.compile(
    r'\(name "([^"]+)"\)\s*\(type model\)\s*\(data \|(.*?)\|\s*\)\s*\(checksum "([0-9A-F]{32})"\)',
    re.S,
)
FOOTPRINT = (
    '(footprint "R_0402"\n'
    "\t(version 20241229)\n"
    '\t(model "${KICAD9_3DMODEL_DIR}/Resistor_SMD.3dshapes/R_0402.step"\n'
    "\t\t(offset\n\t\t\t(xyz 0 0 0)\n\t\t)\n"
    "\t)\n"
    ")\n"
).encode("utf-8")
MODEL_ASSET = {"canonical_path": "/store/3dmodels/Lib/R_0402.step"}

# KiCad's checksum of bytes((i * 37 + 11) & 0xFF for i in range(length)).
# Produced outside the repository by compiling a small C++ harness against
# the unmodified libs/kimath/include/mmh3_hash.h and hash_128.h of KiCad
# 10.0.4 (mmh3_hash.h sha256 5e6d2cb0fe3f50f7898ef6360580e2a0687da8998a5b87306e2d5e83fb3fd4b7),
# calling MMH3_HASH(0xABBA2345).add(std::vector<char>).digest().ToString() as
# EMBEDDED_FILES does. Lengths 0-48 cover every tail length three times.
KICAD_MMH3_VECTORS = [
    (0, "0A8AD5D826E19AE9B0771881583631B3"),
    (1, "A126F447BDC35AC4AF8BDD38DA564CF8"),
    (2, "922E94AD1895FC21F16A0DB5467E9A33"),
    (3, "EF341B9FA583B65EDF567CE91723CBAD"),
    (4, "8262CA37315AACCB460488ED2850C3DF"),
    (5, "2021D5A29839117B0857C1E0E05A7839"),
    (6, "F35B8C80DC4BB121974BBB1F50F18A97"),
    (7, "0318BBC6E5CF26F7389780EF5FF2BD4F"),
    (8, "2D87A82005F4FA83795D29A5FC815DD5"),
    (9, "58FFDBEBC80B2DB1715A3787C754D4DC"),
    (10, "B8B8DB45F2F27DCF9EDF2300B4BBB6B7"),
    (11, "FD241A67C556551A9A9D67AA92016692"),
    (12, "0FC02384A29118F69FFB8F37551022E3"),
    (13, "0FC02384A29118F69FFB8F37551022E3"),
    (14, "0FC02384A29118F69FFB8F37551022E3"),
    (15, "0FC02384A29118F69FFB8F37551022E3"),
    (16, "53A8479D112E79788C755A75172A5E62"),
    (17, "46577AE8025048DD99B669FE11967479"),
    (18, "0B1B60FF0768AB18901147C511DF0D46"),
    (19, "69220354A8D833592433E822F1E0BD12"),
    (20, "A24B02A52175608AB61871716B5986AC"),
    (21, "1293A6BB35BEB35C01EA91D51C2C79C9"),
    (22, "FE480492EF134E5AC1E4503CF3E10B2A"),
    (23, "ACA5BF8CF4C8C8B50FCC2732F0AD48A9"),
    (24, "C20C7AED3BC1D8DF1C25F25BA87A5172"),
    (25, "B7C5B6176AC5F44A65AB549CB53629E3"),
    (26, "DD215E5222C52F0CDBEB0F4990D40E71"),
    (27, "AABF6DF41581FC058EEF891F57203198"),
    (28, "2E7AAF159F46C8C89ED03431A9F127D5"),
    (29, "2E7AAF159F46C8C89ED03431A9F127D5"),
    (30, "2E7AAF159F46C8C89ED03431A9F127D5"),
    (31, "2E7AAF159F46C8C89ED03431A9F127D5"),
    (32, "E3E10E60AA79155A8C018ECA54867F21"),
    (33, "382F77203FBF221BD552A85277E6FFB5"),
    (34, "016425240D771D7642114A3C825ABE9B"),
    (35, "E54126ED6783928B770B3D8AA0CD8E8B"),
    (36, "D06E87E757ECD19F393B86AAEF7DC26B"),
    (37, "2E9D5AEBA705505A7E3BE43697B87082"),
    (38, "1585ABBD91890FECB903568276FFC41D"),
    (39, "FE8DA7CF9B883ACA10CDA75BF7561DCD"),
    (40, "829E443A61D28E6143C1A698E1211B70"),
    (41, "FCE96C463EFBE9BA177887F347F08689"),
    (42, "2DD46C7CD4629868086FD91510DCD223"),
    (43, "A7696F1363F783F7C6B68F2E9720DBB5"),
    (44, "D9BB2BDD2EA646809ACC5A2506FC4D4A"),
    (45, "D9BB2BDD2EA646809ACC5A2506FC4D4A"),
    (46, "D9BB2BDD2EA646809ACC5A2506FC4D4A"),
    (47, "D9BB2BDD2EA646809ACC5A2506FC4D4A"),
    (48, "E7A912C250C3A8711E5542EADA6CB549"),
    (63, "522A8629B1F08CDE8BB4A17846638F39"),
    (64, "58C508191751C96CE702D7AA2A601CFC"),
    (65, "4CBB63A95F0019E44363CC3ACA5E636F"),
    (100, "18FEA6438BC355BCB2F5FFEDFABEC146"),
    (1000, "1C78DD6091BC30420B65AEC62F0AFD3B"),
    (4099, "FD7F41F49B5713B7D46B6766E3DF19B6"),
]


def step_model(tag: bytes) -> bytes:
    """A small STEP-like model that compresses well, as real STEP files do."""
    return b"ISO-10303-21;\nHEADER;\n" + tag + b"\nDATA;\n" + b"#1=CARTESIAN_POINT('',(0.,0.,0.));\n" * 200 + b"END-ISO-10303-21;\n"


def wrz_model(seed: int, size: int) -> bytes:
    """A gzip-compressed VRML model, which zstd cannot shrink further."""
    noise = base64.b64encode(random.Random(seed).randbytes(size))
    return gzip.compress(b"#VRML V2.0 utf8\n# " + noise + b"\nShape { geometry Box { size 1 1 1 } }\n", mtime=0)


def decode_embedded(text: str) -> dict[str, tuple[bytes, str]]:
    """Return ``name -> (decompressed data, checksum)`` for every embedded file."""
    files = {}
    for name, data, checksum in _FILE_RE.findall(text):
        compressed = base64.b64decode(re.sub(r"\s", "", data))
        files[name] = (zstandard.ZstdDecompressor().decompress(compressed), checksum)
    return files


def rewrite(payload: bytes, model_bytes: bytes) -> str:
    with (
        patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "remote"),
        patch.object(settings, "REMOTE_PROVIDER_DESTINATION_DIR", "${KIPRJMOD}/RemoteLibrary"),
    ):
        return rewrite_footprint_payload(payload, {}, [MODEL_ASSET], lambda _asset: model_bytes).decode("utf-8")


class EncoderTests(unittest.TestCase):
    def test_encoder_reproduces_kicad_written_blocks_byte_for_byte(self) -> None:
        text = FIXTURE_BOARD.read_text(encoding="utf-8")
        blocks = _FILE_RE.findall(text)
        self.assertEqual(len(blocks), 2)
        for name, data, checksum in blocks:
            encoded = re.sub(r"\s", "", data)
            raw = zstandard.ZstdDecompressor().decompress(base64.b64decode(encoded))
            self.assertEqual(kicad_mmh3_128(raw), checksum, name)
            compressed = compress_model(raw)
            self.assertEqual(base64.b64encode(compressed).decode("ascii"), encoded, name)
            form = embedded_file_form(name, raw, compressed, "\t\t", "\t")
            self.assertEqual(
                [line.strip() for line in form.splitlines()[3:-3]],
                [line.strip() for line in f"(data |{data}|".splitlines()],
            )

    def test_decoder_reads_kicad_written_board_files(self) -> None:
        text = FIXTURE_BOARD.read_text(encoding="utf-8")
        decoded = decode_embedded_files(text)
        self.assertEqual(len(decoded), 2)
        for name, data, checksum in _FILE_RE.findall(text):
            self.assertEqual(kicad_mmh3_128(decoded[name]["data"]), checksum, name)
            self.assertEqual(decoded[name]["type"], "model")

    def test_decoder_reads_back_what_placement_embeds(self) -> None:
        model = step_model(b"decode")
        name = embedded_model_name("R 0402.step", model)
        decoded = decode_embedded_files(rewrite(FOOTPRINT, model))
        self.assertEqual(decoded[name]["data"], model)
        self.assertEqual(original_model_name(name, model), "R_0402.step")
        self.assertEqual(original_model_name(name, model + b"x"), name, "a foreign digest is kept")

    def test_checksum_matches_kicad_for_every_tail_length(self) -> None:
        for length, expected in KICAD_MMH3_VECTORS:
            with self.subTest(length=length):
                self.assertEqual(kicad_mmh3_128(bytes((i * 37 + 11) & 0xFF for i in range(length))), expected)

    def test_embedded_name_is_unique_per_content(self) -> None:
        self.assertEqual(embedded_model_name("R 0402.step", b"a"), embedded_model_name("R 0402.step", b"a"))
        self.assertNotEqual(embedded_model_name("R.step", b"a"), embedded_model_name("R.step", b"b"))
        self.assertRegex(embedded_model_name("R (1).step", b"a"), r"^R__1_-[0-9a-f]{12}\.step$")


class FootprintEmbeddingTests(unittest.TestCase):
    def test_embedded_model_round_trips_to_the_asset_bytes(self) -> None:
        model = b"ISO-10303-21;\nHEADER;\n" + b"DATA;\n" * 500 + b"END-ISO-10303-21;\n"
        text = rewrite(FOOTPRINT, model)
        name = embedded_model_name("R_0402.step", model)
        self.assertIn(f'\t(model "kicad-embed://{name}"\n', text)
        self.assertNotIn("RemoteLibrary", text)
        self.assertTrue(text.endswith("\t(embedded_files\n\t\t(file\n" + text.split("\t\t(file\n", 1)[1]))
        files = decode_embedded(text)
        self.assertEqual(list(files), [name])
        data, checksum = files[name]
        self.assertEqual(hashlib.sha256(data).hexdigest(), hashlib.sha256(model).hexdigest())
        self.assertEqual(checksum, kicad_mmh3_128(model))

    def test_output_is_byte_identical_across_runs(self) -> None:
        model = b"ISO-10303-21;" + bytes(range(256)) * 64
        self.assertEqual(rewrite(FOOTPRINT, model), rewrite(FOOTPRINT, model))

    def test_model_that_would_grow_the_footprint_more_than_itself_stays_external(self) -> None:
        text = rewrite(FOOTPRINT, wrz_model(1, 4096))
        self.assertIn('(model "${KIPRJMOD}/RemoteLibrary/remote_3d/R_0402.step"', text)
        self.assertNotIn("embedded_files", text)
        self.assertNotIn("embedded_files", rewrite(FOOTPRINT, b"ISO-10303-21;END-ISO-10303-21;"))

    def test_embedding_never_grows_the_placement_shipment(self) -> None:
        """Codex's review case: incompressible .wrz models next to a STEP model.

        Before the fix the smaller .wrz was embedded while the larger one fell
        back, so the shipment grew past what fit without embedding.
        """
        cases = {
            "two_wrz": {"small.wrz": wrz_model(697, 40_000), "large.wrz": wrz_model(698, 200_000)},
            "step_and_wrz": {"body.step": step_model(b"body"), "large.wrz": wrz_model(699, 200_000)},
        }
        expected_embedded = {"two_wrz": set(), "step_and_wrz": {"body.step"}}
        for case, models in cases.items():
            with self.subTest(case=case), tempfile.TemporaryDirectory() as tmp:
                assets = []
                for name, content in models.items():
                    (Path(tmp) / name).write_bytes(content)
                    assets.append({"id": name, "asset_type": "3dmodel", "canonical_path": str(Path(tmp) / name)})
                nodes = "".join(f'  (model "{name}")\n' for name in models)
                (Path(tmp) / "Review.kicad_mod").write_text(f'(footprint "Review"\n{nodes})\n', encoding="utf-8")
                footprint = {"id": "fp", "asset_type": "footprint", "canonical_path": str(Path(tmp) / "Review.kicad_mod")}
                assets.append(footprint)

                def shipment(embed: bool) -> int:
                    placed = materialize_asset(footprint, assets, {}, embed_models=embed)
                    embedded = set(placed.get("embedded_model_ids", []))
                    shipped = [len(models[a["id"]]) for a in assets if a["asset_type"] == "3dmodel" and a["id"] not in embedded]
                    return placed["size_bytes"] + sum(shipped)

                placed = materialize_asset(footprint, assets, {}, embed_models=True)
                self.assertEqual(set(placed["embedded_model_ids"]), expected_embedded[case])
                self.assertLessEqual(shipment(True), shipment(False))

    def test_footprint_cap_boundary_counts_the_compressed_data(self) -> None:
        model = step_model(b"cap")
        name = embedded_model_name("R_0402.step", model)
        compressed_size = len(compress_model(model))
        with patch.object(settings, "REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES", compressed_size):
            self.assertIn(f'(model "kicad-embed://{name}"', rewrite(FOOTPRINT, model))
        with (
            patch.object(settings, "REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES", compressed_size - 1),
            patch.object(kicad_embedded_files, "kicad_mmh3_128") as checksum,
        ):
            text = rewrite(FOOTPRINT, model)
        checksum.assert_not_called()
        self.assertIn('(model "${KIPRJMOD}/RemoteLibrary/remote_3d/R_0402.step"', text)
        self.assertNotIn("embedded_files", text)

    def test_footprint_cap_is_shared_by_its_models_in_node_order(self) -> None:
        payload = FOOTPRINT.replace(b"\t(model ", b'\t(model "Z_other.step")\n\t(model ')
        models = [MODEL_ASSET, {"canonical_path": "/store/3dmodels/Lib/Z_other.step"}]
        data = {"R_0402.step": step_model(b"first"), "Z_other.step": step_model(b"second")}
        compressed = {file_name: compress_model(raw) for file_name, raw in data.items()}
        with (
            patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "remote"),
            patch.object(settings, "REMOTE_PROVIDER_DESTINATION_DIR", "${KIPRJMOD}/RemoteLibrary"),
            patch.object(
                settings,
                "REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES",
                len(compressed["Z_other.step"]) + len(compressed["R_0402.step"]) - 1,
            ),
        ):
            text = rewrite_footprint_payload(
                payload, {}, models, lambda asset: data[Path(asset["canonical_path"]).name]
            ).decode("utf-8")
        self.assertIn(f'(model "kicad-embed://{embedded_model_name("Z_other.step", data["Z_other.step"])}"', text)
        self.assertIn('(model "${KIPRJMOD}/RemoteLibrary/remote_3d/R_0402.step"', text)

    def test_model_larger_than_the_cap_still_embeds_when_it_compresses(self) -> None:
        model = step_model(b"large") * 720
        name = embedded_model_name("R_0402.step", model)
        with patch.object(settings, "REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES", len(model) // 4):
            text = rewrite(FOOTPRINT, model)
        self.assertIn(f'(model "kicad-embed://{name}"', text)
        self.assertEqual(decode_embedded(text)[name][0], model)

    def test_raw_ceiling_is_shared_by_the_models_of_a_footprint(self) -> None:
        payload = FOOTPRINT.replace(b"\t(model ", b'\t(model "Z_other.step")\n\t(model ')
        models = [MODEL_ASSET, {"canonical_path": "/store/3dmodels/Lib/Z_other.step"}]
        data = {"R_0402.step": step_model(b"first"), "Z_other.step": step_model(b"second")}
        with (
            patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "remote"),
            patch.object(settings, "REMOTE_PROVIDER_DESTINATION_DIR", "${KIPRJMOD}/RemoteLibrary"),
            patch.object(placement_payloads, "EMBED_MAX_RAW_MODEL_BYTES", len(data["Z_other.step"]) + 1),
            patch.object(placement_payloads, "compress_model", wraps=compress_model) as compress,
        ):
            text = rewrite_footprint_payload(
                payload, {}, models, lambda asset: data[Path(asset["canonical_path"]).name]
            ).decode("utf-8")
        self.assertEqual(compress.call_count, 1)
        self.assertIn(f'(model "kicad-embed://{embedded_model_name("Z_other.step", data["Z_other.step"])}"', text)
        self.assertIn('(model "${KIPRJMOD}/RemoteLibrary/remote_3d/R_0402.step"', text)

    def test_different_model_bytes_yield_different_embedded_content(self) -> None:
        first = decode_embedded(rewrite(FOOTPRINT, step_model(b"rev1")))
        second = decode_embedded(rewrite(FOOTPRINT, step_model(b"rev2")))
        self.assertNotEqual(list(first), list(second))
        self.assertNotEqual(first.popitem()[1], second.popitem()[1])

    def test_nodes_sharing_an_asset_embed_it_once(self) -> None:
        payload = FOOTPRINT.replace(b"\t(model ", b'\t(model "R_0402.step")\n\t(model ')
        reads = []
        with (
            patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "remote"),
            patch.object(settings, "REMOTE_PROVIDER_DESTINATION_DIR", "${KIPRJMOD}/RemoteLibrary"),
        ):
            text = rewrite_footprint_payload(
                payload,
                {},
                [MODEL_ASSET, {"canonical_path": "/store/3dmodels/Lib/Z_other.step"}],
                lambda asset: reads.append(asset) or step_model(b"shared"),
            ).decode("utf-8")
        name = embedded_model_name("R_0402.step", step_model(b"shared"))
        self.assertEqual(text.count(f'(model "kicad-embed://{name}"'), 2)
        self.assertEqual(list(decode_embedded(text)), [name])
        self.assertEqual(reads, [MODEL_ASSET])

    def test_embedded_files_text_inside_strings_is_not_a_block(self) -> None:
        payload = FOOTPRINT.replace(
            b"\t(version 20241229)\n",
            b'\t(version 20241229)\n\t(descr "An (embedded_files) example \\" (embedded_files")\n',
        )
        text = rewrite(payload, step_model(b"descr"))
        self.assertIn('\t(descr "An (embedded_files) example \\" (embedded_files")\n', text)
        self.assertEqual(text.count("\t(embedded_files\n\t\t(file\n"), 1)
        self.assertTrue(text.endswith("\t\t)\n\t)\n)\n"))

    def test_existing_embedded_files_block_is_extended(self) -> None:
        payload = FOOTPRINT.replace(
            b"\t(model ",
            b'\t(embedded_files\n\t\t(file\n\t\t\t(name "font.ttf")\n\t\t\t(type font)\n\t\t)\n\t)\n\t(model ',
        )
        text = rewrite(payload, step_model(b"block"))
        self.assertEqual(text.count("(embedded_files"), 1)
        self.assertIn('(name "font.ttf")\n\t\t\t(type font)\n\t\t)\n\t\t(file\n\t\t\t(name "R_0402-', text)



class MaterializedFootprintTests(unittest.TestCase):
    """Embedding through ``materialize_asset``, as placement reads stored files."""

    def setUp(self) -> None:
        placement_payloads.clear_embedded_footprint_cache()
        self.addCleanup(placement_payloads.clear_embedded_footprint_cache)
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.model_bytes = step_model(b"stored")
        self.model = self._asset("m1", "3dmodel", "R_0402.step", self.model_bytes)
        self.footprint = self._asset("fp", "footprint", "R_0402.kicad_mod", FOOTPRINT)
        for name, value in (
            ("REMOTE_PROVIDER_LIBRARY_PREFIX", "remote"),
            ("REMOTE_PROVIDER_DESTINATION_DIR", "${KIPRJMOD}/RemoteLibrary"),
        ):
            patcher = patch.object(settings, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def _asset(self, asset_id: str, asset_type: str, name: str, data: bytes) -> dict:
        path = self.root / name
        path.write_bytes(data)
        return {
            "id": asset_id,
            "asset_type": asset_type,
            "canonical_path": str(path),
            "sha256": hashlib.sha256(data).hexdigest(),
        }

    def _place(self) -> dict:
        return materialize_asset(self.footprint, [self.footprint, self.model], {}, embed_models=True)

    def test_missing_model_file_keeps_the_model_external(self) -> None:
        Path(self.model["canonical_path"]).unlink()
        with self.assertLogs("app.services.catalog.placement_payloads", "WARNING"):
            placed = self._place()
        self.assertEqual(placed["embedded_model_ids"], [])
        self.assertIn(b'(model "${KIPRJMOD}/RemoteLibrary/remote_3d/R_0402.step"', placed["payload"])

    def test_model_over_the_raw_ceiling_is_skipped_without_reading_it(self) -> None:
        with (
            patch.object(placement_payloads, "EMBED_MAX_RAW_MODEL_BYTES", len(self.model_bytes) - 1),
            patch.object(Path, "read_bytes", autospec=True, side_effect=Path.read_bytes) as read,
        ):
            placed = self._place()
        self.assertEqual([call.args[0].name for call in read.call_args_list], ["R_0402.kicad_mod"])
        self.assertEqual(placed["embedded_model_ids"], [])

    def test_malformed_footprint_falls_back_to_external_models(self) -> None:
        Path(self.footprint["canonical_path"]).write_bytes(FOOTPRINT[: -len(b")\n")])
        with self.assertLogs("app.services.catalog.placement_payloads", "WARNING"):
            placed = self._place()
        self.assertEqual(placed["embedded_model_ids"], [])
        self.assertIn(b'(model "${KIPRJMOD}/RemoteLibrary/remote_3d/R_0402.step"', placed["payload"])
        self.assertNotIn(b"embedded_files", placed["payload"])

    def test_identical_placements_compress_each_model_once(self) -> None:
        with patch.object(placement_payloads, "compress_model", wraps=compress_model) as compress:
            first, second = self._place(), self._place()
        self.assertEqual(compress.call_count, 1)
        self.assertEqual(first["payload"], second["payload"])
        self.assertEqual(second["embedded_model_ids"], ["m1"])
        with patch.object(settings, "REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES", 0):
            self.assertEqual(self._place()["embedded_model_ids"], [])

    def test_the_default_cap_is_sixteen_mebibytes_of_compressed_data(self) -> None:
        self.assertEqual(type(settings).model_fields["REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES"].default, 16 << 20)

    def test_a_kept_compressed_copy_pins_the_bytes_across_a_zstd_change(self) -> None:
        copies = CompressedModelCopies(self.root / "embedded-models")
        first = materialize_asset(self.footprint, [self.footprint, self.model], {}, embed_models=True,
                                  compress=copies.compress)
        kept = copies.path_for(self.model["sha256"])
        self.assertTrue(kept.is_file())
        placement_payloads.clear_embedded_footprint_cache()

        # A zstandard upgrade compresses differently; the kept copy wins.
        other = zstandard.ZstdCompressor(level=3, write_content_size=True, write_checksum=False).compress
        with patch.object(embedded_model_copies, "compress_model", other):
            again = materialize_asset(self.footprint, [self.footprint, self.model], {}, embed_models=True,
                                      compress=copies.compress)
        self.assertEqual(again["payload"], first["payload"])
        self.assertNotEqual(other(self.model_bytes), kept.read_bytes())

        # A damaged copy is replaced rather than embedded.
        kept.write_bytes(b"damaged")
        placement_payloads.clear_embedded_footprint_cache()
        with self.assertLogs("app.services.catalog.embedded_model_copies", "WARNING"):
            repaired = materialize_asset(self.footprint, [self.footprint, self.model], {}, embed_models=True,
                                         compress=copies.compress)
        self.assertEqual(repaired["payload"], first["payload"])
        self.assertEqual(kept.read_bytes(), compress_model(self.model_bytes))

    def test_a_missing_model_is_not_cached(self) -> None:
        Path(self.model["canonical_path"]).unlink()
        with self.assertLogs("app.services.catalog.placement_payloads", "WARNING"):
            self.assertEqual(self._place()["embedded_model_ids"], [])
        Path(self.model["canonical_path"]).write_bytes(self.model_bytes)
        self.assertEqual(self._place()["embedded_model_ids"], ["m1"])

    def test_embedding_off_keeps_the_destination_path(self) -> None:
        placed = materialize_asset(self.footprint, [self.footprint, self.model], {}, embed_models=False)
        self.assertNotIn("embedded_model_ids", placed)
        self.assertIn(b'(model "${KIPRJMOD}/RemoteLibrary/remote_3d/R_0402.step"', placed["payload"])

if __name__ == "__main__":
    unittest.main()
