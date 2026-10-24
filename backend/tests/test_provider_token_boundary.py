"""KiCad remote-provider tokens read remote symbols and nothing else.

A provider token is minted for KiCad's symbol chooser (scope
``remote_symbols.read``). It carries its user's role, so any dependency that
only checks the role lets KiCad's token read every project, comment, system and
release the user can. The provider flow itself only calls the
``/api/remote-provider/*`` routes (``require_remote_symbol_reader``), the signed
asset download, and the ``/oauth/*`` routes, none of which use a Prism
dependency.
"""

from __future__ import annotations

import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import (  # noqa: E402
    AuthenticatedUser,
    require_catalog_browser,
    require_catalog_reader,
    require_remote_symbol_reader,
    require_viewer,
)


def _provider(role: str = "admin") -> AuthenticatedUser:
    return AuthenticatedUser(
        email=f"{role}@example.com",
        name=role,
        role=role,
        auth_type="kicad_provider",
        client_id="kicad-prism-kicad",
        scopes=["remote_symbols.read"],
    )


class ProviderTokenDependencyTests(unittest.TestCase):
    def test_provider_token_cannot_read_general_api(self) -> None:
        for role in ("viewer", "qa", "designer", "admin"):
            with self.subTest(role=role):
                with self.assertRaises(HTTPException) as ctx:
                    asyncio.run(require_viewer(_provider(role)))
                self.assertEqual(ctx.exception.status_code, 403)

    def test_provider_token_cannot_browse_catalog_api(self) -> None:
        for dependency in (require_catalog_browser, require_catalog_reader):
            with self.subTest(dependency=dependency.__name__):
                with self.assertRaises(HTTPException) as ctx:
                    asyncio.run(dependency(_provider()))
                self.assertEqual(ctx.exception.status_code, 403)

    def test_provider_token_still_reads_remote_symbols(self) -> None:
        user = asyncio.run(require_remote_symbol_reader(_provider("viewer")))
        self.assertEqual(user.auth_type, "kicad_provider")

    def test_session_and_api_tokens_still_read(self) -> None:
        session = AuthenticatedUser(email="v@example.com", name="v", role="viewer")
        agent = AuthenticatedUser(
            email="v@example.com", name="v", role="viewer", auth_type="agent", scopes=["api:read", "api:write"]
        )
        for user in (session, agent):
            self.assertIs(asyncio.run(require_viewer(user)), user)


# Routes that resolve the caller themselves and refuse provider tokens in their
# body (or require a browser session). Anything else that depends on
# get_current_user must go through a require_* dependency.
_SELF_CHECKING_ROUTES = {
    ("GET", "/api/trackers/identities"),
    ("GET", "/api/trackers/linkable-connectors"),
    ("POST", "/api/trackers/connectors/{connector_id}/oauth/begin"),
    ("GET", "/api/trackers/oauth/callback"),
    ("DELETE", "/api/trackers/identities/{connector_id}"),
}


def _dependency_calls(dependant) -> list:
    calls = []
    for dependency in dependant.dependencies:
        calls.append(dependency.call)
        calls.extend(_dependency_calls(dependency))
    return calls


def _walk(routes, prefix: str = ""):
    for route in routes:
        original = getattr(route, "original_router", None)
        if original is not None:
            yield from _walk(original.routes)
        else:
            yield route


class ProviderTokenRouteCoverageTests(unittest.TestCase):
    def test_every_authenticated_route_refuses_provider_tokens(self) -> None:
        from fastapi.routing import APIRoute

        from app.core import security
        from app.core.config import settings

        with patch.dict(os.environ, {"AUTH_ENABLED": "false"}), patch.object(
            settings, "AUTH_ENABLED_OVERRIDE", False
        ):
            import app.main as main

        unguarded = []
        for route in _walk(main.app.routes):
            if not isinstance(route, APIRoute):
                continue
            calls = _dependency_calls(route.dependant)
            if security.get_current_user not in calls:
                continue
            guards = {
                call
                for call in calls
                if getattr(call, "__module__", "") == security.__name__
                and getattr(call, "__name__", "").startswith("require_")
            }
            if guards:
                continue
            for method in route.methods:
                if (method, route.path) not in _SELF_CHECKING_ROUTES:
                    unguarded.append(f"{method} {route.path}")
        self.assertEqual(sorted(unguarded), [])


class AgentConsentProviderTokenTests(unittest.TestCase):
    def test_provider_token_cannot_mint_agent_code(self) -> None:
        from app.api import agent

        async def provider_user(_request):
            return _provider("designer")

        with patch.object(agent, "get_current_user", provider_user), patch.object(
            agent.agent_auth_service, "validate_authorization_request"
        ), patch.object(agent.agent_auth_service, "issue_authorization_code") as issue:
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(
                    agent.authorize_submit(
                        request=None,  # type: ignore[arg-type]
                        redirect_uri="http://127.0.0.1:53998/cb",
                        state="s",
                        scope="",
                        code_challenge="c" * 43,
                        code_challenge_method="S256",
                        label="",
                    )
                )
        self.assertEqual(ctx.exception.status_code, 403)
        issue.assert_not_called()


if __name__ == "__main__":
    unittest.main()
