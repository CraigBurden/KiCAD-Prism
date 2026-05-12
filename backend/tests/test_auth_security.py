from __future__ import annotations

import asyncio
import sys
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import AuthenticatedUser, require_admin, require_remote_symbol_reader  # noqa: E402
from app.services import provider_auth_service  # noqa: E402
from app.services import service_client_service  # noqa: E402
from app.services.component_catalog_service import ComponentCatalogService  # noqa: E402


class AuthSecurityTests(unittest.TestCase):
    def test_kicad_provider_token_cannot_access_admin_api(self) -> None:
        user = AuthenticatedUser(
            email="admin@example.com",
            name="Admin",
            role="admin",
            auth_type="kicad_provider",
            client_id="kicad-prism-kicad",
            scopes=["remote_symbols.read"],
        )

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(require_admin(user))

        self.assertEqual(ctx.exception.status_code, 403)

    def test_service_admin_token_can_access_admin_api(self) -> None:
        user = AuthenticatedUser(
            email="client@service.local",
            name="PLM Client",
            role="admin",
            auth_type="service_client",
            client_id="prism_client",
            scopes=["api:read", "api:write"],
        )

        resolved = asyncio.run(require_admin(user))
        self.assertEqual(resolved.client_id, "prism_client")

    def test_remote_symbol_reader_requires_scope_for_bearer_tokens(self) -> None:
        user = AuthenticatedUser(
            email="client@service.local",
            name="PLM Client",
            role="viewer",
            auth_type="service_client",
            client_id="prism_client",
            scopes=["api:write"],
        )

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(require_remote_symbol_reader(user))

        self.assertEqual(ctx.exception.status_code, 403)

    def test_remote_provider_scope_defaults_to_remote_symbols_read(self) -> None:
        self.assertEqual(provider_auth_service.normalize_provider_scope(""), "remote_symbols.read")

    def test_remote_provider_rejects_unknown_scopes(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            provider_auth_service.normalize_provider_scope("remote_symbols.read api:read")

        self.assertEqual(ctx.exception.status_code, 400)

    def test_service_client_credentials_use_sqlite_catalog(self) -> None:
        previous_db = service_client_service._db  # type: ignore[attr-defined]  # noqa: SLF001
        previous_secret = service_client_service.settings.SESSION_SECRET
        try:
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                catalog = ComponentCatalogService(
                    store_root=root / "components",
                    database_url=str(root / "prism.sqlite3"),
                )
                catalog.initialize()
                service_client_service._db = lambda: catalog  # type: ignore[attr-defined]  # noqa: SLF001
                service_client_service.settings.SESSION_SECRET = "test-secret"

                created = service_client_service.create_service_client(
                    name="Inventree",
                    role="viewer",
                    scopes=["api:read", "remote_symbols.read"],
                )
                token = service_client_service.issue_client_credentials_token(
                    client_id=created["client_id"],
                    client_secret=created["client_secret"],
                    requested_scope="api:read",
                )
                resolved = service_client_service.validate_service_access_token(token["access_token"])

                self.assertEqual(resolved["client_id"], created["client_id"])
                self.assertEqual(resolved["role"], "viewer")
                self.assertEqual(resolved["scopes"], ["api:read"])
        finally:
            service_client_service._db = previous_db  # type: ignore[attr-defined]  # noqa: SLF001
            service_client_service.settings.SESSION_SECRET = previous_secret


if __name__ == "__main__":
    unittest.main()
