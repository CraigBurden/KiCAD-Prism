"""Catalog write conflicts are classified by type, not by message text."""

from __future__ import annotations

import sys
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.errors import BadRequest, DomainError, value_errors_as  # noqa: E402
from app.services.catalog.conflicts import (  # noqa: E402
    ASSET_REFERENCED_CODE,
    CatalogConflict,
    MANIFEST_CONFLICT_CODE,
    REVISION_CONFLICT_CODE,
    asset_referenced_conflict,
    manifest_conflict,
    revision_conflict,
)


class CatalogConflictTypeTests(unittest.TestCase):
    def test_default_conflict_keeps_revision_machine_code(self) -> None:
        exc = CatalogConflict("head moved")
        self.assertIsInstance(exc, ValueError)
        self.assertEqual(exc.code, REVISION_CONFLICT_CODE)
        self.assertEqual(str(exc), "head moved")
        self.assertEqual(revision_conflict().code, REVISION_CONFLICT_CODE)

    def test_referenced_conflict_uses_its_own_code(self) -> None:
        exc = asset_referenced_conflict()
        self.assertEqual(exc.code, ASSET_REFERENCED_CODE)
        self.assertIn("representation", str(exc))

    def test_manifest_conflict_uses_its_own_code(self) -> None:
        exc = manifest_conflict()
        self.assertEqual(exc.code, MANIFEST_CONFLICT_CODE)
        self.assertIn("manifest", str(exc))


def _raised_through_route(exc: ValueError) -> DomainError:
    """What a catalog write route answers: typed conflicts keep their status, other ValueErrors are 400."""
    try:
        with value_errors_as(400, keep_typed=True):
            raise exc
    except DomainError as rendered:
        return rendered
    raise AssertionError("nothing raised")


class CatalogConflictHttpTests(unittest.TestCase):
    def test_conflict_status_does_not_depend_on_wording(self) -> None:
        raised = _raised_through_route(CatalogConflict("head moved"))
        self.assertEqual(raised.status_code, 412)  # D13: a stale revision answers like every guarded write
        self.assertEqual(raised.body(), {"detail": "head moved", "code": REVISION_CONFLICT_CODE})

    def test_a_stale_revision_carries_the_current_etag(self) -> None:
        raised = _raised_through_route(revision_conflict(component_id="cmp-1", current_revision_id="rev-2"))
        self.assertEqual((raised.status_code, raised.headers), (412, {"ETag": '"component:cmp-1:rev-2"'}))

    def test_plain_value_error_with_conflict_wording_stays_400(self) -> None:
        raised = _raised_through_route(
            ValueError("Component revision conflict: refresh the component before saving")
        )
        self.assertIsInstance(raised, BadRequest)
        self.assertEqual(raised.status_code, 400)

    def test_validation_stays_400(self) -> None:
        raised = _raised_through_route(ValueError("label is required"))
        self.assertEqual(raised.status_code, 400)
        self.assertEqual(raised.body(), {"detail": "label is required", "code": "bad_request"})

    def test_referenced_conflict_is_409(self) -> None:
        raised = _raised_through_route(asset_referenced_conflict("still attached"))
        self.assertEqual(raised.status_code, 409)
        self.assertEqual(raised.body(), {"detail": "still attached", "code": ASSET_REFERENCED_CODE})  # D14: flat


class ProjectImportAcceptRouteTests(unittest.TestCase):
    def test_a_purged_model_answers_409_asset_bytes_missing(self) -> None:
        from app.api import catalog_admin
        from app.core import errors
        from app.core.security import AuthenticatedUser

        app = FastAPI()
        errors.install_error_handlers(app)
        app.include_router(catalog_admin.router)
        user = AuthenticatedUser(email="designer@example.com", name="Designer", role="designer")
        app.dependency_overrides[catalog_admin.require_catalog_writer] = lambda: user
        service = MagicMock()
        service.get_project_import_proposal.return_value = {"session_id": "session-1"}
        service.get_project_import_session.return_value = {"created_by": user.email}
        service.accept_project_import_proposal.side_effect = CatalogConflict(
            "The 3D model file is missing from the catalog store; upload it again", code="asset_bytes_missing"
        )

        with patch.object(catalog_admin, "catalog_service", service):
            response = TestClient(app, raise_server_exceptions=False).post(
                "/api/catalog/import-proposals/proposal-1/accept", json={}
            )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["code"], "asset_bytes_missing")


if __name__ == "__main__":
    unittest.main()
