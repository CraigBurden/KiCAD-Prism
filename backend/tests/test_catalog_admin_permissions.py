from __future__ import annotations

import asyncio
import inspect
import sys
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, UploadFile
from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.errors import DomainError  # noqa: E402
from app.api import catalog_admin  # noqa: E402
from app.api.catalog_admin import _can_transition_workflow  # noqa: E402
from app.core.security import AuthenticatedUser, require_catalog_admin  # noqa: E402
from app.services import catalog_worker_tasks  # noqa: E402
from tests.in_memory_jobs import run_catalog_task  # noqa: E402
from app.services.catalog.conflicts import (  # noqa: E402
    ASSET_REFERENCED_CODE,
    CatalogConflict,
    MANIFEST_CONFLICT_CODE,
    REVISION_CONFLICT_CODE,
    manifest_conflict,
)


# A route refuses with an HTTPException or a typed domain error (rendered by the app handler).
ROUTE_ERRORS = (HTTPException, DomainError)


class CatalogAdminPermissionTests(unittest.TestCase):
    def test_only_admins_can_manage_metadata_field_definitions(self) -> None:
        admin = AuthenticatedUser(email="admin@example.com", name="Admin", role="admin")
        designer = AuthenticatedUser(
            email="designer@example.com", name="Designer", role="designer"
        )

        self.assertIs(asyncio.run(require_catalog_admin(admin)), admin)
        with self.assertRaises(ROUTE_ERRORS) as raised:
            asyncio.run(require_catalog_admin(designer))
        self.assertEqual(raised.exception.status_code, 403)

    def test_health_disk_check_is_admin_opt_in(self) -> None:
        admin = AuthenticatedUser(email="admin@example.com", name="Admin", role="admin")
        designer = AuthenticatedUser(email="designer@example.com", name="Designer", role="designer")
        with patch.object(catalog_admin.catalog_service, "catalog_health", return_value={}) as health:
            catalog_admin.catalog_health(check_files=False, user=designer)
            health.assert_called_once_with(check_released_files=False)
            health.reset_mock()

            with self.assertRaises(ROUTE_ERRORS) as raised:
                catalog_admin.catalog_health(check_files=True, user=designer)
            self.assertEqual(raised.exception.status_code, 403)
            health.assert_not_called()

            catalog_admin.catalog_health(check_files=True, user=admin)
            health.assert_called_once_with(check_released_files=True)

    def test_metadata_worker_applies_only_requested_items(self) -> None:
        updates: list[dict[str, object]] = []
        expected = {"batch_id": "batch-1", "status": "partial", "applied": 1, "failed": 0}
        with patch.object(catalog_worker_tasks.catalog_service, "apply_metadata_batch", return_value=expected) as apply:
            result = run_catalog_task(
                catalog_worker_tasks.run_metadata_batch,
                {
                    "payload": {
                        "batch_id": "batch-1",
                        "actor": "designer@example.com",
                        "item_ids": ["item-2"],
                    }
                },
                lambda **fields: updates.append(fields) or True,
            )

        self.assertEqual(result, expected)
        apply.assert_called_once()
        self.assertEqual(apply.call_args.kwargs["item_ids"], ["item-2"])
        self.assertEqual(updates[-1]["progress"], 100)

    def test_workflow_transition_permissions_match_component_roles(self) -> None:
        admin = AuthenticatedUser(email="admin@example.com", name="Admin", role="admin")
        designer = AuthenticatedUser(email="designer@example.com", name="Designer", role="designer")
        qa = AuthenticatedUser(email="qa@example.com", name="QA", role="qa")
        read_only = AuthenticatedUser(email="viewer@example.com", name="Viewer", role="viewer")

        self.assertTrue(_can_transition_workflow(admin, "qa_review", "done"))
        self.assertFalse(_can_transition_workflow(designer, "qa_review", "done"))
        self.assertTrue(_can_transition_workflow(designer, "in_progress", "qa_review"))
        self.assertTrue(_can_transition_workflow(designer, "done", "released"))
        self.assertTrue(_can_transition_workflow(qa, "qa_review", "done"))
        self.assertTrue(_can_transition_workflow(qa, "qa_review", "in_progress"))
        self.assertTrue(_can_transition_workflow(qa, "qa_review", "archived"))
        self.assertFalse(_can_transition_workflow(qa, "done", "released"))
        self.assertFalse(_can_transition_workflow(read_only, "open", "in_progress"))

    def test_single_component_validation_job_returns_updated_component(self) -> None:
        updates: list[dict[str, object]] = []

        def record_update(**fields: object) -> bool:
            updates.append(fields)
            return True

        with (
            patch.object(
                catalog_worker_tasks.catalog_service,
                "validate_component_klc",
                return_value={"component": {"id": "cmp-1", "validation": {"status": "passed"}}},
            ),
        ):
            result = run_catalog_task(
                catalog_worker_tasks.run_validation,
                {"payload": {"component_ids": ["cmp-1"]}, "checkpoint": {}, "result": {}},
                record_update,
            )

        self.assertEqual(updates[-1]["progress"], 100)
        self.assertEqual(result["component"], {"id": "cmp-1", "validation": {"status": "passed"}})

    def test_catalog_validation_job_paginates_every_component(self) -> None:
        updates: list[dict[str, object]] = []
        requested_pages: list[int] = []
        validated_ids: list[str] = []

        def list_page(**kwargs: object) -> dict[str, object]:
            page = int(kwargs["page"])
            requested_pages.append(page)
            items = [{"id": "cmp-1"}, {"id": "cmp-2"}] if page == 1 else [{"id": "cmp-3"}]
            return {"items": items, "page": page, "page_size": 10000, "pages": 2, "total": 3}

        def validate(component_id: str) -> dict[str, object]:
            validated_ids.append(component_id)
            return {"component": {"id": component_id}}

        with (
            patch.object(catalog_worker_tasks.catalog_service, "list_components", side_effect=list_page),
            patch.object(catalog_worker_tasks.catalog_service, "validate_component_klc", side_effect=validate),
        ):
            result = run_catalog_task(
                catalog_worker_tasks.run_validation,
                {"payload": {"component_ids": None}, "checkpoint": {}, "result": {}},
                lambda **fields: updates.append(fields) or True,
            )

        self.assertEqual(requested_pages, [1, 2])
        self.assertEqual(validated_ids, ["cmp-1", "cmp-2", "cmp-3"])
        self.assertEqual(updates[-1]["progress"], 100)
        self.assertEqual(result["validated"], 3)
        self.assertEqual(result["total"], 3)


