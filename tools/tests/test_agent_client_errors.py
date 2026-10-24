"""Every way the connection to the agent can break is "agent unavailable".

Found live on Linux: only URLError was caught, so a connection that opened and then
broke escaped as a raw exception. The restart's "is the old agent gone yet" poll
crashed on the ConnectionResetError of the agent exiting mid-request, and a dialog
load that timed out left the dialog stuck on "Contacting agent".
"""

import http.client
import importlib.util
import sys
import types
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parent.parent / "kicad_plugin"


def _load_agent_client():
    """kicad_plugin/__init__.py imports pcbnew/wx; load the one module under a
    package name private to this file (see test_agent_launcher_restart)."""
    pkg_name = "kicad_plugin_client_errors_test"
    pkg = types.ModuleType(pkg_name)
    pkg.__path__ = [str(PLUGIN)]
    sys.modules[pkg_name] = pkg
    for name in ("profiles", "agent_client"):
        spec = importlib.util.spec_from_file_location(
            f"{pkg_name}.{name}", PLUGIN / f"{name}.py"
        )
        module = importlib.util.module_from_spec(spec)
        module.__package__ = pkg_name
        sys.modules[f"{pkg_name}.{name}"] = module
        spec.loader.exec_module(module)
    return sys.modules[f"{pkg_name}.agent_client"]


agent_client = _load_agent_client()


@pytest.mark.parametrize(
    "error",
    [
        ConnectionResetError(104, "Connection reset by peer"),
        TimeoutError("timed out"),
        http.client.RemoteDisconnected("Remote end closed connection"),
        ConnectionRefusedError(111, "Connection refused"),
    ],
    ids=["reset", "read-timeout", "remote-disconnected", "refused"],
)
def test_a_broken_connection_is_agent_unavailable(monkeypatch, error):
    monkeypatch.setattr(agent_client, "_endpoint", lambda: {"port": 1, "token": "t"})

    def boom(*_args, **_kwargs):
        raise error

    # The one loopback client opens every request through urllib.request.urlopen.
    monkeypatch.setattr(agent_client.loopback.urllib.request, "urlopen", boom)

    with pytest.raises(agent_client.AgentUnavailable):
        agent_client.AgentClient().health()
