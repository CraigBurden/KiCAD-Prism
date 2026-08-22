"""Coverage for the stored-asset browser behind the "Link existing" picker.

The picker sends `q` and `limit` and renders `{files, total}`; nothing else
pins that contract, so these tests cover the filtering, the response shape,
and the cache window the listing is served from.
"""

from __future__ import annotations

import inspect
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api import catalog_admin  # noqa: E402
from app.core.security import AuthenticatedUser  # noqa: E402
from app.services.component_catalog_domain import (  # noqa: E402
    _ASSET_BROWSE_CACHE_TTL_SECONDS,
    ComponentCatalogDomainService,
)


class _FilesystemOnlyCatalogService(ComponentCatalogDomainService):
    """browse_library_assets reads the store on disk and nothing else.

    The base class routes initialize() to the Postgres subclass, but the
    browser never touches the database, so creating the store directories is
    the whole of the setup it needs.
    """

    def initialize(self) -> None:
        self._ensure_storage_dirs()


class AssetBrowseListingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.store = Path(self.tempdir.name) / "components"
        self.service = _FilesystemOnlyCatalogService(store_root=self.store)
        self.service.initialize()

    def _write(self, asset_type: str, relative_path: str) -> Path:
        path = self.service._asset_root(asset_type) / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("(kicad_symbol_lib)", encoding="utf-8")
        return path

    def test_listing_is_sorted_and_scoped_to_the_asset_type(self) -> None:
        self._write("symbol", "Sensors/LMT86DCK.kicad_sym")
        self._write("symbol", "Amplifiers/OPA187.kicad_sym")
        self._write("symbol", "Sensors/notes.txt")
        self._write("footprint", "SMD/SOT65P210X110-5N.kicad_mod")

        symbols = self.service.browse_library_assets("symbol")

        # Sorted, store-relative, POSIX, and nothing that is not a symbol file.
        self.assertEqual(
            symbols["files"],
            ["Amplifiers/OPA187.kicad_sym", "Sensors/LMT86DCK.kicad_sym"],
        )
        self.assertEqual(symbols["total"], 2)

        footprints = self.service.browse_library_assets("footprint")
        self.assertEqual(footprints["files"], ["SMD/SOT65P210X110-5N.kicad_mod"])

    def test_three_d_models_cover_both_step_extensions(self) -> None:
        self._write("3dmodel", "Sensors/LMT86DCKT.step")
        self._write("3dmodel", "Sensors/OPA187.stp")
        self._write("3dmodel", "Sensors/readme.md")

        result = self.service.browse_library_assets("3dmodel")

        self.assertEqual(
            result["files"], ["Sensors/LMT86DCKT.step", "Sensors/OPA187.stp"]
        )

    def test_query_matches_the_whole_relative_path_case_insensitively(self) -> None:
        self._write("symbol", "Sensors/LMT86DCK.kicad_sym")
        self._write("symbol", "Amplifiers/OPA187.kicad_sym")

        # Case folds both ways.
        self.assertEqual(
            self.service.browse_library_assets("symbol", q="lmt86")["files"],
            ["Sensors/LMT86DCK.kicad_sym"],
        )
        # The directory is part of the haystack, not just the file name.
        self.assertEqual(
            self.service.browse_library_assets("symbol", q="AMPLIFIERS/")["files"],
            ["Amplifiers/OPA187.kicad_sym"],
        )
        # Surrounding whitespace is trimmed rather than failing every match.
        self.assertEqual(
            self.service.browse_library_assets("symbol", q="  opa  ")["files"],
            ["Amplifiers/OPA187.kicad_sym"],
        )
        # A blank query is not a filter.
        self.assertEqual(self.service.browse_library_assets("symbol", q="   ")["total"], 2)

    def test_no_match_returns_an_empty_page_rather_than_everything(self) -> None:
        self._write("symbol", "Sensors/LMT86DCK.kicad_sym")

        result = self.service.browse_library_assets("symbol", q="no-such-part")

        self.assertEqual(result["files"], [])
        self.assertEqual(result["total"], 0)

    def test_limit_caps_the_page_while_total_counts_every_match(self) -> None:
        for index in range(5):
            self._write("symbol", f"Sensors/PART{index}.kicad_sym")

        page = self.service.browse_library_assets("symbol", limit=2)

        # total is what the footer counts down from, so it must survive the cap.
        self.assertEqual(page["files"], ["Sensors/PART0.kicad_sym", "Sensors/PART1.kicad_sym"])
        self.assertEqual(page["total"], 5)

        # The cap applies after filtering, not before it.
        filtered = self.service.browse_library_assets("symbol", q="PART3", limit=2)
        self.assertEqual(filtered["files"], ["Sensors/PART3.kicad_sym"])
        self.assertEqual(filtered["total"], 1)

        # A limit past the end is not an error and does not pad.
        everything = self.service.browse_library_assets("symbol", limit=500)
        self.assertEqual(len(everything["files"]), 5)

    def test_unsupported_asset_type_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.service.browse_library_assets("gerber")

    def test_listing_is_served_from_cache_until_the_ttl_lapses(self) -> None:
        """Files written after a listing stay invisible for the cache window.

        This is the known cost of not rescanning the store per request: there
        is no invalidation hook on the asset write paths, so a freshly stored
        file is missing from the picker until the entry ages out.
        """
        self._write("symbol", "Sensors/LMT86DCK.kicad_sym")
        self.assertEqual(self.service.browse_library_assets("symbol")["total"], 1)

        self._write("symbol", "Sensors/OPA187.kicad_sym")
        self.assertEqual(
            self.service.browse_library_assets("symbol")["total"],
            1,
            "a second call inside the TTL must not pay for another store walk",
        )

        cached_at, files = self.service._browse_cache["symbol"]
        self.service._browse_cache["symbol"] = (
            cached_at - _ASSET_BROWSE_CACHE_TTL_SECONDS - 1,
            files,
        )

        refreshed = self.service.browse_library_assets("symbol")
        self.assertEqual(refreshed["total"], 2)
        self.assertIn("Sensors/OPA187.kicad_sym", refreshed["files"])

    def test_each_asset_type_is_cached_independently(self) -> None:
        self._write("symbol", "Sensors/LMT86DCK.kicad_sym")
        self.service.browse_library_assets("symbol")

        # Warming symbols must not make footprints answer from the wrong entry.
        self._write("footprint", "SMD/SOT65P210X110-5N.kicad_mod")
        self.assertEqual(
            self.service.browse_library_assets("footprint")["files"],
            ["SMD/SOT65P210X110-5N.kicad_mod"],
        )


class AssetBrowseEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.user = AuthenticatedUser(
            email="designer@example.com", name="Designer", role="designer"
        )

    def test_search_and_limit_reach_the_service_and_totals_reach_the_client(self) -> None:
        listing = {"files": ["Sensors/LMT86DCK.kicad_sym"], "total": 41}
        with patch.object(
            catalog_admin.catalog_service, "browse_library_assets", return_value=listing
        ) as browse:
            response = catalog_admin.browse_library_assets(
                asset_type="symbol", q="lmt", limit=25, user=self.user
            )

        browse.assert_called_once_with("symbol", q="lmt", limit=25)
        # The picker needs total to say "showing 1 of 41"; dropping it would
        # silently present a capped page as the whole store.
        self.assertEqual(response, {"files": ["Sensors/LMT86DCK.kicad_sym"], "total": 41})

    def test_service_failures_surface_as_400(self) -> None:
        with patch.object(
            catalog_admin.catalog_service,
            "browse_library_assets",
            side_effect=ValueError("Unsupported asset type"),
        ):
            with self.assertRaises(HTTPException) as raised:
                catalog_admin.browse_library_assets(
                    asset_type="gerber", q="", limit=50, user=self.user
                )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail, "Unsupported asset type")

    def test_query_and_limit_are_bounded_at_the_route(self) -> None:
        """The caps are the only thing keeping a crafted request from asking
        for the whole store, so pin them rather than the defaults alone."""
        parameters = inspect.signature(catalog_admin.browse_library_assets).parameters
        limit = parameters["limit"].default
        query = parameters["q"].default

        self.assertEqual(limit.default, 50)
        limit_bounds = {type(item).__name__: item for item in limit.metadata}
        self.assertEqual(limit_bounds["Ge"].ge, 1)
        self.assertEqual(limit_bounds["Le"].le, 500)

        self.assertEqual(query.default, "")
        query_bounds = {type(item).__name__: item for item in query.metadata}
        self.assertEqual(query_bounds["MaxLen"].max_length, 200)


if __name__ == "__main__":
    unittest.main()
