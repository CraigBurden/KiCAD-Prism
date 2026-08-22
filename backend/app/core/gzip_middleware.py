"""A gzip middleware we control, instead of Starlette's built-in.

Starlette's ``GZipMiddleware`` behaves differently across the versions this
image might resolve (``fastapi`` is unpinned): older builds have no
``206 Partial Content`` guard, no binary content-type exclusion, and default to
``compresslevel=9`` on the event loop. Rather than gamble on which version ships,
the small responder here does exactly what this deployment needs, the same way
on every version.

It must be registered *innermost* (before other middleware) so it sees the
application's real, buffered response rather than an already-wrapped streaming
body; only then does the ``minimum_size`` check mean anything.
"""

from __future__ import annotations

import gzip
import io
from typing import Any, Awaitable, Callable, MutableMapping

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


class GzipMiddleware:
    """Compress buffered HTTP responses for clients that accept gzip.

    Only whole (non-streaming) responses at least ``minimum_size`` bytes are
    compressed; everything else is passed through untouched with its headers
    and ``Content-Length`` intact.
    """

    def __init__(self, app: ASGIApp, *, minimum_size: int = 1024) -> None:
        self.app = app
        self.minimum_size = minimum_size

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        if "gzip" not in _accept_encoding(scope):
            await self.app(scope, receive, send)
            return
        await _GzipResponder(self.app, self.minimum_size)(scope, receive, send)


class _GzipResponder:
    def __init__(self, app: ASGIApp, minimum_size: int) -> None:
        self.app = app
        self.minimum_size = minimum_size
        self.start_message: Message | None = None
        self.body = bytearray()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        self._send = send

        async def buffer(message: Message) -> None:
            if message["type"] == "http.response.start":
                # Hold the start until the body is buffered, so the decision to
                # compress can rewrite the headers.
                self.start_message = message
                return
            if message["type"] == "http.response.body":
                self.body.extend(message.get("body", b""))
                if message.get("more_body", False):
                    return
                await self._finish()
                return
            await send(message)

        await self.app(scope, receive, buffer)

    async def _finish(self) -> None:
        assert self.start_message is not None
        headers = _Headers(self.start_message)
        body = bytes(self.body)

        if len(body) < self.minimum_size or not _is_compressible(
            self.start_message.get("status", 200), headers
        ):
            await self._passthrough(body)
            return

        compressed = _gzip_bytes(body)
        headers.set(b"content-encoding", b"gzip")
        headers.set(b"content-length", str(len(compressed)).encode("latin-1"))
        headers.add_vary_accept_encoding()
        await self._send(self.start_message)
        await self._send(
            {"type": "http.response.body", "body": compressed, "more_body": False}
        )

    async def _passthrough(self, body: bytes) -> None:
        await self._send(self.start_message)
        await self._send(
            {"type": "http.response.body", "body": body, "more_body": False}
        )


def _is_compressible(status: int, headers: "_Headers") -> bool:
    """Whether this response is safe to gzip.

    A ``206 Partial Content`` carries a byte range whose ``Content-Range``
    describes identity bytes; gzipping the body would leave the range header
    describing a length the body no longer has, so a ranged or resumed download
    reassembles garbage. A response that already set ``Content-Encoding`` (or is
    a range response) is left exactly as the application produced it.
    """

    if status == 206:
        return False
    if headers.get(b"content-range") is not None:
        return False
    if headers.get(b"content-encoding") is not None:
        return False
    return True


def _accept_encoding(scope: Scope) -> str:
    for key, value in scope.get("headers", ()):  # type: ignore[union-attr]
        if key == b"accept-encoding":
            return value.decode("latin-1")
    return ""


def _gzip_bytes(body: bytes) -> bytes:
    buffer = io.BytesIO()
    with gzip.GzipFile(mode="wb", fileobj=buffer) as handle:
        handle.write(body)
    return buffer.getvalue()


class _Headers:
    """Small mutable view over an ASGI start message's raw header list."""

    def __init__(self, start_message: Message) -> None:
        self._raw: list[tuple[bytes, bytes]] = list(start_message.get("headers", []))
        start_message["headers"] = self._raw

    def get(self, name: bytes) -> bytes | None:
        lowered = name.lower()
        for key, value in self._raw:
            if key.lower() == lowered:
                return value
        return None

    def set(self, name: bytes, value: bytes) -> None:
        lowered = name.lower()
        for index, (key, _) in enumerate(self._raw):
            if key.lower() == lowered:
                self._raw[index] = (key, value)
                return
        self._raw.append((name, value))

    def add_vary_accept_encoding(self) -> None:
        existing = self.get(b"vary")
        if existing is None:
            self.set(b"vary", b"Accept-Encoding")
            return
        parts = [part.strip().lower() for part in existing.split(b",")]
        if b"accept-encoding" not in parts:
            self.set(b"vary", existing + b", Accept-Encoding")
