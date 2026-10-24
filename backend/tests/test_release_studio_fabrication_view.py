"""Release Studio fabrication viewer routes.

Handlers are called directly with the store and the dossier read patched, the
pattern ``test_release_studio_api.py`` uses.
"""

from __future__ import annotations

import hashlib
import io
import sys
import tarfile
import unittest
from dataclasses import dataclass
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import HTTPException  # noqa: E402

from tests.test_fabrication_view_service import package_files  # noqa: E402
from tests.test_placement_service import KICAD_BOM, KICAD_POS  # noqa: E402


@dataclass
class _User:
    email: str = "viewer"
    role: str = "viewer"


def _dossier(files: dict[str, bytes]) -> tuple[bytes, list[dict]]:
    """A dossier tarball plus the member rows the store would hold for it."""

    buffer = io.BytesIO()
    members = []
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for name, data in files.items():
            path = f"fabrication/gerbers/{name}" if not name.endswith(".drl") else f"fabrication/drill/{name}"
            info = tarfile.TarInfo(path)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
            members.append({"path": path, "released_digest": hashlib.sha256(data).hexdigest()})
    return buffer.getvalue(), members


class FabricationViewRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        from app.api import fabrication_view as api
        from app.api import release_studio as rel

        self.api = api
        self.rel = rel
        api._fabrication_cache.clear()
        self.payload, self.members = _dossier(package_files())
        self.reads = 0

    def _patches(self, members=None, payload=None):
        def artifact(_artifact_id):
            self.reads += 1
            return payload if payload is not None else self.payload

        build = {"id": "build-1", "dossier_artifact_id": "a1"}
        return (
            patch.object(self.api, "get_project_for_role_or_404"),
            patch.object(self.rel, "_build_or_404", lambda *_args: build),
            patch.object(self.rel.store, "build_members", lambda _id: members if members is not None else self.members),
            patch.object(self.rel, "_artifact_bytes", artifact),
        )

    def _call(self, func, *args, members=None, payload=None):
        p1, p2, p3, p4 = self._patches(members, payload)
        with p1, p2, p3, p4:
            return func("project", "build-1", *args, _User())

    def test_view_lists_layers_size_and_drill(self) -> None:
        view = self._call(self.api.get_fabrication_view)
        self.assertEqual(view["size"], {"width": 20.0, "height": 10.0})
        self.assertEqual(view["drill"]["holes"], 4)
        self.assertIn("f.cu", [layer["id"] for layer in view["layers"]])

    def test_layer_svg_is_served_sandboxed(self) -> None:
        response = self._call(self.api.get_fabrication_layer, "f.cu")
        self.assertEqual(response.media_type, "image/svg+xml")
        self.assertIn(b"<svg", response.body)
        self.assertIn("sandbox", response.headers["Content-Security-Policy"])
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")

    def test_unknown_layer_is_404(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            self._call(self.api.get_fabrication_layer, "nope")
        self.assertEqual(caught.exception.status_code, 404)

    def test_build_without_fabrication_files_is_404(self) -> None:
        other = [{"path": "documentation/bom.csv", "released_digest": "0"}]
        with self.assertRaises(HTTPException) as caught:
            self._call(self.api.get_fabrication_view, members=other)
        self.assertEqual(caught.exception.status_code, 404)

    def test_a_digest_mismatch_is_a_hard_error(self) -> None:
        tampered = [dict(item, released_digest="0" * 64) for item in self.members]
        with self.assertRaises(HTTPException) as caught:
            self._call(self.api.get_fabrication_view, members=tampered)
        self.assertEqual(caught.exception.status_code, 500)
        self.assertIn("digest mismatch", caught.exception.detail)

    def test_a_package_is_read_from_the_dossier_once(self) -> None:
        self._call(self.api.get_fabrication_view)
        self._call(self.api.get_fabrication_layer, "f.cu")
        self._call(self.api.get_fabrication_layer, "b.cu")
        self.assertEqual(self.reads, 1)

    def test_the_cache_is_bounded(self) -> None:
        size = self.api._FABRICATION_CACHE_SIZE
        for index in range(size + 2):
            build = {"id": f"build-{index}", "dossier_artifact_id": "a1"}
            with (
                patch.object(self.rel.store, "build_members", lambda _id: self.members),
                patch.object(self.rel, "_artifact_bytes", lambda _id: self.payload),
            ):
                self.api._fabrication_package(build)
        self.assertEqual(len(self.api._fabrication_cache), size)
        self.assertNotIn("build-0", self.api._fabrication_cache)


def _members_dossier(files: dict[str, bytes]) -> tuple[bytes, list[dict]]:
    buffer = io.BytesIO()
    members = []
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for path, data in files.items():
            info = tarfile.TarInfo(path)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
            members.append({"path": path, "released_digest": hashlib.sha256(data).hexdigest()})
    return buffer.getvalue(), members


class PlacementRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        from app.api import fabrication_view as api
        from app.api import release_studio as rel

        self.api = api
        self.rel = rel
        api._placement_cache.clear()

    def _call(self, files: dict[str, bytes]):
        payload, members = _members_dossier(files)
        build = {"id": "build-1", "dossier_artifact_id": "a1"}
        with (
            patch.object(self.api, "get_project_for_role_or_404"),
            patch.object(self.rel, "_build_or_404", lambda *_args: build),
            patch.object(self.rel.store, "build_members", lambda _id: members),
            patch.object(self.rel, "_artifact_bytes", lambda _id: payload),
        ):
            return self.api.get_build_placement("project", "build-1", _User())

    def test_parts_are_checked_against_the_bom(self) -> None:
        view = self._call({
            "assembly/positions.csv": KICAD_POS.encode(),
            "assembly/bom.csv": KICAD_BOM.encode(),
        })
        self.assertTrue(view["hasBom"])
        self.assertEqual(view["counts"]["placed"], 4)
        self.assertEqual([item["ref"] for item in view["missing"]], ["R5"])

    def test_a_build_is_read_from_its_dossier_once(self) -> None:
        reads = []
        payload, members = _members_dossier({
            "assembly/positions.csv": KICAD_POS.encode(),
            "assembly/bom.csv": KICAD_BOM.encode(),
        })

        def artifact(_id):
            reads.append(1)
            return payload

        build = {"id": "build-1", "dossier_artifact_id": "a1"}
        with (
            patch.object(self.api, "get_project_for_role_or_404"),
            patch.object(self.rel, "_build_or_404", lambda *_args: build),
            patch.object(self.rel.store, "build_members", lambda _id: members),
            patch.object(self.rel, "_artifact_bytes", artifact),
        ):
            first = self.api.get_build_placement("project", "build-1", _User())
            second = self.api.get_build_placement("project", "build-1", _User())
        self.assertEqual(len(reads), 1)
        self.assertEqual(first, second)

    def test_a_build_without_a_bom_still_shows_the_positions(self) -> None:
        view = self._call({"assembly/positions.csv": KICAD_POS.encode()})
        self.assertFalse(view["hasBom"])
        self.assertEqual(view["counts"]["placed"], 4)

    def test_a_build_without_positions_is_404(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            self._call({"assembly/bom.csv": KICAD_BOM.encode()})
        self.assertEqual(caught.exception.status_code, 404)

    def test_an_unreadable_position_file_is_422(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            self._call({"assembly/positions.csv": b"nothing,useful\n1,2\n"})
        self.assertEqual(caught.exception.status_code, 422)

    def test_a_digest_mismatch_is_a_hard_error(self) -> None:
        payload, members = _members_dossier({"assembly/positions.csv": KICAD_POS.encode()})
        members[0]["released_digest"] = "0" * 64
        build = {"id": "build-1", "dossier_artifact_id": "a1"}
        with (
            patch.object(self.api, "get_project_for_role_or_404"),
            patch.object(self.rel, "_build_or_404", lambda *_args: build),
            patch.object(self.rel.store, "build_members", lambda _id: members),
            patch.object(self.rel, "_artifact_bytes", lambda _id: payload),
            self.assertRaises(HTTPException) as caught,
        ):
            self.api.get_build_placement("project", "build-1", _User())
        self.assertEqual(caught.exception.status_code, 500)


if __name__ == "__main__":
    unittest.main()
