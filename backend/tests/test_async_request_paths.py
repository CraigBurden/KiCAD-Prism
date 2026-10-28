"""Blocking stores must not occupy the event loop shared by every request."""

import asyncio
import threading
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi import HTTPException, Response
from starlette.requests import Request

from app.core.errors import DomainError  # noqa: E402
from app.api import _helpers as api_helpers
from app.api import agent as agent_api
from app.api import auth as auth_api
from app.api import catalog_admin as catalog_admin_api
from app.api import comments as comments_api
from app.core import security, session
from app.core.config import settings
from app.services import session_store_service

# A route refuses with an HTTPException or a typed domain error (rendered by the app handler).
ROUTE_ERRORS = (HTTPException, DomainError)


TEST_SECRET = "unit-test-session-secret-with-enough-length"


def _request(token: str):
    class _Request:
        cookies = {session.SESSION_COOKIE_NAME: token}
        headers: dict[str, str] = {}

    return _Request()


def _record(session_id: str, email: str) -> session_store_service.SessionRecord:
    now = datetime.now(timezone.utc)
    return session_store_service.SessionRecord(
        session_id=session_id,
        email=email,
        name="Designer",
        picture="",
        created_at=now,
        expires_at=now,
        last_seen_at=now,
    )


class _BlockedStore:
    """A store call that waits on a gate the test releases, mimicking a hung backend."""

    def __init__(self, result=None, error: Exception | None = None) -> None:
        self.gate = threading.Event()
        self.entered = threading.Event()
        self.result = result
        self.error = error

    def __call__(self, *args, **kwargs):
        self.entered.set()
        if not self.gate.wait(timeout=5):
            raise AssertionError("store gate was never released")
        if self.error is not None:
            raise self.error
        return self.result


class _CountingStore:
    """A store that counts how many callers are inside it at once."""

    def __init__(self, expect: int = 4) -> None:
        self._lock = threading.Lock()
        self._release = threading.Event()
        self._expect = expect
        self.current = 0
        self.peak = 0
        self.borrowed = threading.Event()

    def __call__(self, *args, **kwargs):
        with self._lock:
            self.current += 1
            self.peak = max(self.peak, self.current)
            if self.current >= self._expect:
                self.borrowed.set()
        self._release.wait(timeout=5)
        with self._lock:
            self.current -= 1
        return None

    def release(self) -> None:
        self._release.set()


async def _lightweight_probe_completes_while(pending: asyncio.Task) -> bool:
    """Run a trivial coroutine next to `pending` and report whether it finished promptly."""
    probe = asyncio.create_task(asyncio.sleep(0.01))
    done, _ = await asyncio.wait({probe}, timeout=1.0)
    return probe in done and not pending.done()


