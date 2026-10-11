"""The one client for the agent's loopback HTTP API.

VENDORED: this file exists byte-for-byte in both ``kicad_plugin/`` and
``prism_agent/``. The plugin's AgentClient talks to the agent through it, and so does
the agent itself when it checks for (``/health``) or retires (``/quit``) an agent that
is already running. ``tools/tests/test_vendored_parity.py`` fails the moment the two
copies differ.

Two outcomes besides an answer, kept apart because they mean different things:

``Refused``      the agent answered with an HTTP error. It is alive; the status, the
                 agent's message (``error``) and its machine name for the refusal
                 (``code``) say why.
``Unreachable``  nothing answered: refused, reset, timed out, or cut off mid-read.

Stdlib-only: it runs inside KiCad's Python.
"""

from __future__ import annotations

import http.client
import json
import urllib.error
import urllib.request

TIMEOUT = 15


class Refused(Exception):
    """The agent answered, with an HTTP error status."""

    def __init__(self, status: int, error: str = "", code: str = ""):
        super().__init__(error or "HTTP %d" % status)
        self.status = status
        self.error = error
        self.code = code


class Unreachable(Exception):
    """Nothing answered at the agent's port."""


def call(port, method, path, *, token="", body=None, timeout=TIMEOUT):
    """One request to the agent on 127.0.0.1:<port>. Returns the decoded JSON body.

    Raises Refused for an HTTP error and Unreachable when nothing answered.
    """
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        "http://127.0.0.1:%d%s" % (int(port), path), data=data, method=method
    )
    req.add_header("Accept", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        # HTTPError subclasses URLError, so it MUST be caught first, otherwise an
        # agent answering "404" is reported as an agent that isn't running, and the
        # user goes off restarting a process that was working fine. An HTTP status
        # is proof it's alive.
        error, code = "", ""
        try:
            parsed = json.loads(exc.read() or b"{}")
            if isinstance(parsed, dict):
                error = str(parsed.get("error") or "")
                code = str(parsed.get("code") or "")
        except (ValueError, OSError):
            pass
        raise Refused(exc.code, error, code) from exc
    except (urllib.error.URLError, OSError, http.client.HTTPException) as exc:
        # Not only URLError: a connection that opened and then broke never becomes
        # one. The agent exiting mid-request is a ConnectionResetError, a slow answer
        # past the timeout is a bare TimeoutError from the read, and a half-closed
        # socket is http.client.RemoteDisconnected.
        raise Unreachable(str(exc)) from exc
    try:
        return json.loads(raw) if raw else None
    except ValueError as exc:
        raise Unreachable("unreadable answer from the agent") from exc
