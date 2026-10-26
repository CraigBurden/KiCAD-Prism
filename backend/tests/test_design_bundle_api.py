"""``/api/projects/{id}/design-bundles`` status and regenerate (K2b).

The routes are driven through a bare FastAPI app with the router mounted as
``main`` mounts it, so the ``require_viewer`` / ``require_designer``
dependencies are exercised without standing up OIDC or a database. The service,
the rows/store reads and the role-aware project lookup are patched.
"""

from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from fastapi import FastAPI

from app.api import design_bundles as api
from app.core.errors import install_error_handlers
from app.core.security import AuthenticatedUser, get_current_user
from app.services.design_bundle import regenerate as regenerate_service

DESIGNER = AuthenticatedUser(email="designer@example.com", name="Designer", role="designer")
VIEWER = AuthenticatedUser(email="viewer@example.com", name="Viewer", role="viewer")

_COMMIT = "a" * 40


def _app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)
    # The router owns its ``/api/projects`` prefix, as it does under ``main``.
    app.include_router(api.router)
    return app


async def _request(app: FastAPI, method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    """Send one ASGI request and return ``(status, json)`` without httpx."""

    raw = b"" if body is None else json.dumps(body).encode()
    messages: list[dict] = []
    request_complete = False

    async def receive() -> dict:
        nonlocal request_complete
        if request_complete:
            return {"type": "http.disconnect"}
        request_complete = True
        return {"type": "http.request", "body": raw, "more_body": False}

    async def send(message: dict) -> None:
        messages.append(message)

    headers: list[tuple[bytes, bytes]] = []
    if body is not None:
        headers.append((b"content-type", b"application/json"))
        headers.append((b"content-length", str(len(raw)).encode("ascii")))

    await app(
        {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": b"",
            "headers": headers,
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
            "root_path": "",
        },
        receive,
        send,
    )
    start = next(message for message in messages if message["type"] == "http.response.start")
    payload = b"".join(
        message.get("body", b"") for message in messages if message["type"] == "http.response.body"
    )
    return start["status"], json.loads(payload) if payload else {}


class DesignBundleStatusTests(unittest.IsolatedAsyncioTestCase):
    async def test_counts_bundles_by_state_and_reports_aliases_and_bytes(self) -> None:
        app = _app()
        app.dependency_overrides[get_current_user] = lambda: VIEWER
        stored = [
            {"state": "complete"},
            {"state": "complete"},
            {"state": "building"},
            {"state": "queued"},
            {"state": "failed"},
            {"state": "something-else"},  # not one of the four; ignored
        ]
        try:
            with (
                patch.object(api, "get_project_for_role_or_404", return_value=object()) as lookup,
                patch.object(api.rows, "bundles", return_value=stored) as bundles,
                # ``rows.aliases`` lands with the alias table (K2b rows); the
                # status route only needs the name to exist here.
                patch.object(api.rows, "aliases", return_value=[{"a": 1}, {"b": 2}], create=True) as aliases,
                patch.object(api.store, "stored_bytes", return_value=4096) as stored_bytes,
            ):
                status, body = await _request(app, "GET", "/api/projects/p1/design-bundles")
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        self.assertEqual(status, 200)
        self.assertEqual(
            body,
            {
                "bundles": {"complete": 2, "building": 1, "queued": 1, "failed": 1},
                "aliases": 2,
                "storedBytes": 4096,
                "incomplete": {"failed": 0, "partial": 0},
                "incompleteRevisions": [],
                "failedBuilds": [{"commit": None, "revisionKey": None, "reason": ""}],
            },
        )
        lookup.assert_called_once_with("p1", "viewer")
        bundles.assert_called_once_with("p1")
        aliases.assert_called_once_with("p1")
        stored_bytes.assert_called_once_with("p1")

    async def test_all_four_states_are_present_at_zero(self) -> None:
        app = _app()
        app.dependency_overrides[get_current_user] = lambda: VIEWER
        try:
            with (
                patch.object(api, "get_project_for_role_or_404", return_value=object()),
                patch.object(api.rows, "bundles", return_value=[]),
                patch.object(api.rows, "aliases", return_value=[], create=True),
                patch.object(api.store, "stored_bytes", return_value=0),
            ):
                status, body = await _request(app, "GET", "/api/projects/p1/design-bundles")
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        self.assertEqual(status, 200)
        self.assertEqual(body["bundles"], {"complete": 0, "building": 0, "queued": 0, "failed": 0})

    async def test_complete_bundles_with_failed_or_partial_stages_are_counted_and_listed(self) -> None:
        app = _app()
        app.dependency_overrides[get_current_user] = lambda: VIEWER
        whole = {"parse": "complete", "board": "complete", "models": "complete"}
        stored = [
            {"state": "complete", "commit_sha": "a" * 40, "updated_at": "2026-10-01", "stages": whole},
            {"state": "complete", "commit_sha": "b" * 40, "revision_key": "2" * 64, "updated_at": "2026-10-03",
             "stages": {"parse": "failed", "board": "skipped", "models": "skipped"},
             "error": "parse: source-unparseable: unexpected token (main.kicad_sch:12)"},
            {"state": "complete", "commit_sha": "c" * 40, "revision_key": "3" * 64, "updated_at": "2026-10-02",
             "stages": {"parse": "partial", "board": "complete", "models": "complete"}},
            # Still building: its stages are not final, so it is not reported.
            {"state": "building", "commit_sha": "d" * 40, "updated_at": "2026-10-04",
             "stages": {"parse": "partial", "board": "pending", "models": "pending"}},
        ]
        try:
            with (
                patch.object(api, "get_project_for_role_or_404", return_value=object()),
                patch.object(api.rows, "bundles", return_value=stored),
                patch.object(api.rows, "aliases", return_value=[], create=True),
                patch.object(api.store, "stored_bytes", return_value=0),
            ):
                status, body = await _request(app, "GET", "/api/projects/p1/design-bundles")
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        self.assertEqual(status, 200)
        self.assertEqual(body["bundles"]["complete"], 3)
        self.assertEqual(body["incomplete"], {"failed": 1, "partial": 1})
        self.assertEqual(
            body["incompleteRevisions"],
            [
                {"commit": "b" * 40, "revisionKey": "2" * 64, "failedStages": ["parse"], "partialStages": [],
                 "reason": "parse: source-unparseable: unexpected token (main.kicad_sch:12)"},
                {"commit": "c" * 40, "revisionKey": "3" * 64, "failedStages": [], "partialStages": ["parse"],
                 "reason": ""},
            ],
        )

    async def test_failed_builds_are_listed_newest_first_with_their_error(self) -> None:
        app = _app()
        app.dependency_overrides[get_current_user] = lambda: VIEWER
        stored = [
            {"state": "failed", "commit_sha": "e" * 40, "revision_key": "5" * 64, "updated_at": "2026-10-01",
             "error": "prism-kicad bundle verify: member-schema-invalid"},
            {"state": "failed", "commit_sha": "f" * 40, "revision_key": "6" * 64, "updated_at": "2026-10-05",
             "error": "KiCad cannot read board.kicad_pcb"},
            {"state": "complete", "commit_sha": "a" * 40, "revision_key": "1" * 64, "updated_at": "2026-10-09",
             "stages": {"parse": "complete", "board": "complete", "models": "complete"}},
        ]
        try:
            with (
                patch.object(api, "get_project_for_role_or_404", return_value=object()),
                patch.object(api.rows, "bundles", return_value=stored),
                patch.object(api.rows, "aliases", return_value=[], create=True),
                patch.object(api.store, "stored_bytes", return_value=0),
            ):
                status, body = await _request(app, "GET", "/api/projects/p1/design-bundles")
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["failedBuilds"],
            [
                {"commit": "f" * 40, "revisionKey": "6" * 64, "reason": "KiCad cannot read board.kicad_pcb"},
                {"commit": "e" * 40, "revisionKey": "5" * 64,
                 "reason": "prism-kicad bundle verify: member-schema-invalid"},
            ],
        )

    async def test_a_hidden_project_is_not_found(self) -> None:
        app = _app()
        app.dependency_overrides[get_current_user] = lambda: VIEWER
        from fastapi import HTTPException

        try:
            with patch.object(
                api, "get_project_for_role_or_404", side_effect=HTTPException(status_code=404, detail="Project not found")
            ):
                status, body = await _request(app, "GET", "/api/projects/hidden/design-bundles")
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        self.assertEqual(status, 404)
        self.assertEqual(body["detail"], "Project not found")