class AuthenticationDoesNotBlockTheLoopTests(unittest.TestCase):
    def setUp(self) -> None:
        patcher = patch.object(settings, "SESSION_SECRET", TEST_SECRET)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_blocked_session_store_does_not_stall_an_unrelated_request(self) -> None:
        token = session.create_session_token("slow-session")
        blocked = _BlockedStore()

        async def scenario() -> tuple[bool, HTTPException]:
            auth = asyncio.create_task(security.get_current_user(_request(token)))
            await asyncio.get_running_loop().run_in_executor(None, blocked.entered.wait, 2)
            probe_finished = await _lightweight_probe_completes_while(auth)
            blocked.gate.set()
            with self.assertRaises(ROUTE_ERRORS) as ctx:
                await auth
            return probe_finished, ctx.exception

        with patch.object(settings, "AUTH_ENABLED_OVERRIDE", True), patch.object(
            session_store_service, "load_session", blocked
        ):
            probe_finished, error = asyncio.run(scenario())

        self.assertTrue(probe_finished, "the event loop was blocked by the session store")
        # A store that answers "no session" still yields the revoked-session result.
        self.assertEqual(error.status_code, 401)

    def test_blocked_bearer_validation_does_not_stall_an_unrelated_request(self) -> None:
        blocked = _BlockedStore(error=HTTPException(status_code=401, detail="Invalid bearer token"))

        class _Request:
            cookies: dict[str, str] = {}
            headers = {"authorization": "Bearer v1.opaque-token"}

        async def scenario() -> bool:
            auth = asyncio.create_task(security.get_current_user(_Request()))
            await asyncio.get_running_loop().run_in_executor(None, blocked.entered.wait, 2)
            probe_finished = await _lightweight_probe_completes_while(auth)
            blocked.gate.set()
            with self.assertRaises(ROUTE_ERRORS):
                await auth
            return probe_finished

        with patch.object(settings, "AUTH_ENABLED_OVERRIDE", True), patch.object(
            security, "_resolve_bearer_user", blocked
        ):
            self.assertTrue(asyncio.run(scenario()))

    def test_revoked_and_unassigned_sessions_keep_their_results(self) -> None:
        token = session.create_session_token("session-a")
        with patch.object(settings, "AUTH_ENABLED_OVERRIDE", True):
            with patch.object(session_store_service, "load_session", return_value=None):
                with self.assertRaises(ROUTE_ERRORS) as revoked:
                    asyncio.run(security.get_current_user(_request(token)))
            with patch.object(
                session_store_service, "load_session", return_value=_record("session-a", "nobody@example.com")
            ), patch.object(security, "_resolve_allowed_user_role", return_value=None):
                with self.assertRaises(ROUTE_ERRORS) as unassigned:
                    asyncio.run(security.get_current_user(_request(token)))
            with patch.object(
                session_store_service, "load_session", return_value=_record("session-a", "qa@example.com")
            ), patch.object(security, "_resolve_allowed_user_role", return_value="qa"):
                user = asyncio.run(security.get_current_user(_request(token)))

        self.assertEqual(revoked.exception.status_code, 401)
        self.assertEqual(unassigned.exception.status_code, 403)
        self.assertEqual((user.email, user.role, user.session_id), ("qa@example.com", "qa", "session-a"))


def _http_request() -> Request:
    return Request({
        "type": "http",
        "method": "POST",
        "headers": [(b"user-agent", b"unit-test")],
        "client": ("127.0.0.1", 12345),
        "query_string": b"",
    })


