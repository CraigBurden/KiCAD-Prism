"""ASGI requests against a test app, without adding httpx to Prism's runtime/test lock."""

from __future__ import annotations

import json
from types import SimpleNamespace

from app.core.security import AuthenticatedUser, get_current_user

#: One signed-in user per role, by role name.
USERS = {
    role: AuthenticatedUser(email=f"{role}@example.com", name=role, role=role)
    for role in ("viewer", "qa", "designer", "admin")
}


def request(app, method: str, path: str, *, body=None, headers=None, user="designer"):
    """One ASGI request without adding httpx to Prism's runtime/test lock."""

    import asyncio

    raw_path, _, query = path.partition("?")
    payload = b"" if body is None else json.dumps(body).encode()
    header_list = [(b"content-type", b"application/json")]
    header_list += [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    messages: list[dict] = []
    sent = False

    async def receive() -> dict:
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": payload, "more_body": False}

    async def send(message: dict) -> None:
        messages.append(message)

    from urllib.parse import unquote

    app.dependency_overrides[get_current_user] = lambda: USERS[user]
    try:
        asyncio.run(app({
            "type": "http", "http_version": "1.1", "method": method, "scheme": "http",
            "path": unquote(raw_path), "raw_path": raw_path.encode(), "query_string": query.encode(),
            "headers": header_list, "client": ("test", 1), "server": ("test", 80), "root_path": "",
        }, receive, send))
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    start = next(m for m in messages if m["type"] == "http.response.start")
    data = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    response_headers = {k.decode().lower(): v.decode() for k, v in start["headers"]}
    return SimpleNamespace(
        status=start["status"], headers=response_headers, text=data.decode("utf-8", "replace"),
        json=json.loads(data) if data and response_headers.get("content-type", "").startswith("application/json") else None,
    )
