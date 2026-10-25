"""The /api/admin/service-clients route accepts only known scopes.

Drives the real app with a signed-in admin session. The catalog schema lives in
PRISM_DATABASE_URL, so the class is skipped without it.
"""

from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import policy  # noqa: E402
from app.core.config import settings  # noqa: E402

DATABASE_URL = os.environ.get("PRISM_DATABASE_URL", "").strip()

# Starlette's TestClient needs an HTTP client package (httpx2, or httpx) that the
# locked runtime does not ship.
try:
    import starlette.testclient  # noqa: F401
    HAS_TEST_CLIENT = True
except RuntimeError:
    HAS_TEST_CLIENT = False

TEST_SECRET = "test-secret-at-least-32-characters-long-x"


@unittest.skipUnless(DATABASE_URL, "PRISM_DATABASE_URL is required for service-client route tests")
@unittest.skipUnless(HAS_TEST_CLIENT, "starlette.testclient needs httpx2 or httpx")
class ServiceClientScopeRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        from starlette.testclient import TestClient

        cls._patchers = [
            patch.object(settings, "AUTH_ENABLED_OVERRIDE", True),
            patch.object(settings, "PASSWORD_AUTH_ENABLED", True),
            patch.object(settings, "SESSION_SECRET", TEST_SECRET),
        ]
        for patcher in cls._patchers:
            patcher.start()

        import app.main as main
        from app.services import access_service, service_client_service, session_store_service

        session_store_service.initialize_session_store()
        cls.main = main
        cls.access_service = access_service
        cls.service_client_service = service_client_service
        cls.session_store_service = session_store_service
        cls.TestClient = TestClient

    @classmethod
    def tearDownClass(cls) -> None:
        for patcher in getattr(cls, "_patchers", []):
            patcher.stop()

    def _admin_client(self):
        from app.core.session import SESSION_COOKIE_NAME, create_session_token

        email = "service-client-admin@example.com"
        self.access_service.upsert_user(email=email, name="Service Client Admin")
        self.access_service.upsert_user_role(email, "admin", updated_by=email)
        session_id, _ = self.session_store_service.create_session(email=email, name="Service Client Admin", picture="")
        client = self.TestClient(self.main.app)
        client.cookies.set(SESSION_COOKIE_NAME, create_session_token(session_id))
        return client

    def test_an_unknown_scope_is_rejected(self) -> None:
        response = self._admin_client().post(
            "/api/admin/service-clients",
            json={"name": "PLM", "scopes": ["api:read", "nope"]},
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("nope", response.text)

    def test_every_area_scope_and_wildcard_starts_a_client(self) -> None:
        client = self._admin_client()
        for scope in (*policy.AREA_WRITE_SCOPES, "*"):
            with self.subTest(scope=scope):
                response = client.post(
                    "/api/admin/service-clients",
                    json={"name": f"PLM {scope}", "role": "viewer", "scopes": [scope]},
                )
                self.assertEqual(response.status_code, 200, response.text)
                body = response.json()
                self.assertEqual(body["scopes"], [scope])
                self.addCleanup(self.service_client_service.delete_service_client, body["client_id"])


if __name__ == "__main__":
    unittest.main()
