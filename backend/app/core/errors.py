"""Typed domain errors and the one place they become HTTP responses.

A service refuses a request by raising a ``DomainError`` subclass. The class
fixes the status and a default machine ``code``; the message is written for the
caller, so it may reach the client. Routers do not translate these: the handler
``install_error_handlers`` registers renders every one the same way::

    {"detail": "<message>", "code": "<code>", ...extra}

``detail`` keeps FastAPI's key so every existing reader (browser, KiCad panel,
scripts) keeps working; ``code`` and any extra fields (``currentRevision``,
``requiredRole`` ...) sit beside it. ``headers`` (an ``ETag`` on a stale write)
are sent with the response.

Status codes stay with the domain that owns them: System Builder answers a
stale whole-system ETag with 412 (``StaleVersion``); comments, catalog and
tracker writes carry their revision in the body and answer 409 (``Conflict``).
Pass ``status_code=`` only to keep a status an existing client depends on.

Untyped exceptions are never rendered here, so their text never reaches a
client. ``value_errors_as`` is the one remaining bridge for services that still
signal a refused input with a bare ``ValueError`` written for the caller.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator, Mapping

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DomainError(Exception):
    """A refusal the caller can act on. Subclasses fix the status."""

    status_code: int = 400
    code: str = "bad_request"
    default_detail: str = "Request refused"

    def __init__(
        self,
        message: str = "",
        *,
        code: str | None = None,
        status_code: int | None = None,
        detail: str | None = None,
        headers: Mapping[str, str] | None = None,
        **extra: Any,
    ) -> None:
        super().__init__(message)
        if code:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.detail = detail if detail is not None else (message or self.default_detail)
        self.headers = dict(headers or {})
        self.extra = extra

    def body(self) -> dict[str, Any]:
        return {"detail": self.detail, "code": self.code, **self.extra}


class BadRequest(DomainError):
    """Bad request."""

    status_code = 400
    code = "bad_request"
    default_detail = "Bad request"


class Forbidden(DomainError):
    """Forbidden."""

    status_code = 403
    code = "forbidden"
    default_detail = "Forbidden"


class NotFound(DomainError):
    """Not found."""

    status_code = 404
    code = "not_found"
    default_detail = "Not found"


class Conflict(DomainError):
    """The request contradicts the current state."""

    status_code = 409
    code = "conflict"
    default_detail = "Conflict"


class StaleVersion(DomainError):
    """The resource changed since the caller read it."""

    status_code = 412
    code = "stale_version"
    default_detail = "The resource changed; reload it"


class Invalid(DomainError):
    """Invalid request."""

    status_code = 422
    code = "invalid"
    default_detail = "Invalid request"


class UpstreamFailure(DomainError):
    """An upstream service failed."""

    status_code = 502
    code = "upstream_failure"
    default_detail = "An upstream service failed"


class Unavailable(DomainError):
    """Service unavailable."""

    status_code = 503
    code = "unavailable"
    default_detail = "Service unavailable"


def error_response(error: DomainError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content=error.body(), headers=error.headers or None)


async def _domain_error_handler(_request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, DomainError)
    return error_response(error)


def install_error_handlers(app: FastAPI) -> None:
    """Register the domain-error handler. ``app.main`` calls this once."""

    app.add_exception_handler(DomainError, _domain_error_handler)


_VALUE_ERROR_CLASSES: dict[int, type[DomainError]] = {
    400: BadRequest,
    404: NotFound,
    409: Conflict,
    422: Invalid,
}


@contextmanager
def value_errors_as(status_code: int = 400) -> Iterator[None]:
    """Render a bare ``ValueError`` from the wrapped service call as ``status_code``.

    Older services refuse input with ``ValueError`` and a message written for
    the caller. This keeps that contract in one place until they raise typed
    errors. Typed errors pass through unchanged; nothing else is caught.
    """

    try:
        yield
    except DomainError:
        raise
    except ValueError as error:
        raise _VALUE_ERROR_CLASSES.get(status_code, BadRequest)(
            str(error), status_code=status_code
        ) from error


__all__ = [
    "BadRequest",
    "Conflict",
    "DomainError",
    "Forbidden",
    "Invalid",
    "NotFound",
    "StaleVersion",
    "Unavailable",
    "UpstreamFailure",
    "error_response",
    "install_error_handlers",
    "value_errors_as",
]
