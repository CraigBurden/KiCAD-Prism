"""Typed domain errors and the one place they become HTTP responses.

A service refuses a request by raising a ``DomainError`` subclass. The class
fixes the status; the message is written for the caller, so it may reach the
client. Routers do not translate these: the handler ``install_error_handlers``
registers renders every one the same way::

    {"detail": "<message>", "code": "<code>", ...extra}

``detail`` keeps FastAPI's key so every existing reader (browser, KiCad panel,
scripts) keeps working. ``code`` is present when the error carries one (the
comment, tracker and catalog errors do; a plain ``NotFound`` does not), and
extra fields (``currentRevision``, ``requiredRole`` ...) sit beside it.
``headers`` (an ``ETag`` on a stale write) are sent with the response. A domain
whose clients read an older body shape overrides ``body()`` (catalog conflicts).

Status codes stay with the domain that owns them: System Builder answers a
stale whole-system ETag with 412 (``StaleVersion``); comments, catalog and
tracker writes carry their revision in the body and answer 409 (``Conflict``).
Pass ``status_code=`` only to keep a status an existing client depends on.

Untyped exceptions are never rendered here, so their text never reaches a
client. ``value_errors_as`` is the one remaining bridge for services that still
signal a refused input with a bare ``ValueError`` written for the caller.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Iterator, Mapping

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class DomainError(Exception):
    """A refusal the caller can act on. Subclasses fix the status."""

    status_code: int = 400
    code: str | None = None
    default_detail: str = "Request refused"

    def __init__(
        self,
        message: str = "",
        *,
        code: str | None = None,
        status_code: int | None = None,
        detail: Any = None,
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
        body: dict[str, Any] = {"detail": self.detail}
        if self.code:
            body["code"] = self.code
        return {**body, **self.extra}


class BadRequest(DomainError):
    """Bad request."""

    status_code = 400
    default_detail = "Bad request"


class Forbidden(DomainError):
    """Forbidden."""

    status_code = 403
    default_detail = "Forbidden"


class NotFound(DomainError):
    """Not found."""

    status_code = 404
    default_detail = "Not found"


class Conflict(DomainError):
    """The request contradicts the current state."""

    status_code = 409
    default_detail = "Conflict"


class StaleVersion(DomainError):
    """The resource changed since the caller read it."""

    status_code = 412
    default_detail = "The resource changed; reload it"


class Invalid(DomainError):
    """Invalid request."""

    status_code = 422
    default_detail = "Invalid request"


class UpstreamFailure(DomainError):
    """An upstream service failed."""

    status_code = 502
    default_detail = "An upstream service failed"


class Unavailable(DomainError):
    """Service unavailable."""

    status_code = 503
    default_detail = "Service unavailable"


def error_response(error: DomainError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content=error.body(), headers=error.headers or None)


async def _domain_error_handler(_request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, DomainError)
    return error_response(error)


def install_error_handlers(app: FastAPI) -> None:
    """Register the domain-error handler. ``app.main`` calls this once."""

    app.add_exception_handler(DomainError, _domain_error_handler)


_CLASS_FOR_STATUS: dict[int, type[DomainError]] = {
    400: BadRequest,
    403: Forbidden,
    404: NotFound,
    409: Conflict,
    412: StaleVersion,
    422: Invalid,
    502: UpstreamFailure,
    503: Unavailable,
}

ExceptionTypes = type[BaseException] | tuple[type[BaseException], ...]


def caller_error(error: BaseException, status_code: int) -> DomainError:
    """The typed error for an exception whose message an older service wrote for the caller."""

    return _CLASS_FOR_STATUS.get(status_code, DomainError)(str(error), status_code=status_code)


@contextmanager
def caller_errors(
    *rules: tuple[ExceptionTypes, int],
    keep_typed: bool = False,
    unexpected: str | None = None,
    unexpected_status: int = 500,
) -> Iterator[None]:
    """Render the listed exception types from the wrapped service call with a fixed status.

    The bridge for services that predate typed errors and signal a refusal with
    a built-in exception (``ValueError``, ``RuntimeError``, ``LookupError`` ...)
    whose message is written for the caller. Rules are tried in order, like
    ``except`` clauses. A typed error never matches when ``keep_typed`` is set,
    so a catalog conflict (also a ``ValueError``) keeps its own status and body;
    without it the route's status wins, as it did when the route caught the
    built-in type itself. Anything unlisted propagates and its text never
    reaches the client. ``unexpected`` keeps a route's old catch-all: any other
    exception is logged and answered ``unexpected_status`` (500) with that
    fixed message instead of its text.
    """

    try:
        yield
    except Exception as error:
        status = None if keep_typed and isinstance(error, DomainError) else _matching_status(error, rules)
        if status is not None:
            raise caller_error(error, status) from error
        if unexpected is None or isinstance(error, (DomainError, HTTPException)):
            raise
        logger.exception("%s", unexpected)
        raise caller_error(Exception(unexpected), unexpected_status) from error


def _matching_status(error: BaseException, rules: tuple[tuple[ExceptionTypes, int], ...]) -> int | None:
    for types, status in rules:
        if isinstance(error, types):
            return status
    return None


def value_errors_as(status_code: int = 400, *, keep_typed: bool = False):
    """``caller_errors`` for the common case: a bare ``ValueError`` becomes ``status_code``."""

    return caller_errors((ValueError, status_code), keep_typed=keep_typed)


def from_value_error(error: ValueError, status_code: int = 400) -> DomainError:
    """``caller_error`` for a router that already holds the ``ValueError``."""

    return caller_error(error, status_code)


__all__ = [
    "BadRequest",
    "caller_error",
    "caller_errors",
    "Conflict",
    "DomainError",
    "Forbidden",
    "Invalid",
    "NotFound",
    "StaleVersion",
    "Unavailable",
    "UpstreamFailure",
    "error_response",
    "from_value_error",
    "install_error_handlers",
    "value_errors_as",
]
