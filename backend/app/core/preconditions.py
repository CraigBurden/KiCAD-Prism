"""ETags and ``If-Match`` for guarded writes: one conflict shape for every domain.

A guarded resource (a System, a comment or reply, a catalog component) has an
ETag ``"<kind>:<id>:<version>"``. A client sends it back as ``If-Match`` on a
write. The route reads the version with ``if_match``; the service compares it
with the current one inside its transaction and raises its ``StaleVersion``
(412, with the current ETag in the response headers) when they differ.

* No ``If-Match`` on a write that must be guarded: 428 (``PreconditionRequired``).
* No ``If-Match`` on a write whose guard is optional (``required=False``): ``None``,
  and the service writes unguarded, as it did when the body omitted the revision.
* An ``If-Match`` that is not this resource's ETag (another kind or id, ``*``,
  garbage): ``STALE``, a version no resource is ever at, so the service answers
  412 with the real ETag and the client can reload.
"""

from __future__ import annotations

import re
from typing import Optional

from fastapi import Request

from app.core.errors import PreconditionRequired

STALE = "\x00stale"
"""The version an ``If-Match`` for another resource reads as. Never current."""

_ETAG = re.compile(r'^(?:W/)?"([a-z][a-z0-9-]*):([^"]+):([^":]+)"$')


def etag(kind: str, resource_id: str, version: object) -> str:
    return f'"{kind}:{resource_id}:{version}"'


def parse_if_match(raw: Optional[str], kind: str, resource_id: str, *, required: bool = True) -> Optional[str]:
    """The version ``raw`` names for ``kind``/``resource_id`` (see the module notes)."""

    text = (raw or "").strip()
    if not text:
        if required:
            raise PreconditionRequired("If-Match is required")
        return None
    match = _ETAG.match(text)
    if not match or match.group(1) != kind or match.group(2) != resource_id:
        return STALE
    return match.group(3)


def if_match(request: Request, kind: str, resource_id: str, *, required: bool = True) -> Optional[str]:
    """``parse_if_match`` on the request's ``If-Match`` header."""

    return parse_if_match(request.headers.get("if-match"), kind, resource_id, required=required)


def int_version(version: Optional[str]) -> Optional[int]:
    """An integer-versioned resource's expected version; ``STALE`` and non-integers become -1 (never current)."""

    if version is None:
        return None
    return int(version) if version.isdigit() else -1


__all__ = ["STALE", "etag", "if_match", "int_version", "parse_if_match"]
