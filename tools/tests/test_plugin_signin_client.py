"""The plugin's sign-in/out client calls the right agent routes.

The plugin package imports pcbnew and wx at import (kicad_plugin/__init__.py),
neither of which exists off KiCad, so agent_client is loaded standalone into a
synthetic package, the same trick test_profiles_parity uses. Then a fake agent on
loopback records what the client sent, so we can assert the route, method, and
body without a real agent or backend.
"""

from __future__ import annotations

import importlib.util
import json
import sys
import threading
import types
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

import pytest

TOOLS = Path(__file__).resolve().parents[1]
PLUGIN = TOOLS / "kicad_plugin"


def _load_agent_client():
    """Load kicad_plugin.agent_client without importing the plugin package.

    The module does `from .profiles import resolve`, so both it and profiles are
    installed into a bare synthetic `kicad_plugin` package (no __init__, so no wx
    or pcbnew import) that satisfies the relative import.
    """
    pkg = types.ModuleType("kicad_plugin")
    pkg.__path__ = [str(PLUGIN)]
    sys.modules["kicad_plugin"] = pkg

    for name in ("profiles", "agent_client"):
        spec = importlib.util.spec_from_file_location(
            f"kicad_plugin.{name}", PLUGIN / f"{name}.py"
        )
        module = importlib.util.module_from_spec(spec)
        sys.modules[f"kicad_plugin.{name}"] = module
        spec.loader.exec_module(module)
    return sys.modules["kicad_plugin.agent_client"]


agent_client = _load_agent_client()


class _FakeAgent(BaseHTTPRequestHandler):
    calls: list = []
    reply: dict = {"ok": True}

    def _handle(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        body = json.loads(raw) if raw else None
        type(self).calls.append(
            {
                "method": self.command,
                "path": urlparse(self.path).path,
                "auth": self.headers.get("Authorization", ""),
                "body": body,
            }
        )
        out = json.dumps(self.reply).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    do_GET = _handle
    do_POST = _handle
    do_PUT = _handle

    def log_message(self, *_a):  # noqa: A003
        pass


@pytest.fixture
def agent(monkeypatch):
    handler = type("H", (_FakeAgent,), {"calls": [], "reply": {"ok": True}})
    server = HTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]

    # The client discovers the agent via the endpoint file; short-circuit that to
    # point at our fake, so the test needs no real discovery file on disk.
    monkeypatch.setattr(
        agent_client, "_endpoint", lambda: {"port": port, "token": "T"}
    )
    try:
        yield handler
    finally:
        server.shutdown()
        server.server_close()


def test_sign_in_posts_to_signin_with_the_label(agent):
    client = agent_client.AgentClient()
    client.sign_in(label="my-laptop")
    call = agent.calls[-1]
    assert call["method"] == "POST"
    assert call["path"] == "/signin"
    assert call["body"] == {"label": "my-laptop"}
    assert call["auth"] == "Bearer T"


def test_sign_in_without_a_label_sends_an_empty_body(agent):
    agent_client.AgentClient().sign_in()
    call = agent.calls[-1]
    assert call["path"] == "/signin"
    assert call["body"] == {}


def test_sign_out_posts_to_signout(agent):
    agent_client.AgentClient().sign_out()
    call = agent.calls[-1]
    assert call["method"] == "POST"
    assert call["path"] == "/signout"


def test_cancel_sign_in_posts_to_signin_cancel(agent):
    agent_client.AgentClient().cancel_sign_in()
    call = agent.calls[-1]
    assert call["method"] == "POST"
    assert call["path"] == "/signin/cancel"


def test_a_signin_error_from_the_agent_surfaces(agent):
    # The agent answers 400 with an error the plugin must show, not swallow.
    agent.reply = {"error": "Set the Prism server URL before signing in."}

    class Erroring(_FakeAgent):
        def _handle(self):  # noqa: D401
            # Drain the request body before replying. Answering 400 while the
            # client is still writing its POST body closes the socket mid-write,
            # which surfaces as a connection error instead of the 400 detail and
            # makes the test flaky. Reading it first makes the 400 reliable.
            n = int(self.headers.get("Content-Length") or 0)
            if n:
                self.rfile.read(n)
            out = json.dumps({"error": "boom"}).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)

        do_POST = _handle

    # Rebind the running server's handler behaviour by pointing the client at a
    # fresh erroring server.
    server = HTTPServer(("127.0.0.1", 0), Erroring)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        client = agent_client.AgentClient.__new__(agent_client.AgentClient)
        client.base = "http://127.0.0.1:%d" % server.server_address[1]
        client.token = "T"
        with pytest.raises(agent_client.AgentUnavailable) as exc:
            client.sign_in()
        assert "boom" in str(exc.value)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
