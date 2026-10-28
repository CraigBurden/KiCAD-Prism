"""restart_agent stops the running agent and starts THIS plugin's own binary,
never /restart (which asks the running process to re-exec itself).

The bug this replaced: the Settings dialog's restart button called /restart, which
for an OUTDATED agent just relaunches the same old version, having changed nothing.
The user saw "restart" silently do nothing and had to stop, then start, by hand,
two clicks doing what one button already promised. See agent_launcher.py's module
comment for the full story; this is the one place both call sites (the outdated-
agent card and the Settings dialog) now share.

No real HTTP server here: restart_agent only ever calls AgentClient().quit() and
.health(), so a fake AgentClient standing in for both exercises the exact call
sequence without a real socket, side-stepping a genuine Windows loopback flake
(BaseHTTPRequestHandler + rapid successive requests intermittently raises
ConnectionAbortedError client-side, unrelated to restart_agent's own logic).
"""

from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path

import pytest

TOOLS = Path(__file__).resolve().parents[1]
PLUGIN = TOOLS / "kicad_plugin"


def _load(*names):
    """Load kicad_plugin submodules under a package name private to THIS test file
    (kicad_plugin/__init__.py imports pcbnew/wx, neither exists off KiCad).

    Not the shared "kicad_plugin" name other test files also use: pytest runs every
    test file in one process, so a plain "kicad_plugin" would collide with whichever
    file loaded it last, and agent_launcher's own `from .agent_client import
    AgentClient` would then resolve against THEIR module object, not the one this
    file just monkeypatched. Each test file gets its own package name instead, so
    the two can never see each other's sys.modules entries.
    """
    pkg_name = f"kicad_plugin_restart_test_{id(names)}"
    pkg = types.ModuleType(pkg_name)
    pkg.__path__ = [str(PLUGIN)]
    sys.modules[pkg_name] = pkg

    for name in names:
        spec = importlib.util.spec_from_file_location(
            f"{pkg_name}.{name}", PLUGIN / f"{name}.py",
            submodule_search_locations=[],
        )
        module = importlib.util.module_from_spec(spec)
        module.__package__ = pkg_name
        sys.modules[f"{pkg_name}.{name}"] = module
        spec.loader.exec_module(module)
    return tuple(sys.modules[f"{pkg_name}.{n}"] for n in names)


_profiles, agent_client, agent_launcher = _load("profiles", "agent_client", "agent_launcher")


class _FakeAgentClient:
    """Stands in for AgentClient. Records every call; .up controls whether .health()
    answers or raises, mimicking the real gap between the old process quitting and
    the new one binding its port."""

    calls: list = []
    up = True

    def quit(self):
        type(self).calls.append("quit")

    def health(self, timeout=None):
        type(self).calls.append("health")
        if not type(self).up:
            raise agent_client.AgentUnavailable("not up yet")
        return {"ok": True}


@pytest.fixture
def fake_client(monkeypatch):
    cls = type("C", (_FakeAgentClient,), {"calls": [], "up": True})
    # restart_agent does `from .agent_client import AgentClient` freshly on every
    # call (a deferred import, not a module-level name agent_launcher itself
    # holds), so the name to replace lives on the agent_client module, not on
    # agent_launcher.
    monkeypatch.setattr(agent_client, "AgentClient", lambda: cls())
    monkeypatch.setattr(agent_launcher, "_wait_tick", lambda: None)
    return cls


def test_restart_stops_the_old_agent_and_starts_the_new_binary(fake_client, monkeypatch):
    """Never /restart: the running process is asked to quit, and THIS plugin's own
    start_agent() launches the replacement, not whatever the old process would
    have re-exec'd."""
    started = []
    monkeypatch.setattr(agent_launcher, "start_agent", lambda: started.append(1))

    came_up = agent_launcher.restart_agent()

    assert "quit" in fake_client.calls
    assert started == [1]
    assert came_up is True


def test_calls_the_status_callback_for_each_phase(fake_client, monkeypatch):
    monkeypatch.setattr(agent_launcher, "start_agent", lambda: None)

    phases = []
    agent_launcher.restart_agent(on_status=phases.append)

    assert phases == ["Stopping the old agent...", "Starting the new agent..."]


def test_reports_failure_rather_than_pretending_success(fake_client, monkeypatch):
    """If the new agent never answers, say so, do not silently return as if it
    worked, the original bug behind the "restart looked like it did nothing"."""
    fake_client.up = False  # stays down: the new agent never binds its port
    monkeypatch.setattr(agent_launcher, "start_agent", lambda: None)

    came_up = agent_launcher.restart_agent()

    assert came_up is False


def test_a_launch_error_propagates_rather_than_being_swallowed(fake_client, monkeypatch):
    def boom():
        raise agent_launcher.LaunchError("no binary found")

    monkeypatch.setattr(agent_launcher, "start_agent", boom)

    with pytest.raises(agent_launcher.LaunchError):
        agent_launcher.restart_agent()


def test_start_agent_is_called_even_if_quit_finds_nothing_to_stop(fake_client, monkeypatch):
    """quit() on an already-gone agent is expected, not an error: the agent might
    already be down (e.g. crashed) when the user asks to restart it."""

    class _AlreadyGone(_FakeAgentClient):
        def quit(self):
            type(self).calls.append("quit")
            raise agent_client.AgentUnavailable("already gone")

    monkeypatch.setattr(agent_client, "AgentClient", lambda: _AlreadyGone())
    started = []
    monkeypatch.setattr(agent_launcher, "start_agent", lambda: started.append(1))

    came_up = agent_launcher.restart_agent()

    assert started == [1]
    assert came_up is True


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
