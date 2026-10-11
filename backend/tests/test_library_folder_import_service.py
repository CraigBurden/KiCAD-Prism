from __future__ import annotations

import sys
import hashlib
import shutil
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.library_folder_import_service import (  # noqa: E402
    configured_import_roots,
    build_folder_proposals,
    resolve_server_import_path,
)
from app.services.local_artifact_store import LocalArtifactStore  # noqa: E402
from app.services.component_catalog_domain import ComponentCatalogDomainService  # noqa: E402


class LibraryFolderImportTests(unittest.TestCase):
    def test_snapshot_paths_reject_parent_traversal(self) -> None:
        with self.assertRaises(ValueError):
            LocalArtifactStore.normalize_relative_path("../secrets/file.kicad_sym")
        self.assertEqual(
            LocalArtifactStore.normalize_relative_path("Libraries\\symbols\\part.kicad_sym"),
            "Libraries/symbols/part.kicad_sym",
        )

    def test_server_roots_are_named_and_subpaths_cannot_escape(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "team-library").mkdir()
            with mock.patch(
                "app.services.library_folder_import_service.settings.CATALOG_IMPORT_ROOTS",
                f"engineering={root}",
            ):
                self.assertEqual(configured_import_roots()["engineering"], root.resolve())
                self.assertEqual(
                    resolve_server_import_path("engineering", "team-library"),
                    (root / "team-library").resolve(),
                )
                with self.assertRaises(ValueError):
                    resolve_server_import_path("engineering", "../outside")

    SYMBOL = (
        '(kicad_symbol_lib (version 20231120) (generator "test") '
        '(symbol "Part" (property "Value" "Sensor") '
        '(property "Footprint" "Package:Body") '
        '(property "Manufacturer" "Acme") '
        '(property "Manufacturer Part Number" "ACME-1") '
        '(property "Description" "Sensor") '
        '(property "Datasheet" "https://example.test/part.pdf") '
        '(property "Voltage Rating" "5V")))'
    )
    FOOTPRINT = '(footprint "Body" (model "${KICAD9_3DMODEL_DIR}/Package.3dshapes/Body.step"))'

    def _proposals(self, sources: dict[str, bytes], **kwargs: object) -> list[dict]:
        """Stage proposals for a folder snapshot holding ``sources``."""

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            objects: dict[str, Path] = {}
            files = []
            for relative_path, payload in sources.items():
                digest = hashlib.sha256(payload).hexdigest()
                source = root / "sources" / digest
                source.parent.mkdir(parents=True, exist_ok=True)
                source.write_bytes(payload)
                objects[digest] = source
                files.append(
                    {
                        "relative_path": relative_path,
                        "sha256": digest,
                        "size_bytes": len(payload),
                        "object_path": str(source),
                    }
                )

            def put_stream(stream: object, **_kwargs: object) -> SimpleNamespace:
                payload = stream.read()  # type: ignore[attr-defined]
                digest = hashlib.sha256(payload).hexdigest()
                path = root / "objects" / digest
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(payload)
                objects[digest] = path
                return SimpleNamespace(sha256=digest, size_bytes=len(payload), path=path)

            def materialize(digest: str, destination: Path) -> Path:
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(objects[digest], destination)
                return destination

            fake_store = SimpleNamespace(
                get_snapshot=lambda _snapshot_id: {
                    "id": "snapshot-1",
                    "status": "ready",
                    "manifest_sha256": "manifest-1",
                },
                snapshot_files=lambda _snapshot_id: [dict(item) for item in files],
                put_stream=put_stream,
                materialize=materialize,
            )
            # Proposal construction only needs the domain's pure KiCad symbol helpers;
            # persistence is deliberately outside this unit test.
            service = ComponentCatalogDomainService(store_root=root / "catalog")
            service.store_root.mkdir(parents=True, exist_ok=True)
            with (
                mock.patch("app.services.library_folder_import_service.artifact_store", fake_store),
                mock.patch("app.services.library_folder_import_service.catalog_service", service),
            ):
                return build_folder_proposals("snapshot-1", "session-1", **kwargs)  # type: ignore[arg-type]

    def test_folder_snapshot_correlates_symbol_footprint_and_model(self) -> None:
        proposals = self._proposals({
            "symbols/Devices.kicad_sym": self.SYMBOL.encode(),
            "footprints/Package.pretty/Body.kicad_mod": self.FOOTPRINT.encode(),
            "3d/Package.3dshapes/Body.step": b"STEP bytes",
        })

        self.assertEqual(len(proposals), 1)
        proposal = proposals[0]
        self.assertEqual(proposal["metadata"]["manufacturer_part_number"], "ACME-1")
        self.assertEqual(proposal["metadata"]["fields"]["Voltage Rating"], "5V")
        self.assertEqual(
            {asset["asset_type"] for asset in proposal["assets"]},
            {"symbol", "footprint", "3dmodel"},
        )
        self.assertFalse(proposal["findings"])

    def test_an_ambiguous_model_is_reported_as_ambiguous(self) -> None:
        """Discovery shows two candidate models; the proposal must say the same.

        It used to resolve the reference again on its own, get no unique
        match, and report the model as merely unresolved.
        """
        proposals = self._proposals({
            "symbols/Devices.kicad_sym": self.SYMBOL.encode(),
            "footprints/Package.pretty/Body.kicad_mod": self.FOOTPRINT.encode(),
            "3d/a/Body.step": b"STEP a",
            "3d/b/Body.step": b"STEP b",
        })

        proposal = proposals[0]
        self.assertNotIn("3dmodel", {asset["asset_type"] for asset in proposal["assets"]})
        self.assertEqual([finding["code"] for finding in proposal["findings"]], ["ambiguous_3d_model"])


if __name__ == "__main__":
    unittest.main()