class DesignBundleRegenerateTests(unittest.IsolatedAsyncioTestCase):
    def _regenerated(self, **overrides):
        values = {"scope": "commit", "commit": _COMMIT, "removed_bundles": 1, "removed_aliases": 2, "job_id": "job-1"}
        values.update(overrides)
        return regenerate_service.Regenerated(**values)

    async def test_a_designer_rebuilds_head_through_the_service(self) -> None:
        app = _app()
        app.dependency_overrides[get_current_user] = lambda: DESIGNER
        try:
            with (
                patch.object(api, "get_project_for_role_or_404", return_value=object()),
                patch.object(api.regenerate, "regenerate", return_value=self._regenerated()) as regenerate,
            ):
                status, body = await _request(
                    app, "POST", "/api/projects/p1/design-bundles/regenerate", {"scope": "commit"}
                )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        self.assertEqual(status, 200)
        self.assertEqual(
            body,
            {"scope": "commit", "commit": _COMMIT, "removedBundles": 1, "removedAliases": 2, "jobId": "job-1"},
        )
        regenerate.assert_called_once_with(
            "p1", commit=None, scope="commit", requested_by="designer@example.com"
        )

    async def test_scope_project_rebuilds_everything_and_names_no_commit(self) -> None:
        app = _app()
        app.dependency_overrides[get_current_user] = lambda: DESIGNER
        try:
            with (
                patch.object(api, "get_project_for_role_or_404", return_value=object()),
                patch.object(
                    api.regenerate,
                    "regenerate",
                    return_value=self._regenerated(scope="project", commit=None, removed_bundles=7, removed_aliases=3),
                ) as regenerate,
            ):
                status, body = await _request(
                    app, "POST", "/api/projects/p1/design-bundles/regenerate", {"scope": "project"}
                )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        self.assertEqual(status, 200)
        self.assertEqual(body["scope"], "project")
        regenerate.assert_called_once_with(
            "p1", commit=None, scope="project", requested_by="designer@example.com"
        )

    async def test_an_explicit_commit_is_forwarded(self) -> None:
        app = _app()
        app.dependency_overrides[get_current_user] = lambda: DESIGNER
        try:
            with (
                patch.object(api, "get_project_for_role_or_404", return_value=object()),
                patch.object(api.regenerate, "regenerate", return_value=self._regenerated()) as regenerate,
            ):
                status, _ = await _request(
                    app, "POST", "/api/projects/p1/design-bundles/regenerate", {"commit": _COMMIT}
                )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        self.assertEqual(status, 200)
        regenerate.assert_called_once_with(
            "p1", commit=_COMMIT, scope="commit", requested_by="designer@example.com"
        )

    async def test_a_viewer_may_not_regenerate(self) -> None:
        app = _app()
        app.dependency_overrides[get_current_user] = lambda: VIEWER
        try:
            with (
                patch.object(api, "get_project_for_role_or_404", return_value=object()) as lookup,
                patch.object(api.regenerate, "regenerate") as regenerate,
            ):
                status, _ = await _request(
                    app, "POST", "/api/projects/p1/design-bundles/regenerate", {"scope": "commit"}
                )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        self.assertEqual(status, 403)
        lookup.assert_not_called()
        regenerate.assert_not_called()

    async def test_the_post_route_depends_on_require_designer(self) -> None:
        from app.core.security import require_designer

        route = next(
            route
            for route in api.router.routes
            if getattr(route, "path", "") == "/api/projects/{project_id}/design-bundles/regenerate"
        )
        self.assertTrue(
            any(dependency.dependency is require_designer for dependency in route.dependencies)
        )

    async def test_a_short_or_uppercase_commit_is_rejected_before_the_service(self) -> None:
        app = _app()
        for bad in ("abc", "A" * 40, "a" * 39, "a" * 41, "g" * 40):
            with self.subTest(commit=bad):
                app.dependency_overrides[get_current_user] = lambda: DESIGNER
                try:
                    with (
                        patch.object(api, "get_project_for_role_or_404", return_value=object()),
                        patch.object(api.regenerate, "regenerate") as regenerate,
                    ):
                        status, _ = await _request(
                            app, "POST", "/api/projects/p1/design-bundles/regenerate", {"commit": bad}
                        )
                finally:
                    app.dependency_overrides.pop(get_current_user, None)
                self.assertEqual(status, 422)
                regenerate.assert_not_called()

    async def test_a_commit_with_scope_project_is_rejected(self) -> None:
        app = _app()
        app.dependency_overrides[get_current_user] = lambda: DESIGNER
        try:
            with (
                patch.object(api, "get_project_for_role_or_404", return_value=object()),
                patch.object(api.regenerate, "regenerate") as regenerate,
            ):
                status, _ = await _request(
                    app,
                    "POST",
                    "/api/projects/p1/design-bundles/regenerate",
                    {"commit": _COMMIT, "scope": "project"},
                )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        self.assertEqual(status, 422)
        regenerate.assert_not_called()

    async def test_service_refusals_map_to_their_statuses(self) -> None:
        cases = [
            (regenerate_service.RegenerateConflict("A design bundle of this project is being built"), 409),
            (regenerate_service.RegenerateNotApplicable("The project is not present at this commit"), 422),
            (LookupError("Project 'p1' not found"), 404),
            (api.CliUnavailable("prism-kicad is not installed"), 503),
        ]
        for error, expected in cases:
            with self.subTest(error=type(error).__name__):
                app = _app()
                app.dependency_overrides[get_current_user] = lambda: DESIGNER
                try:
                    with (
                        patch.object(api, "get_project_for_role_or_404", return_value=object()),
                        patch.object(api.regenerate, "regenerate", side_effect=error),
                    ):
                        status, body = await _request(
                            app, "POST", "/api/projects/p1/design-bundles/regenerate", {"scope": "commit"}
                        )
                finally:
                    app.dependency_overrides.pop(get_current_user, None)
                self.assertEqual(status, expected)
                self.assertEqual(body["detail"], str(error))


if __name__ == "__main__":
    unittest.main()
