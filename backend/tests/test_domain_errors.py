"""The typed domain errors and the one handler that renders them (AC-10)."""

from __future__ import annotations

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import install_error_handlers  # noqa: E402
from app.core import errors


def _client(raise_error) -> TestClient:
    app = FastAPI()
    install_error_handlers(app)
    errors.install_error_handlers(app)

    @app.get("/boom")
    def boom():
        raise_error()

    return TestClient(app, raise_server_exceptions=False)


class DomainErrorClassesTest(unittest.TestCase):
    def test_each_class_fixes_the_status(self) -> None:
        cases = [
            (errors.BadRequest, 400),
            (errors.Forbidden, 403),
            (errors.NotFound, 404),
            (errors.Conflict, 409),
            (errors.StaleVersion, 412),
            (errors.Invalid, 422),
            (errors.UpstreamFailure, 502),
            (errors.Unavailable, 503),
        ]
        for cls, status in cases:
            with self.subTest(cls=cls.__name__):
                error = cls("message")
                self.assertEqual(error.status_code, status)
                # No code unless the error carries one: the body is today's {"detail": ...}.
                self.assertEqual(error.body(), {"detail": "message"})
                self.assertEqual(str(error), "message")

    def test_a_code_and_extras_sit_beside_detail(self) -> None:
        error = errors.Forbidden("no", code="publication_required", requiredRole="designer")
        self.assertEqual(error.body(), {"detail": "no", "code": "publication_required", "requiredRole": "designer"})

    def test_overrides_do_not_leak_into_the_class(self) -> None:
        error = errors.Conflict("x", code="revision_conflict", status_code=412, currentRevision=3)
        self.assertEqual(error.status_code, 412)
        self.assertEqual(error.body(), {"detail": "x", "code": "revision_conflict", "currentRevision": 3})
        self.assertEqual((errors.Conflict.status_code, errors.Conflict.code), (409, None))

    def test_client_detail_can_differ_from_the_internal_message(self) -> None:
        error = errors.NotFound("sys-123", detail="Not found")
        self.assertEqual(str(error), "sys-123")
        self.assertEqual(error.body()["detail"], "Not found")

    def test_empty_message_falls_back_to_the_class_default(self) -> None:
        self.assertEqual(errors.NotFound().body()["detail"], "Not found")


class HandlerTest(unittest.TestCase):
    def test_renders_body_status_and_headers(self) -> None:
        def raise_stale():
            raise errors.StaleVersion("System has changed; reload it", headers={"ETag": '"sys:s:4"'})

        response = _client(raise_stale).get("/boom")
        self.assertEqual(response.status_code, 412)
        self.assertEqual(response.headers["etag"], '"sys:s:4"')
        self.assertEqual(response.json(), {"detail": "System has changed; reload it"})

    def test_subclasses_defined_by_services_use_the_same_handler(self) -> None:
        class PasswordTooShort(errors.Invalid, ValueError):
            code = "password_policy"

        def raise_custom():
            raise PasswordTooShort("Password must be at least 12 characters")

        response = _client(raise_custom).get("/boom")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "password_policy")

    def test_untyped_exceptions_never_reach_the_client(self) -> None:
        def raise_untyped():
            raise RuntimeError("postgresql://ci:secret@db/prism refused")

        response = _client(raise_untyped).get("/boom")
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("secret", response.text)

    def test_the_application_installs_the_handler(self) -> None:
        import os
        from unittest.mock import patch

        from app.core.config import settings

        with patch.dict(os.environ, {"AUTH_ENABLED": "false"}), patch.object(
            settings, "AUTH_ENABLED_OVERRIDE", False
        ):
            from app.main import app

        self.assertIn(errors.DomainError, app.exception_handlers)


class ValueErrorBridgeTest(unittest.TestCase):
    def test_bare_value_error_becomes_the_requested_status(self) -> None:
        for status, cls in ((400, errors.BadRequest), (404, errors.NotFound), (422, errors.Invalid)):
            with self.subTest(status=status):
                with self.assertRaises(cls) as caught:
                    with errors.value_errors_as(status):
                        raise ValueError("Unknown sort field")
                self.assertEqual(caught.exception.status_code, status)
                self.assertEqual(caught.exception.body()["detail"], "Unknown sort field")

    def test_typed_errors_pass_through(self) -> None:
        class TypedConflict(errors.Conflict, ValueError):
            pass

        with self.assertRaises(TypedConflict):
            with errors.value_errors_as(400):
                raise TypedConflict("changed")

    def test_other_exceptions_are_not_caught(self) -> None:
        with self.assertRaises(KeyError):
            with errors.value_errors_as(400):
                raise KeyError("x")


if __name__ == "__main__":
    unittest.main()
