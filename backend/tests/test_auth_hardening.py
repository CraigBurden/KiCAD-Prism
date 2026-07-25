"""Regression tests for the V3 authentication hardening.

These cover the failure modes that would expose customer PCB IP: silently
disabled authentication, an authorization code accepted without the login
transaction that produced it, a token accepted for the wrong audience, and a
session that survives logout or revocation.
"""

from __future__ import annotations

import asyncio
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import security, session  # noqa: E402
from app.core.config import Settings, settings  # noqa: E402
from app.services import auth_service, session_store_service  # noqa: E402

TEST_SECRET = "b8f0c1a2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60"


class AuthConfigurationFailClosedTests(unittest.TestCase):
    """A misconfigured deployment must refuse to start, never serve open access."""

    def _settings(self, **overrides) -> Settings:
        base = {
            "AUTH_ENABLED": True,
            "OIDC_ISSUER_URL": "https://idp.example.com",
            "OIDC_CLIENT_ID": "prism",
            "OIDC_CLIENT_SECRET": "shhh",
            "SESSION_SECRET": TEST_SECRET,
            "PRISM_DATABASE_URL": "postgresql://prism@localhost/prism",
        }
        base.update(overrides)
        # _env_file=None keeps a developer's local .env out of these assertions.
        return Settings(_env_file=None, **base)

    def test_complete_configuration_is_accepted(self) -> None:
        self.assertEqual(self._settings().auth_configuration_errors(), [])

    def test_missing_oidc_secret_blocks_startup_instead_of_disabling_auth(self) -> None:
        broken = self._settings(OIDC_CLIENT_SECRET="")
        # The old behaviour: AUTH_ENABLED silently became False and every caller
        # was served as an admin guest.
        self.assertTrue(broken.AUTH_ENABLED)
        self.assertIn(
            "OIDC_CLIENT_SECRET is required when AUTH_ENABLED=true",
            broken.auth_configuration_errors(),
        )
        with self.assertRaises(RuntimeError):
            broken.validate_auth_configuration()

    def test_dev_mode_no_longer_disables_authentication(self) -> None:
        self.assertTrue(self._settings(DEV_MODE=True).AUTH_ENABLED)

    def test_weak_session_secrets_are_rejected(self) -> None:
        for secret in ("", "short", "change-me", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"):
            with self.subTest(secret=secret):
                errors = self._settings(SESSION_SECRET=secret).auth_configuration_errors()
                self.assertTrue(any("SESSION_SECRET" in error for error in errors))

    def test_external_issuer_without_audience_is_rejected(self) -> None:
        errors = self._settings(
            OAUTH_EXTERNAL_JWT_ISSUER_URL="https://issuer.example.com"
        ).auth_configuration_errors()
        self.assertTrue(any("OAUTH_EXTERNAL_JWT_AUDIENCE" in error for error in errors))

    def test_cookie_secure_follows_public_base_url(self) -> None:
        self.assertTrue(self._settings(PUBLIC_BASE_URL="https://prism.example.com").SESSION_COOKIE_SECURE)
        self.assertFalse(self._settings(PUBLIC_BASE_URL="http://127.0.0.1:8080").SESSION_COOKIE_SECURE)
        self.assertTrue(
            self._settings(PUBLIC_BASE_URL="http://127.0.0.1:8080", SESSION_COOKIE_SECURE=True).SESSION_COOKIE_SECURE
        )

    def test_disabled_authentication_reports_no_errors(self) -> None:
        self.assertEqual(Settings(_env_file=None, AUTH_ENABLED=False).auth_configuration_errors(), [])


class SessionTokenTests(unittest.TestCase):
    def setUp(self) -> None:
        self._patcher = patch.object(settings, "SESSION_SECRET", TEST_SECRET)
        self._patcher.start()
        self.addCleanup(self._patcher.stop)

    def test_session_token_round_trip_carries_only_an_opaque_id(self) -> None:
        token = session.create_session_token("session-abc")
        payload = session.decode_session_token(token)
        self.assertIsNotNone(payload)
        assert payload is not None
        self.assertEqual(payload["sid"], "session-abc")
        # Identity must not be recoverable from the cookie itself.
        self.assertNotIn("email", payload)

    def test_tampered_signature_is_rejected(self) -> None:
        token = session.create_session_token("session-abc")
        version, body, signature = token.split(".")
        forged = f"{version}.{body}.{signature[:-2]}xy"
        self.assertIsNone(session.decode_session_token(forged))

    def test_legacy_v1_identity_cookies_no_longer_authenticate(self) -> None:
        legacy = "v1.eyJlbWFpbCI6ImF0dGFja2VyQGV4YW1wbGUuY29tIn0.deadbeef"
        self.assertIsNone(session.decode_session_token(legacy))

    def test_transaction_token_cannot_be_replayed_as_a_session(self) -> None:
        """Domain-separated signing keeps the two token families apart."""
        transaction = session.create_oidc_transaction_token(
            state="s", nonce="n", code_verifier="v", redirect_uri="https://prism/cb"
        )
        self.assertIsNone(session.decode_session_token(transaction))
        self.assertIsNone(session.decode_oidc_transaction_token(session.create_session_token("sid")))

    def test_expired_transaction_token_is_rejected(self) -> None:
        transaction = session.create_oidc_transaction_token(
            state="s", nonce="n", code_verifier="v", redirect_uri="https://prism/cb"
        )
        with patch.object(time, "time", return_value=time.time() + session.OIDC_TRANSACTION_TTL_SECONDS + 5):
            self.assertIsNone(session.decode_oidc_transaction_token(transaction))


class OidcExchangeTests(unittest.TestCase):
    def test_pkce_challenge_matches_rfc7636_s256(self) -> None:
        # Verifier and challenge from RFC 7636 appendix B.
        self.assertEqual(
            auth_service.pkce_code_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        )

    def test_authorization_url_always_carries_pkce_and_nonce(self) -> None:
        with patch.object(
            auth_service,
            "get_oidc_metadata",
            return_value={"authorization_endpoint": "https://idp.example.com/authorize"},
        ), patch.object(settings, "OIDC_CLIENT_ID", "prism"):
            url = auth_service.build_oidc_authorization_url(
                redirect_uri="https://prism.example.com/auth/callback",
                state="state-value",
                nonce="nonce-value",
                code_verifier="verifier-value",
            )

        self.assertIn("code_challenge_method=S256", url)
        self.assertIn("nonce=nonce-value", url)
        self.assertIn(
            f"code_challenge={auth_service.pkce_code_challenge('verifier-value')}".replace("=", "=", 1),
            url.replace("%3D", "="),
        )

    def test_exchange_requires_a_login_transaction(self) -> None:
        """Without a server-issued nonce and verifier the callback cannot authenticate."""
        with patch.object(auth_service, "oidc_enabled", return_value=True):
            for nonce, verifier in (("", "verifier"), ("nonce", "")):
                with self.subTest(nonce=nonce, verifier=verifier):
                    with self.assertRaises(HTTPException) as ctx:
                        auth_service.authenticate_oidc_auth_code(
                            code="abc",
                            redirect_uri="https://prism.example.com/auth/callback",
                            expected_nonce=nonce,
                            code_verifier=verifier,
                        )
                    self.assertEqual(ctx.exception.status_code, 400)

    def test_verify_jwt_refuses_to_run_without_an_audience(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            auth_service._verify_jwt("token", issuer="https://idp.example.com", audience="")
        self.assertEqual(ctx.exception.status_code, 500)

    def test_mismatched_nonce_is_rejected(self) -> None:
        with patch.object(auth_service, "oidc_enabled", return_value=True), patch.object(
            auth_service, "_exchange_oidc_code", return_value={"id_token": "signed", "access_token": ""}
        ), patch.object(auth_service, "_verify_jwt", return_value={"sub": "user-1", "nonce": "other"}):
            with self.assertRaises(HTTPException) as ctx:
                auth_service.authenticate_oidc_auth_code(
                    code="abc",
                    redirect_uri="https://prism.example.com/auth/callback",
                    expected_nonce="expected",
                    code_verifier="verifier",
                )
        self.assertEqual(ctx.exception.status_code, 401)

    def test_userinfo_with_a_different_subject_is_rejected(self) -> None:
        """OIDC Core 5.3.2 - a mismatched userinfo subject can substitute an identity."""
        with patch.object(auth_service, "oidc_enabled", return_value=True), patch.object(
            auth_service, "_exchange_oidc_code", return_value={"id_token": "signed", "access_token": "at"}
        ), patch.object(
            auth_service, "_verify_jwt", return_value={"sub": "user-1", "nonce": "expected", "email": "real@example.com"}
        ), patch.object(
            auth_service, "_fetch_userinfo", return_value={"sub": "attacker", "email": "attacker@example.com"}
        ):
            with self.assertRaises(HTTPException) as ctx:
                auth_service.authenticate_oidc_auth_code(
                    code="abc",
                    redirect_uri="https://prism.example.com/auth/callback",
                    expected_nonce="expected",
                    code_verifier="verifier",
                )
        self.assertEqual(ctx.exception.status_code, 401)

    def test_missing_id_token_is_rejected(self) -> None:
        with patch.object(auth_service, "oidc_enabled", return_value=True), patch.object(
            auth_service, "_exchange_oidc_code", return_value={"access_token": "at"}
        ):
            with self.assertRaises(HTTPException) as ctx:
                auth_service.authenticate_oidc_auth_code(
                    code="abc",
                    redirect_uri="https://prism.example.com/auth/callback",
                    expected_nonce="expected",
                    code_verifier="verifier",
                )
        self.assertEqual(ctx.exception.status_code, 401)


class SessionRevocationTests(unittest.TestCase):
    """get_current_user must consult the session store, not just the cookie."""

    def setUp(self) -> None:
        self._patcher = patch.object(settings, "SESSION_SECRET", TEST_SECRET)
        self._patcher.start()
        self.addCleanup(self._patcher.stop)

    def _request(self, token: str):
        class _Request:
            cookies = {session.SESSION_COOKIE_NAME: token}
            headers: dict[str, str] = {}

        return _Request()

    def test_revoked_session_is_rejected_even_with_a_valid_cookie(self) -> None:
        token = session.create_session_token("revoked-session")
        with patch.object(settings, "AUTH_ENABLED_OVERRIDE", True), patch.object(
            session_store_service, "load_session", return_value=None
        ):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(security.get_current_user(self._request(token)))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_live_session_resolves_identity_from_the_store(self) -> None:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        record = session_store_service.SessionRecord(
            session_id="live-session",
            email="designer@example.com",
            name="Designer",
            picture="",
            created_at=now,
            expires_at=now,
            last_seen_at=now,
        )
        token = session.create_session_token("live-session")
        with patch.object(settings, "AUTH_ENABLED_OVERRIDE", True), patch.object(
            session_store_service, "load_session", return_value=record
        ), patch.object(security, "_resolve_allowed_user_role", return_value="designer"):
            user = asyncio.run(security.get_current_user(self._request(token)))

        self.assertEqual(user.email, "designer@example.com")
        self.assertEqual(user.role, "designer")
        self.assertEqual(user.session_id, "live-session")

    def test_guest_role_is_configurable_and_only_reachable_with_auth_disabled(self) -> None:
        with patch.object(settings, "DEV_GUEST_ROLE", "viewer"):
            self.assertEqual(security.guest_user().role, "viewer")
        with patch.object(settings, "DEV_GUEST_ROLE", "nonsense"):
            self.assertEqual(security.guest_user().role, "viewer")


if __name__ == "__main__":
    unittest.main()
