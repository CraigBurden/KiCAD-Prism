"""TR-21: connected-account OAuth and revocation APIs (F3)."""

from __future__ import annotations

import asyncio
import json
import sys
import unittest
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException
from app.core.errors import DomainError  # noqa: E402
from pydantic import SecretStr

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import Settings  # noqa: E402
from app.core.security import AuthenticatedUser  # noqa: E402
from app.api import tracker_identity as identity_api  # noqa: E402
from app.services.trackers.connector_service import ConnectorService  # noqa: E402
from app.services.trackers.contracts import ForgeUser, IdentityToken  # noqa: E402
from app.services.trackers.github_identity import GitHubIdentityAdapter, GitHubOAuthApp  # noqa: E402
from app.services.trackers.identity_service import (  # noqa: E402
    IdentityService,
    OAuthStateError,
    bump_user_cache,
    user_cache_version,
)
from app.services.trackers.identity_service import build_oauth_return_url  # noqa: E402
from app.services.trackers.migrations import (  # noqa: E402
    migrate_tracker_webhook_oauth_tables,
    migrate_workspace_tracker_tables,
)
from app.services.comments_schema_migrations import COMMENTS_LEDGER  # noqa: E402
from support.postgres import requires_scratch_postgres, scratch_schema  # noqa: E402

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]

DOCS = Path(__file__).resolve().parents[2] / "docs" / "tracker-integration"
F3 = json.loads((DOCS / "fixtures" / "F03.json").read_text(encoding="utf-8"))
CLIENT_SECRET = "oauth-client-secret-fixture-tr21"
TEST_SESSION_SECRET = "unit-test-session-secret-not-a-credential"
ROOT_KEY = "aa" * 32


def _settings(**overrides) -> Settings:
    base = {
        "AUTH_ENABLED": True,
        "OIDC_ISSUER_URL": "https://idp.example.com",
        "OIDC_CLIENT_ID": "prism",
        "OIDC_CLIENT_SECRET": "shhh",
        "SESSION_SECRET": TEST_SESSION_SECRET,
        "PUBLIC_BASE_URL": "https://prism.example",
        "PRISM_DATABASE_URL": "postgresql://prism@localhost/prism",
        "TRACKER_CREDENTIAL_ROOT_KEY": SecretStr(ROOT_KEY),
        "TRACKER_CREDENTIAL_ROOT_KEY_ID": "v1",
        "TRACKER_CREDENTIAL_PREVIOUS_ROOT_KEY": SecretStr(""),
        "TRACKER_CREDENTIAL_PREVIOUS_ROOT_KEY_ID": "",
    }
    base.update(overrides)
    return Settings(_env_file=None, **base)


def session(role: str, *, user_id: str = "u_1", session_id: str = "sid_1") -> AuthenticatedUser:
    return AuthenticatedUser(
        email=f"{user_id}@example.com",
        name=role,
        role=role,  # type: ignore[arg-type]
        session_id=session_id,
        user_id=user_id,
    )


ROUTE_ERRORS = (HTTPException, DomainError)


def run(coro):
    return asyncio.run(coro)


class _FakeAdapter(GitHubIdentityAdapter):
    def __init__(self) -> None:
        self.app = GitHubOAuthApp(
            client_id="ov_client_fixture",
            client_secret=CLIENT_SECRET,
            redirect_uri="https://prism.example/api/trackers/oauth/callback",
        )
        self.calls: list[str] = []

    def authorize_url(self, state: str, pkce_challenge: str) -> str:
        self.calls.append("authorize")
        return f"https://github.com/login/oauth/authorize?state={state}&challenge={pkce_challenge}"

    def exchange(self, code: str, pkce_verifier: str) -> IdentityToken:
        self.calls.append("exchange")
        if code != "good-code" or not pkce_verifier:
            raise OAuthStateError("bad_code")
        return IdentityToken(
            accessToken="user-access-token-fixture",
            refreshToken="user-refresh-token-fixture",
            scopes=["read:user"],
            expiresAt="2026-09-20T19:20:00Z",
        )

    def refresh(self, token: IdentityToken) -> IdentityToken:
        self.calls.append("refresh")
        return IdentityToken(
            accessToken="user-access-token-refreshed",
            refreshToken=token.refreshToken,
            scopes=token.scopes,
            expiresAt="2026-09-20T20:20:00Z",
        )

    def whoami(self, token: IdentityToken) -> ForgeUser:
        self.calls.append("whoami")
        return ForgeUser(id="5550001", login="arjun-gh", displayName="Arjun")