CONFLICT = "Component revision conflict: refresh the component before saving"
WRITER = AuthenticatedUser(email="designer@example.com", name="Designer", role="designer")


def _upload(name: str, payload: bytes = b"payload") -> UploadFile:
    return UploadFile(filename=name, file=BytesIO(payload))


def _request(revision: str | None = None, component_id: str = "cmp-1") -> Request:
    """A request whose ``If-Match`` names ``revision`` of the component (none when ``None``)."""
    headers = [] if revision is None else [(b"if-match", f'"component:{component_id}:{revision}"'.encode())]
    return Request({"type": "http", "headers": headers})


class CatalogAdminAssetRevisionTests(unittest.IsolatedAsyncioTestCase):
    def test_upload_and_link_keep_if_match_optional_for_legacy_callers(self) -> None:
        for name in ("import_symbol_library", "import_footprint", "import_auxiliary_asset"):
            self.assertNotIn("expected_revision_id", inspect.signature(getattr(catalog_admin, name)).parameters)
        self.assertNotIn("expected_revision_id", catalog_admin.LinkAssetRequest.model_fields)
        self.assertEqual(catalog_admin._revision(_request(), "cmp-1", required=False), "")

    def test_required_if_match_is_428_and_a_foreign_tag_is_never_current(self) -> None:
        from app.core import preconditions
        from app.core.errors import PreconditionRequired

        with self.assertRaises(PreconditionRequired):
            catalog_admin._revision(_request(), "cmp-1")
        self.assertEqual(catalog_admin._revision(_request("rev-1"), "cmp-1"), "rev-1")
        self.assertEqual(catalog_admin._revision(_request("rev-1", "cmp-2"), "cmp-1"), preconditions.STALE)

    async def test_stale_uploads_and_link_return_412_and_keep_session_actor(self) -> None:
        cases = (
            (
                catalog_admin.import_symbol_library,
                "import_symbol_library",
                {"file": _upload("a.kicad_sym"), "target_library": "", "selected_symbol": "", "counterpart_asset_id": ""},
            ),
            (
                catalog_admin.import_footprint,
                "import_footprint",
                {"file": _upload("a.kicad_mod"), "target_library": "", "selected_footprint": "", "counterpart_asset_id": ""},
            ),
            (
                catalog_admin.import_auxiliary_asset,
                "attach_auxiliary_asset",
                {"asset_type": "3dmodel", "file": _upload("a.step"), "target_library": ""},
            ),
        )
        for handler, service_name, kwargs in cases:
            with self.subTest(service_name):
                with patch.object(
                    catalog_admin.catalog_service, service_name, side_effect=CatalogConflict(CONFLICT)
                ) as mocked:
                    with self.assertRaises(ROUTE_ERRORS) as raised:
                        await handler("cmp-1", request=_request("stale-rev"), user=WRITER, **kwargs)
                self.assertEqual(raised.exception.status_code, 412)
                self.assertEqual(mocked.call_args.kwargs["expected_revision_id"], "stale-rev")
                self.assertEqual(mocked.call_args.kwargs["actor"], WRITER.email)

        payload = catalog_admin.LinkAssetRequest(file_path="lib/a.kicad_sym")
        with patch.object(
            catalog_admin.catalog_service, "link_library_asset", side_effect=CatalogConflict(CONFLICT)
        ) as mocked:
            with self.assertRaises(ROUTE_ERRORS) as raised:
                catalog_admin.link_library_asset("cmp-1", "symbol", payload, _request("stale-rev"), user=WRITER)
        self.assertEqual(raised.exception.status_code, 412)
        self.assertEqual(mocked.call_args.kwargs["expected_revision_id"], "stale-rev")
        self.assertEqual(mocked.call_args.kwargs["actor"], WRITER.email)

    async def test_non_conflict_upload_errors_stay_400(self) -> None:
        with patch.object(
            catalog_admin.catalog_service,
            "import_symbol_library",
            side_effect=ValueError("No symbols were found in the uploaded library"),
        ):
            with self.assertRaises(ROUTE_ERRORS) as raised:
                await catalog_admin.import_symbol_library(
                    "cmp-1",
                    file=_upload("empty.kicad_sym"),
                    target_library="",
                    selected_symbol="",
                    counterpart_asset_id="",
                    request=_request("rev-1"),
                    user=WRITER,
                )
        self.assertEqual(raised.exception.status_code, 400)


