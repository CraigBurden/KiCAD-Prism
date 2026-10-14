"""KiCad embedded-file encoding and 3D model embedding at placement."""

from __future__ import annotations

import base64
import hashlib
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch

import zstandard

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.services.catalog import placement_payloads  # noqa: E402
from app.services.catalog.kicad_embedded_files import (  # noqa: E402
    compress_model,
    embedded_file_form,
    embedded_model_name,
    kicad_mmh3_128,
)
from app.services.catalog.placement_payloads import rewrite_footprint_payload  # noqa: E402


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

    def test_checksum_pads_to_four_bytes_like_kicad(self) -> None:
        self.assertEqual(kicad_mmh3_128(b"abc"), kicad_mmh3_128(b"abc\0"))
        self.assertNotEqual(kicad_mmh3_128(b"abc"), kicad_mmh3_128(b"abd"))

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

    def test_model_over_the_limit_keeps_the_external_path(self) -> None:
        with patch.object(placement_payloads, "EMBED_MAX_COMPRESSED_BYTES", 8):
            text = rewrite(FOOTPRINT, b"ISO-10303-21;END-ISO-10303-21;")
        self.assertIn('(model "${KIPRJMOD}/RemoteLibrary/remote_3d/R_0402.step"', text)
        self.assertNotIn("embedded_files", text)

    def test_different_model_bytes_yield_different_embedded_content(self) -> None:
        first = decode_embedded(rewrite(FOOTPRINT, b"ISO-10303-21;rev1;END-ISO-10303-21;"))
        second = decode_embedded(rewrite(FOOTPRINT, b"ISO-10303-21;rev2;END-ISO-10303-21;"))
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
                lambda asset: reads.append(asset) or b"shared",
            ).decode("utf-8")
        name = embedded_model_name("R_0402.step", b"shared")
        self.assertEqual(text.count(f'(model "kicad-embed://{name}"'), 2)
        self.assertEqual(list(decode_embedded(text)), [name])
        self.assertEqual(reads, [MODEL_ASSET])

    def test_existing_embedded_files_block_is_extended(self) -> None:
        payload = FOOTPRINT.replace(
            b"\t(model ",
            b'\t(embedded_files\n\t\t(file\n\t\t\t(name "font.ttf")\n\t\t\t(type font)\n\t\t)\n\t)\n\t(model ',
        )
        text = rewrite(payload, b"model")
        self.assertEqual(text.count("(embedded_files"), 1)
        self.assertIn('(name "font.ttf")\n\t\t\t(type font)\n\t\t)\n\t\t(file\n\t\t\t(name "R_0402-', text)


if __name__ == "__main__":
    unittest.main()