@requires_scratch_postgres("tracker persistence tests")
class IdentityOAuthPostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "tr21", ledgers=(COMMENTS_LEDGER,), then=(migrate_workspace_tracker_tables, migrate_tracker_webhook_oauth_tables,))
        self.schema, self.conn = self.scratch.name, self.scratch.conn
        self.addCleanup(self._cleanup)
        self.conn.commit()
        self.settings = _settings()
        self.fake = _FakeAdapter()
        connector_service = ConnectorService(
            connect=self._factory,
            settings=self.settings,
            tester=lambda row, material: {"ok": True, "writesEnabled": True, "bot": {"id": "1", "login": "bot"}},
            comments_schema=self.schema,
            workspace_schema=self.schema,
        )
        self.service = IdentityService(
            connect=self._factory,
            settings=self.settings,
            connector_service=connector_service,
            adapter_factory=lambda app: self.fake,
            workspace_schema=self.schema,
        )
        identity_api.service = self.service
        self.user = session("designer", user_id="u_1", session_id="sid_alpha")
        self.other = session("designer", user_id="u_2", session_id="sid_beta")
        self.admin = session("admin", user_id="u_admin", session_id="sid_admin")
        self._seed_connector()

    def _cleanup(self) -> None:
        identity_api.service = IdentityService()

    @contextmanager
    def _factory(self):
        conn = self.scratch.connect()
        try:
            yield conn
        finally:
            conn.close()

    def _seed_connector(self) -> None:
        connector_service = ConnectorService(connect=self._factory, settings=self.settings, workspace_schema=self.schema)
        connector_service.create(
            actor_user_id="u_admin",
            provider="github",
            instance_kind="github.com",
            display_name="GitHub",
            credentials={"appId": "1", "installationId": "2", "privateKey": "fixture-key"},
            connector_id="cn_gh1",
        )
        self.service.configure_oauth_client("cn_gh1", client_id="ov_client_fixture", client_secret=CLIENT_SECRET)

    def test_begin_callback_list_and_unlink(self) -> None:
        begin = run(
            identity_api.begin_oauth(
                "cn_gh1",
                request=_request(),
                returnTo="/workspace?tab=accounts",
                user=self.user,
            )
        )
        self.assertIn("github.com/login/oauth/authorize", begin.authorizeUrl)
        state = begin.authorizeUrl.split("state=")[1].split("&")[0]
        linked = run(
            identity_api.oauth_callback(
                request=_request(),
                code="good-code",
                state=state,
                user=self.user,
            )
        )
        self.assertEqual(linked.status_code, 302)
        self.assertEqual(
            linked.headers["location"],
            build_oauth_return_url("/workspace?tab=accounts", linked=True, connector_id="cn_gh1"),
        )
        listed = run(identity_api.list_identities(self.user))
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["forgeLogin"], "arjun-gh")
        self.assertEqual(listed[0]["status"], "active")
        dumped = json.dumps(listed)
        self.assertNotIn("user-access-token", dumped)
        self.assertNotIn("tokenEnvelope", dumped)
        run(identity_api.unlink_identity("cn_gh1", self.user))
        after = run(identity_api.list_identities(self.user))
        self.assertEqual(after[0]["status"], "revoked")
        row = self.conn.execute(
            "SELECT status, token_envelope FROM user_identities WHERE user_id = 'u_1'"
        ).fetchone()
        self.assertEqual(row["status"], "revoked")
        self.assertIsNone(row["token_envelope"])
        audit = self.conn.execute(
            "SELECT action FROM tracker_audit WHERE connector_id = 'cn_gh1' ORDER BY id"
        ).fetchall()
        self.assertIn("identity.link", [item["action"] for item in audit])
        self.assertIn("identity.unlink", [item["action"] for item in audit])

    def test_replayed_state_and_cross_user_callback_denied(self) -> None:
        begin = run(identity_api.begin_oauth("cn_gh1", request=_request(), user=self.user))
        state = begin.authorizeUrl.split("state=")[1].split("&")[0]
        run(
            identity_api.oauth_callback(
                request=_request(),
                code="good-code",
                state=state,
                user=self.user,
            )
        )
        replay = run(
            identity_api.oauth_callback(
                request=_request(),
                code="good-code",
                state=state,
                user=self.user,
            )
        )
        self.assertEqual(replay.status_code, 302)
        self.assertIn("tracker_oauth=error", replay.headers["location"])
        self.assertIn("tracker_oauth_error=unknown_or_reused_state", replay.headers["location"])
        begin2 = run(identity_api.begin_oauth("cn_gh1", request=_request(), user=self.user))
        state2 = begin2.authorizeUrl.split("state=")[1].split("&")[0]
        cross = run(
            identity_api.oauth_callback(
                request=_request(),
                code="good-code",
                state=state2,
                user=self.other,
            )
        )
        self.assertEqual(cross.status_code, 302)
        self.assertIn("tracker_oauth=error", cross.headers["location"])
        self.assertIn("tracker_oauth_error=cross_user_callback", cross.headers["location"])

    def test_expired_session_has_explicit_recovery(self) -> None:
        begin = run(identity_api.begin_oauth("cn_gh1", request=_request(), user=self.user))
        state = begin.authorizeUrl.split("state=")[1].split("&")[0]
        expired = session("designer", user_id="u_1", session_id="sid_changed")
        response = run(
            identity_api.oauth_callback(
                request=_request(),
                code="good-code",
                state=state,
                user=expired,
            )
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("tracker_oauth_error=session_expired", response.headers["location"])
        rows = self.conn.execute("SELECT COUNT(*) AS n FROM user_identities").fetchone()
        self.assertEqual(int(rows["n"]), 0)

    def test_identity_uniqueness_per_user_and_connector(self) -> None:
        begin = run(identity_api.begin_oauth("cn_gh1", request=_request(), user=self.user))
        state = begin.authorizeUrl.split("state=")[1].split("&")[0]
        run(
            identity_api.oauth_callback(
                request=_request(),
                code="good-code",
                state=state,
                user=self.user,
            )
        )
        listed_other = run(identity_api.list_identities(self.other))
        self.assertEqual(listed_other, [])
        with self.assertRaises(ROUTE_ERRORS) as unlink_other:
            run(identity_api.unlink_identity("cn_gh1", self.other))
        self.assertEqual(unlink_other.exception.status_code, 404)

    def test_admin_revoke_erases_tokens_and_bumps_cache(self) -> None:
        before = user_cache_version("u_1")
        begin = run(identity_api.begin_oauth("cn_gh1", request=_request(), user=self.user))
        state = begin.authorizeUrl.split("state=")[1].split("&")[0]
        run(
            identity_api.oauth_callback(
                request=_request(),
                code="good-code",
                state=state,
                user=self.user,
            )
        )
        bump_user_cache("u_1")
        revoked = run(identity_api.admin_revoke_identity("cn_gh1", "u_1", self.admin))
        self.assertEqual(revoked["status"], "revoked")
        self.assertGreater(user_cache_version("u_1"), before)
        row = self.conn.execute(
            "SELECT token_envelope FROM user_identities WHERE user_id = 'u_1'"
        ).fetchone()
        self.assertIsNone(row["token_envelope"])

    def test_refresh_reencrypts_token(self) -> None:
        begin = run(identity_api.begin_oauth("cn_gh1", request=_request(), user=self.user))
        state = begin.authorizeUrl.split("state=")[1].split("&")[0]
        run(
            identity_api.oauth_callback(
                request=_request(),
                code="good-code",
                state=state,
                user=self.user,
            )
        )
        before = self.conn.execute(
            "SELECT token_envelope FROM user_identities WHERE user_id = 'u_1'"
        ).fetchone()["token_envelope"]
        refreshed = self.service.refresh_identity_token("u_1", "cn_gh1")
        after = self.conn.execute(
            "SELECT token_envelope FROM user_identities WHERE user_id = 'u_1'"
        ).fetchone()["token_envelope"]
        self.assertNotEqual(before, after)
        self.assertEqual(refreshed["status"], "active")
        self.assertIn("refresh", self.fake.calls)


class _Request:
    headers: dict[str, str] = {}

    @property
    def base_url(self) -> str:
        return "https://prism.example/"


def _request() -> _Request:
    return _Request()


if __name__ == "__main__":
    unittest.main()
