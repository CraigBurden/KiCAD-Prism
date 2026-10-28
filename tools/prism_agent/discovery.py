"""How the KiCad plugin finds the running tray agent.

The agent binds an ephemeral port on 127.0.0.1 and writes {port, token, pid} to a
well-known file in the user's config dir. The plugin reads that file to know where
to connect and how to authenticate.

Why a token at all, on loopback: any local process (including a web page's
JavaScript, via a stray fetch to 127.0.0.1) can reach a loopback port. The agent
can run git and touch the filesystem, so it must not be drivable by anything that
merely guesses the port. The token is a shared secret readable only by the user
who owns the file.

This module is deliberately stdlib-only and importable from BOTH sides, the
plugin runs inside KiCad's embedded Python, where installing packages is painful.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from . import loopback

APP_NAME = "kicad-prism"
ENDPOINT_FILE = "agent.json"

# Namespace everything the agent owns, discovery file, settings, single-instance
# guard, per run profile. This exists for a specific and otherwise painful
# problem: a developer needs BOTH a symlinked working copy (to iterate) and a
# real installed package (to verify what users get), but they'd share one
# discovery file and one settings file, so the single-instance guard makes the
# second agent refuse to start, and whichever one IS running silently serves
# both plugins. You then edit agent code, restart, and see nothing change,
# because you're still talking to the installed binary.
#
# The profile registry (profiles.py) is the source of truth for names, ports,
# and config suffixes; select one with --profile or PRISM_PROFILE. The suffix is
# what keeps the config dirs apart (release is unsuffixed, preserving the
# historical path so an existing install keeps its settings).
from .profiles import resolve as _resolve_profile

# The active profile's name, resolved once at import (env/detection are stable
# for the process). Kept as a module constant for callers that logged or keyed
# on the old PROFILE string.
PROFILE = _resolve_profile().name


def config_dir() -> Path:
    """Per-user config dir, following each OS's convention, per profile."""
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or (Path.home() / "AppData" / "Roaming")
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = os.environ.get("XDG_CONFIG_HOME") or (Path.home() / ".config")
    suffix = _resolve_profile().config_suffix
    name = f"{APP_NAME}-{suffix}" if suffix else APP_NAME
    return Path(base) / name


def endpoint_path() -> Path:
    return config_dir() / ENDPOINT_FILE


def write_endpoint(port: int, token: str, version: str = "") -> Path:
    """Publish where we're listening. Called by the agent on startup.

    `version` and `exe` are what let a NEWER agent take over from an older one. An
    update installs a new binary beside an old agent that is still running and
    detached; without knowing what version the incumbent is, the newcomer can only
    defer to it, and the old code serves forever.
    """
    path = endpoint_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "port": port,
        "token": token,
        "pid": os.getpid(),
        "version": version,
        "exe": _own_exe(),
    }
    # Write-then-replace so a reader never sees a half-written file.
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload), encoding="utf-8")
    tmp.replace(path)
    _restrict_permissions(path)
    return path


def own_binary() -> str:
    """The path to invoke this frozen agent by, which is NOT always sys.executable.

    Windows cannot delete a running .exe, so an installer replacing one renames it
    aside: our binary becomes `prism-agent.exe~RF1a2b3c4.TMP` and the new build takes
    the real name. sys.executable still points at the renamed file, so anything that
    records it (the tray's Restart, the autostart entry, the prism:// handler) ends up
    pointing at the OLD agent, and at nothing once that temp file is cleaned up. The
    tray's Restart failed exactly this way after a PCM update.

    So prefer the canonical name beside us: the one the installer writes, the one the
    plugin looks for, and the only one worth recording anywhere that outlives a build.

    Empty from a source checkout, where there is no single file to point at.
    """
    if not getattr(sys, "frozen", False):
        return ""
    exe = Path(sys.executable)
    name = "prism-agent.exe" if sys.platform == "win32" else "prism-agent"
    canonical = exe.with_name(name)
    if canonical.is_file():
        return str(canonical)
    # An unusual layout, or a rename we cannot see past. sys.executable is still the
    # best answer available, and a wrong path beats refusing to relaunch at all.
    return sys.executable


def _own_exe() -> str:
    """Kept for the discovery file's `exe` field. See own_binary()."""
    return own_binary()


def read_endpoint() -> dict | None:
    """Where is the agent? None if it isn't running / hasn't published."""
    path = endpoint_path()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or "port" not in data or "token" not in data:
        return None
    return data


def clear_endpoint() -> None:
    """Called by the agent on shutdown so clients don't chase a dead port.

    Only removes the file if it still describes *us*. Otherwise a second agent
    that has since taken over would have its endpoint deleted by our exit, leaving
    it running but undiscoverable, see running_agent().
    """
    try:
        data = read_endpoint()
        if data and data.get("pid") not in (None, os.getpid()):
            return  # someone else owns it now; not ours to delete
        endpoint_path().unlink()
    except OSError:
        pass


def running_agent() -> dict | None:
    """The already-running agent, if there is one.

    A second agent would bind a different port, overwrite the discovery file, and
    leave two processes racing, with whichever exits last deleting the file and
    orphaning the other. Since the plugin offers a "Start agent" button, hitting
    that is easy, so the agent checks for a live predecessor before starting.

    A stale file (agent killed without cleanup) reads as "not running", which is
    the answer we want: it means go ahead and start.
    """
    data = read_endpoint()
    if not data:
        return None

    pid = data.get("pid")
    if pid and not _pid_alive(pid):
        return None

    # The pid may have been recycled by an unrelated process, so confirm something
    # is actually listening and answering as us.
    try:
        answer = loopback.call(data["port"], "GET", "/health", timeout=2)
    except (loopback.Refused, loopback.Unreachable, TypeError, ValueError):
        return None
    if isinstance(answer, dict) and answer.get("ok"):
        return data
    return None


def _pid_alive(pid: int) -> bool:
    if sys.platform == "win32":
        # No signal 0 on Windows, so ask the OS about the process object.
        #
        # Opening a handle is NOT the test. Windows keeps the process object alive
        # while anyone still holds a handle to it, so OpenProcess succeeds for a
        # process that has already exited, and the old check reported such a process
        # as running forever. That is what left a scheduled branch switch waiting on a
        # KiCad that had long since closed. GetExitCodeProcess distinguishes them:
        # STILL_ACTIVE means running, anything else means it has exited.
        import ctypes

        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        STILL_ACTIVE = 259
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not handle:
            return False
        try:
            code = ctypes.c_ulong()
            if not kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
                # Cannot tell. Say "alive" so we keep waiting rather than checking out
                # under a KiCad that might still have the board open.
                return True
            return code.value == STILL_ACTIVE
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)  # signal 0 tests existence without touching the process
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # exists, just not ours
    return True


def _restrict_permissions(path: Path) -> None:
    """Best-effort: keep the token out of other users' reach.

    On POSIX this is chmod 600. On Windows the file already lands in the user's
    roaming profile, which other non-admin users cannot read, and setting an ACL
    would need pywin32, not worth a dependency for the same outcome.
    """
    if sys.platform != "win32":
        try:
            path.chmod(0o600)
        except OSError:
            pass
