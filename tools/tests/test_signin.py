"""The agent's browser loopback sign-in.

Drives signin.sign_in against a stand-in Prism, a tiny HTTP server that behaves
like /api/agent/authorize (303 back to the loopback redirect with a code) and
/api/agent/token (verify PKCE, return a token). No real browser: `open_browser`
is injected to follow the authorize URL itself, which is exactly what a browser
would do, so the loopback listener sees the same callback.
"""

import base64
import hashlib
import json
import sys
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism_agent import signin  # noqa: E402


class _FakePrism(BaseHTTPRequestHandler):
    """Behaviour is steered by class attributes so each test can bend one thing."""

    # What the token endpoint returns, and whether the code should be accepted.
    token_payload = {
        "access_token": "v1.TOKEN.sig",
        "token_type": "Bearer",
        "scope": "api:read api:write",
        "expires_in": 3600,
    }
    token_status = 200
    # When set, /authorize redirects with this error instead of a code.
    authorize_error = ""
    # Recorded for assertions.
    seen: dict = {}

    def do_GET(self):  # noqa: N802
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path != "/api/agent/authorize":
            self.send_response(404)
            self.end_headers()
            return
        type(self).seen = dict(q)
        # Remember the challenge so /token can verify the verifier against it.
        type(self)._challenge = q.get("code_challenge", "")
        if self.authorize_error:
            loc = f"{q['redirect_uri']}?error={self.authorize_error}&state={q['state']}"
        else:
            loc = f"{q['redirect_uri']}?code=THE_CODE&state={q['state']}"
        self.send_response(303)
        self.send_header("Location", loc)
        self.end_headers()

    def do_POST(self):  # noqa: N802
        n = int(self.headers.get("Content-Length") or 0)
        body = {k: v[0] for k, v in parse_qs(self.rfile.read(n).decode()).items()}
        verifier = body.get("code_verifier", "")
        chal = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .rstrip(b"=")
            .decode()
        )
        ok = (
            self.token_status == 200
            and chal == type(self)._challenge
            and body.get("code") == "THE_CODE"
        )
        out = json.dumps(self.token_payload if ok else {"detail": "bad"}).encode()
        self.send_response(self.token_status if ok else 401)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *_a):  # noqa: A003
        pass


@pytest.fixture
def prism():
    # A fresh handler subclass per test, so class-level knobs never leak.
    handler = type("Handler", (_FakePrism,), {"seen": {}, "_challenge": ""})
    server = HTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % server.server_address[1]
    try:
        yield base, handler
    finally:
        server.shutdown()
        server.server_close()


def _browser_that_follows(url_holder=None):
    """An 'open_browser' that fetches the authorize URL, as a real browser would.

    Runs in a thread because the fetch blocks on our own loopback listener until
    the redirect completes.
    """

    def open_browser(url):
        if url_holder is not None:
            url_holder.append(url)

        def go():
            try:
                urllib.request.urlopen(url, timeout=10)
            except Exception:
                pass

        threading.Thread(target=go, daemon=True).start()

    return open_browser


def test_full_flow_returns_a_scoped_token(prism):
    base, _ = prism
    result = signin.sign_in(
        base, label="unit-box", open_browser=_browser_that_follows(), timeout=10
    )
    assert result.token == "v1.TOKEN.sig"
    assert result.scope == "api:read api:write"
    assert result.expires_in == 3600


def test_the_label_reaches_the_consent_request(prism):
    base, handler = prism
    signin.sign_in(
        base, label="my-laptop", open_browser=_browser_that_follows(), timeout=10
    )
    assert handler.seen["label"] == "my-laptop"


def test_pkce_challenge_is_s256_and_present(prism):
    base, handler = prism
    signin.sign_in(base, open_browser=_browser_that_follows(), timeout=10)
    assert handler.seen["code_challenge_method"] == "S256"
    assert handler.seen["code_challenge"]
    # The verifier itself must never appear in the front-channel authorize URL.
    assert "code_verifier" not in handler.seen


def test_the_redirect_is_a_loopback_url(prism):
    base, handler = prism
    signin.sign_in(base, open_browser=_browser_that_follows(), timeout=10)
    parsed = urlparse(handler.seen["redirect_uri"])
    assert parsed.hostname == "127.0.0.1"
    assert parsed.scheme == "http"


def test_a_refusal_is_reported(prism):
    base, handler = prism
    handler.authorize_error = "access_denied"
    with pytest.raises(signin.SignInError) as exc:
        signin.sign_in(base, open_browser=_browser_that_follows(), timeout=10)
    assert "access_denied" in str(exc.value)


def test_a_bad_token_exchange_is_reported(prism):
    base, handler = prism
    handler.token_status = 401
    with pytest.raises(signin.SignInError):
        signin.sign_in(base, open_browser=_browser_that_follows(), timeout=10)


def test_a_browser_that_never_returns_times_out(prism):
    base, _ = prism
    # A browser that opens nothing: the listener is never hit, so we time out.
    with pytest.raises(signin.SignInError) as exc:
        signin.sign_in(base, open_browser=lambda _url: None, timeout=1)
    assert "timed out" in str(exc.value).lower()


def test_cancelling_a_pending_sign_in_unwinds_it_promptly():
    # The user closed the browser without approving. cancel_pending_sign_in must
    # wake the waiter so it stops holding the listener, rather than blocking until
    # the timeout, which is what froze KiCad.
    import threading
    import time

    outcome = {}

    def run():
        try:
            signin.sign_in(
                "http://127.0.0.1:1", open_browser=lambda _u: None, timeout=60
            )
        except signin.SignInCancelled:
            outcome["cancelled"] = True
        except Exception as exc:  # noqa: BLE001 - record anything unexpected
            outcome["other"] = repr(exc)

    thread = threading.Thread(target=run)
    thread.start()
    # Give it a moment to register the pending flow before cancelling.
    for _ in range(50):
        if signin._pending_done is not None:
            break
        time.sleep(0.02)

    assert signin.cancel_pending_sign_in() is True
    thread.join(timeout=5)
    assert outcome == {"cancelled": True}


def test_cancelling_with_nothing_pending_is_false():
    assert signin.cancel_pending_sign_in() is False


def test_token_jti_reads_the_payload():
    payload = {"jti": "abc123", "type": "agent"}
    b = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    assert signin._token_jti(f"v1.{b}.sig") == "abc123"


def test_token_jti_of_a_non_token_is_empty():
    assert signin._token_jti("not-a-token") == ""
    assert signin._token_jti("") == ""


def test_sign_out_of_an_empty_token_is_a_noop():
    # Nothing to revoke; must not raise or make a request.
    assert signin.sign_out("http://127.0.0.1:1", "") is True


def test_sign_out_revokes_by_jti(prism):
    base, _ = prism
    # Give the fake a DELETE handler that records the jti it was asked to revoke.
    revoked = []

    class Handler(_FakePrism):
        def do_DELETE(self):  # noqa: N802
            revoked.append(urlparse(self.path).path)
            self.send_response(200)
            self.send_header("Content-Length", "0")
            self.end_headers()

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d" % server.server_address[1]
    try:
        payload = {"jti": "xyz789"}
        b = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
        assert signin.sign_out(url, f"v1.{b}.sig") is True
        assert revoked == ["/api/agent/tokens/xyz789"]
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