class LoginRateLimiterDoesNotBlockTheLoopTests(unittest.TestCase):
    """The limiter writes to PostgreSQL before any login work; it must not hold the loop."""

    def setUp(self) -> None:
        for name, value in (("AUTH_ENABLED_OVERRIDE", True), ("PASSWORD_AUTH_ENABLED", True)):
            patcher = patch.object(settings, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def _entry_points(self):
        start = lambda: auth_api.start_login(_http_request(), Response())
        callback = lambda: auth_api.login(
            auth_api.LoginRequest(code="c", state="s", redirectUri="https://app/auth/callback"),
            _http_request(),
            Response(),
        )
        password = lambda: auth_api.login_with_password(
            auth_api.PasswordLoginRequest(email="u@example.com", password="pw"), _http_request(), Response()
        )
        return (("start", start), ("callback", callback), ("password", password))

    def test_blocked_limiter_does_not_stall_an_unrelated_request(self) -> None:
        for action, entry in self._entry_points():
            with self.subTest(action=action):
                blocked = _BlockedStore(error=HTTPException(status_code=429, detail="Too many attempts"))

                async def scenario() -> bool:
                    login = asyncio.create_task(entry())
                    await asyncio.get_running_loop().run_in_executor(None, blocked.entered.wait, 2)
                    probe_finished = await _lightweight_probe_completes_while(login)
                    blocked.gate.set()
                    with self.assertRaises(ROUTE_ERRORS) as ctx:
                        await login
                    self.assertEqual(ctx.exception.status_code, 429)
                    return probe_finished

                with patch.object(auth_api, "oidc_enabled", return_value=True), patch.object(
                    auth_api.rate_limit_service, "enforce", blocked
                ):
                    self.assertTrue(asyncio.run(scenario()), f"the event loop was blocked by the {action} limiter")

    def test_a_limited_request_attempts_no_authentication(self) -> None:
        provider_calls = {
            "build_oidc_authorization_url": MagicMock(),
            "authenticate_oidc_auth_code": MagicMock(),
            "authenticate_password": MagicMock(),
            "_issue_session": MagicMock(),
        }
        limited = MagicMock(side_effect=HTTPException(status_code=429, detail="Too many attempts"))
        for action, entry in self._entry_points():
            with self.subTest(action=action):
                with patch.object(auth_api, "oidc_enabled", return_value=True), patch.object(
                    auth_api.rate_limit_service, "enforce", limited
                ), patch.multiple(auth_api, **provider_calls):
                    with self.assertRaises(ROUTE_ERRORS) as ctx:
                        asyncio.run(entry())
                self.assertEqual(ctx.exception.status_code, 429)
        for name, call in provider_calls.items():
            call.assert_not_called()
        self.assertEqual(limited.call_count, 3)


class CommentReadsDoNotBlockTheLoopTests(unittest.TestCase):
    def test_blocked_comment_store_does_not_stall_an_unrelated_request(self) -> None:
        blocked = _BlockedStore()
        user = security.AuthenticatedUser(email="v@example.com", name="V", role="viewer")

        async def scenario() -> bool:
            read = asyncio.create_task(comments_api.get_comments("prj", user))
            await asyncio.get_running_loop().run_in_executor(None, blocked.entered.wait, 2)
            probe_finished = await _lightweight_probe_completes_while(read)
            blocked.gate.set()
            with self.assertRaises(ROUTE_ERRORS) as ctx:
                await read
            self.assertEqual(ctx.exception.status_code, 404)
            return probe_finished

        with patch.object(api_helpers.workspace, "get_project_for_role", blocked):
            self.assertTrue(asyncio.run(scenario()))

    def test_project_role_filtering_is_preserved_on_reads(self) -> None:
        user = security.AuthenticatedUser(email="v@example.com", name="V", role="viewer")
        with patch.object(api_helpers.workspace, "get_project_for_role", return_value=None) as lookup:
            with self.assertRaises(ROUTE_ERRORS) as ctx:
                asyncio.run(comments_api.get_comments("prj", user))
        self.assertEqual(ctx.exception.status_code, 404)
        lookup.assert_called_once_with("prj", "viewer")


class _Upload:
    """The parts of an UploadFile the catalog import endpoints read."""

    filename = "parts.kicad_sym"

    async def read(self) -> bytes:
        return b"(kicad_symbol_lib)"


class CatalogUploadsDoNotBlockTheLoopTests(unittest.TestCase):
    """Symbol import shells out to kicad-cli; a slow run must not stall other requests."""

    def test_blocked_symbol_import_does_not_stall_an_unrelated_request(self) -> None:
        blocked = _BlockedStore(result={"asset_id": "sym-1"})
        user = security.AuthenticatedUser(email="d@example.com", name="D", role="designer")

        async def scenario() -> tuple[bool, dict]:
            upload = asyncio.create_task(
                catalog_admin_api.import_symbol_library("cmp", _Upload(), "", "", "", request=Request({"type": "http", "headers": []}), user=user)
            )
            await asyncio.get_running_loop().run_in_executor(None, blocked.entered.wait, 2)
            probe_finished = await _lightweight_probe_completes_while(upload)
            blocked.gate.set()
            return probe_finished, await upload

        with patch.object(catalog_admin_api.catalog_service, "import_symbol_library", blocked):
            probe_finished, result = asyncio.run(scenario())

        self.assertTrue(probe_finished, "the event loop was blocked by the symbol import")
        self.assertEqual(result, {"asset_id": "sym-1"})

    def test_import_errors_still_map_to_catalog_responses(self) -> None:
        user = security.AuthenticatedUser(email="d@example.com", name="D", role="designer")
        with patch.object(
            catalog_admin_api.catalog_service, "import_symbol_library", side_effect=ValueError("Uploaded library has no symbols")
        ):
            with self.assertRaises(ROUTE_ERRORS) as ctx:
                asyncio.run(catalog_admin_api.import_symbol_library("cmp", _Upload(), "", "", "", request=Request({"type": "http", "headers": []}), user=user))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Uploaded library has no symbols")


class VariantCatalogReadsDoNotBlockTheLoopTests(unittest.TestCase):
    """Catalog discovery reads files and runs git; it must not hold the loop."""

    def test_blocked_catalog_discovery_does_not_stall_an_unrelated_request(self) -> None:
        from app.api import project_variants as variants_api

        blocked = _BlockedStore(
            result={
                "schema": "prism.project_variants_a0",
                "projectId": "prj",
                "commit": None,
                "sourceRevisionKey": "key",
                "variants": [],
                "diagnostics": [],
            }
        )
        user = security.AuthenticatedUser(email="v@example.com", name="V", role="viewer")

        async def scenario() -> bool:
            read = asyncio.create_task(
                variants_api.get_project_variants(
                    "prj", _http_request(), None, user
                )
            )
            await asyncio.get_running_loop().run_in_executor(None, blocked.entered.wait, 2)
            probe_finished = await _lightweight_probe_completes_while(read)
            blocked.gate.set()
            response = await read
            self.assertEqual(response.status_code, 200)
            return probe_finished

        from unittest.mock import MagicMock

        from app.services.design_bundle import consumer as bundle_consumer

        opened = MagicMock()
        opened.working_tree_dirty = False
        with patch.object(
            variants_api, "get_project_for_role_or_404"
        ), patch.object(
            bundle_consumer, "bundle_read", return_value=bundle_consumer.BundleRead(opened, {})
        ), patch.object(
            variants_api.variant_catalog_service,
            "discover_variant_catalog",
            blocked,
        ):
            self.assertTrue(
                asyncio.run(scenario()),
                "the event loop was blocked by catalog discovery",
            )


class AgentTokenExchangeDoesNotBlockTheLoopTests(unittest.TestCase):
    """The agent's PKCE exchange consumes a code and records a token in PostgreSQL.

    The KiCad agent calls this while the user waits on a loopback redirect, so a
    slow catalog must stall that one exchange, not every other request.
    """

    def test_blocked_code_exchange_does_not_stall_an_unrelated_request(self) -> None:
        blocked = _BlockedStore(result={"access_token": "v1.token", "token_type": "Bearer"})

        async def scenario() -> bool:
            exchange = asyncio.create_task(
                agent_api.token(
                    code="one-time",
                    redirect_uri="http://127.0.0.1:1234/callback",
                    code_verifier="verifier",
                )
            )
            await asyncio.get_running_loop().run_in_executor(None, blocked.entered.wait, 2)
            probe_finished = await _lightweight_probe_completes_while(exchange)
            blocked.gate.set()
            response = await exchange
            self.assertEqual(response.status_code, 200)
            return probe_finished

        with patch.object(
            agent_api.agent_auth_service, "exchange_authorization_code", blocked
        ):
            self.assertTrue(
                asyncio.run(scenario()),
                "the event loop was blocked by the agent code exchange",
            )


class AgentTokenRevocationDoesNotBlockTheLoopTests(unittest.TestCase):
    """Revocation reads the token row, checks ownership, then writes. All blocking."""

    def test_blocked_token_lookup_does_not_stall_an_unrelated_request(self) -> None:
        blocked = _BlockedStore(result={"email": "v@example.com"})
        user = security.AuthenticatedUser(email="v@example.com", name="V", role="viewer")

        async def scenario() -> bool:
            revoke = asyncio.create_task(agent_api.revoke_token("jti-1", user))
            await asyncio.get_running_loop().run_in_executor(None, blocked.entered.wait, 2)
            probe_finished = await _lightweight_probe_completes_while(revoke)
            blocked.gate.set()
            self.assertEqual(await revoke, {"status": "revoked"})
            return probe_finished

        with patch.object(agent_api.agent_auth_service, "get_agent_token", blocked), patch.object(
            agent_api.agent_auth_service, "revoke_agent_token_by_jti"
        ):
            self.assertTrue(
                asyncio.run(scenario()),
                "the event loop was blocked by agent token revocation",
            )

    def test_ownership_is_still_refused_when_the_check_runs_off_the_loop(self) -> None:
        """Moving the sequence to a worker thread must not weaken the check."""
        user = security.AuthenticatedUser(email="v@example.com", name="V", role="viewer")
        revoked = MagicMock()

        with patch.object(
            agent_api.agent_auth_service, "get_agent_token", return_value={"email": "someone@else.com"}
        ), patch.object(agent_api.agent_auth_service, "revoke_agent_token_by_jti", revoked):
            with self.assertRaises(ROUTE_ERRORS) as ctx:
                asyncio.run(agent_api.revoke_token("jti-1", user))

        self.assertEqual(ctx.exception.status_code, 403)
        revoked.assert_not_called()


class ViewerSourceReadsDoNotBlockTheLoopTests(unittest.TestCase):
    """Viewer sources inflate whole bundle members; that read must not hold the loop."""

    def test_blocked_bundle_read_does_not_stall_an_unrelated_request(self) -> None:
        from app.api import project_viewer_sources as viewer_api
        from app.services import project_viewer_sources_bundle as mapping

        blocked = _BlockedStore()
        user = security.AuthenticatedUser(email="v@example.com", name="V", role="viewer")

        async def scenario() -> bool:
            read = asyncio.create_task(viewer_api.get_project_schematic("prj", request=None, commit=None, user=user))
            await asyncio.get_running_loop().run_in_executor(None, blocked.entered.wait, 2)
            probe_finished = await _lightweight_probe_completes_while(read)
            blocked.gate.set()
            with self.assertRaises(ROUTE_ERRORS) as ctx:
                await read
            self.assertEqual(ctx.exception.status_code, 404)
            return probe_finished

        with patch.object(viewer_api, "get_project_for_role_or_404"), patch.object(
            viewer_api, "bundle_read", blocked
        ), patch.object(mapping, "schematic", return_value=None):
            self.assertTrue(
                asyncio.run(scenario()),
                "the event loop was blocked by the bundle read",
            )

    def test_large_reads_are_admitted_only_up_to_the_memory_bound(self) -> None:
        from app.api import project_viewer_sources as viewer_api
        from app.api._blocking import MAX_CONCURRENT_LARGE_READS
        from app.services import project_viewer_sources_bundle as mapping

        counter = _CountingStore(expect=MAX_CONCURRENT_LARGE_READS)
        user = security.AuthenticatedUser(email="v@example.com", name="V", role="viewer")

        async def scenario() -> list:
            calls = [
                asyncio.create_task(viewer_api.get_project_schematic("prj", request=None, commit=None, user=user))
                for _ in range(MAX_CONCURRENT_LARGE_READS + 4)
            ]
            await asyncio.get_running_loop().run_in_executor(None, counter.borrowed.wait, 2)
            await asyncio.sleep(0.1)
            peak = counter.peak
            counter.release()
            return [peak, await asyncio.gather(*calls, return_exceptions=True)]

        with patch.object(viewer_api, "get_project_for_role_or_404"), patch.object(
            viewer_api, "bundle_read", counter
        ), patch.object(mapping, "schematic", return_value=None):
            peak, results = asyncio.run(scenario())

        self.assertEqual(peak, MAX_CONCURRENT_LARGE_READS)
        for result in results:
            self.assertIsInstance(result, HTTPException)
            self.assertEqual(result.status_code, 404)


class CommitFileReadsDoNotBlockTheLoopTests(unittest.TestCase):
    """A commit file read runs ``git cat-file``/``git show``; it must not hold the loop."""

    def test_blocked_commit_file_read_does_not_stall_an_unrelated_request(self) -> None:
        from types import SimpleNamespace

        from app.api import projects as projects_api

        blocked = _BlockedStore(
            result=SimpleNamespace(name="notes.txt", size=5, content=b"hello")
        )
        user = security.AuthenticatedUser(email="v@example.com", name="V", role="viewer")
        project = MagicMock()

        async def scenario() -> bool:
            read = asyncio.create_task(
                projects_api.get_project_commit_file("prj", "a" * 40, "notes.txt", user)
            )
            await asyncio.get_running_loop().run_in_executor(None, blocked.entered.wait, 2)
            probe_finished = await _lightweight_probe_completes_while(read)
            blocked.gate.set()
            response = await read
            self.assertEqual(response.body, b"hello")
            return probe_finished

        with patch.object(
            projects_api, "get_project_for_role_or_404", return_value=project
        ), patch.object(projects_api.project_outputs, "repo_context", return_value=("/repo", None)), patch.object(
            projects_api.file_service, "read_file_from_commit", blocked
        ):
            self.assertTrue(
                asyncio.run(scenario()),
                "the event loop was blocked by the commit file read",
            )


if __name__ == "__main__":
    unittest.main()