class CatalogAdminTypedConflictTests(unittest.TestCase):
    def test_metadata_conflict_wording_does_not_change_412(self) -> None:
        payload = catalog_admin.UpdateComponentMetadataRequest(value="10k")
        with patch.object(
            catalog_admin.catalog_service,
            "update_component_metadata",
            side_effect=CatalogConflict("head moved"),
        ):
            with self.assertRaises(ROUTE_ERRORS) as raised:
                catalog_admin.update_catalog_component("cmp-1", payload, _request("rev-1"), user=WRITER)
        self.assertEqual(raised.exception.status_code, 412)
        self.assertEqual(raised.exception.body(), {"detail": "head moved", "code": REVISION_CONFLICT_CODE})

    def test_metadata_validation_stays_400_and_missing_stays_404(self) -> None:
        payload = catalog_admin.UpdateComponentMetadataRequest(value="10k")
        with patch.object(
            catalog_admin.catalog_service,
            "update_component_metadata",
            side_effect=ValueError("datasheet is required"),
        ):
            with self.assertRaises(ROUTE_ERRORS) as raised:
                catalog_admin.update_catalog_component("cmp-1", payload, _request("rev-1"), user=WRITER)
        self.assertEqual(raised.exception.status_code, 400)
        with patch.object(catalog_admin.catalog_service, "update_component_metadata", return_value=None):
            with self.assertRaises(ROUTE_ERRORS) as raised:
                catalog_admin.update_catalog_component("cmp-1", payload, _request("rev-1"), user=WRITER)
        self.assertEqual(raised.exception.status_code, 404)

    def test_representation_conflict_wording_does_not_change_412(self) -> None:
        create = catalog_admin.CreateRepresentationRequest()
        update = catalog_admin.UpdateRepresentationRequest(label="B")
        cases = (
            (
                lambda: catalog_admin.create_component_representation("cmp-1", create, _request("rev-1"), user=WRITER),
                "create_representation",
            ),
            (
                lambda: catalog_admin.update_component_representation(
                    "cmp-1", "rep-1", update, _request("rev-1"), user=WRITER
                ),
                "update_representation",
            ),
            (
                lambda: catalog_admin.delete_component_representation(
                    "cmp-1", "rep-1", _request("rev-1"), user=WRITER
                ),
                "delete_representation",
            ),
        )
        for handler, service_name in cases:
            with self.subTest(service_name):
                with patch.object(
                    catalog_admin.catalog_service,
                    service_name,
                    side_effect=CatalogConflict("representation head moved"),
                ):
                    with self.assertRaises(ROUTE_ERRORS) as raised:
                        handler()
                self.assertEqual(raised.exception.status_code, 412)
                self.assertEqual(
                    raised.exception.body(),
                    {"detail": "representation head moved", "code": REVISION_CONFLICT_CODE},
                )

    def test_detach_referenced_conflict_is_409_without_scanning_text(self) -> None:
        with patch.object(
            catalog_admin.catalog_service,
            "detach_asset_by_id",
            side_effect=CatalogConflict("cannot detach", code=ASSET_REFERENCED_CODE),
        ):
            with self.assertRaises(ROUTE_ERRORS) as raised:
                catalog_admin.detach_component_asset_by_id("cmp-1", "asset-1", _request("rev-1"), user=WRITER)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.body(), {"detail": "cannot detach", "code": ASSET_REFERENCED_CODE})

    def test_workflow_manifest_conflict_is_409(self) -> None:
        payload = catalog_admin.ReleaseStatusRequest(
            workflow_stage="qa_review",
            expected_manifest_hash="stale-hash",
        )
        with (
            patch.object(
                catalog_admin.catalog_service,
                "get_component",
                return_value={
                    "id": "cmp-1",
                    "workflow_stage": "in_progress",
                    "release_status": "in_progress",
                },
            ),
            patch.object(
                catalog_admin.catalog_service,
                "set_release_status",
                side_effect=manifest_conflict("manifest moved"),
            ),
        ):
            with self.assertRaises(ROUTE_ERRORS) as raised:
                catalog_admin.transition_release_status("cmp-1", payload, _request("rev-1"), user=WRITER)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.body(), {"detail": "manifest moved", "code": MANIFEST_CONFLICT_CODE})

    def test_plain_value_error_with_conflict_wording_is_not_409(self) -> None:
        payload = catalog_admin.UpdateComponentMetadataRequest(value="10k")
        with patch.object(
            catalog_admin.catalog_service,
            "update_component_metadata",
            side_effect=ValueError(CONFLICT),
        ):
            with self.assertRaises(ROUTE_ERRORS) as raised:
                catalog_admin.update_catalog_component("cmp-1", payload, _request("rev-1"), user=WRITER)
        self.assertEqual(raised.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
