"""Run the agent at login.

The agent's whole premise is that it works whether or not KiCad is open, but
without this it only exists once you've opened KiCad at least once since logging
in, because the plugin is what starts it.

Like the prism:// scheme, this is three separate mechanisms wearing one interface,
and it is never enabled unless the user asks:

  Windows   a value under HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run.
            Per-user, no admin, and trivially undone.
  macOS     a LaunchAgent plist in ~/Library/LaunchAgents. launchd starts it at
            login and (with KeepAlive) restarts it if it dies.
  Linux     an XDG autostart .desktop in ~/.config/autostart. Honoured by GNOME,
            KDE, XFCE, i.e. the desktops that have a tray in the first place.

Only Windows is verified by the author; the other two are written to spec and want
a real test on their platform.
"""

from __future__ import annotations

import logging
import os
import plistlib
import subprocess
import sys
from pathlib import Path

APP_ID = "com.kicad-prism.agent"
APP_NAME = "KiCad-Prism Agent"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
RUN_VALUE = "KiCadPrismAgent"


def _suffix() -> str:
    """What distinguishes this profile's entry from another's, or "" for release.

    Every name below was a single constant, so a dev agent and an installed one wrote
    the SAME registry value, the same plist and the same .desktop file. They cannot
    coexist that way: whichever ran last overwrote the other, and the loser's setting
    said it was enabled while nothing started it. Observed on a machine where the
    installed agent's settings.json said autostart was on and no entry for it existed.

    Release keeps the unsuffixed names, so an existing entry is still found, still
    disabled, and never duplicated by the rename.
    """
    from .discovery import PROFILE
    from .profiles import resolve

    return resolve(PROFILE).config_suffix


def _run_value() -> str:
    suffix = _suffix()
    return f"{RUN_VALUE}-{suffix}" if suffix else RUN_VALUE


def _app_id() -> str:
    suffix = _suffix()
    return f"{APP_ID}.{suffix}" if suffix else APP_ID


def _desktop_name() -> str:
    suffix = _suffix()
    return f"kicad-prism-agent-{suffix}.desktop" if suffix else "kicad-prism-agent.desktop"

log = logging.getLogger(__name__)


class AutostartError(Exception):
    """Couldn't change the autostart setting, with a reason worth showing."""


def _agent_command() -> list[str]:
    """How the OS should launch the agent at login.

    Frozen, that's just the binary. From a checkout it needs the interpreter and
    the module, and an absolute path, since login has no useful working directory.

    The profile is passed as an ARGUMENT, not left to the environment: a login
    process gets a fresh environment, so PRISM_PROFILE would be lost, and a dev agent
    set to autostart would come back as the *default* agent, colliding with the
    installed one it was carefully kept separate from.
    """
    from .discovery import PROFILE

    args = ["--profile", PROFILE] if PROFILE else []

    if getattr(sys, "frozen", False):
        # own_binary(), not sys.executable: an update renames the running .exe aside,
        # and an autostart entry pointing at that temp file starts the old agent until
        # it is cleaned up, then nothing.
        from .discovery import own_binary

        return [own_binary(), *args]

    root = Path(__file__).resolve().parent.parent  # tools/
    bootstrap = (
        f"import sys; sys.path.insert(0, r'{root}'); "
        "from prism_agent.__main__ import main; sys.exit(main())"
    )

    if sys.platform == "win32":
        for name in ("pythonw.exe", "pyw.exe"):
            pythonw = Path(sys.executable).with_name(name)
            if pythonw.is_file():
                return [str(pythonw), "-c", bootstrap, *args]

    return [sys.executable, "-c", bootstrap, *args]


# -- Windows --------------------------------------------------------------


def _win_is_enabled() -> bool:
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            winreg.QueryValueEx(key, _run_value())
            return True
    except OSError:
        return False


def _win_enable() -> None:
    import winreg

    # Quote each part: paths contain spaces (C:\Program Files\...), and an unquoted
    # command would be split at the first one.
    command = " ".join(f'"{p}"' for p in _agent_command())
    try:
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            winreg.SetValueEx(key, _run_value(), 0, winreg.REG_SZ, command)
    except OSError as exc:
        raise AutostartError(f"Couldn't write the registry key: {exc}") from exc


def _win_disable() -> None:
    import winreg

    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE
        ) as key:
            winreg.DeleteValue(key, _run_value())
    except OSError:
        pass  # already gone


# -- macOS ----------------------------------------------------------------


def _mac_plist_path() -> Path:
    return Path.home() / "Library" / "LaunchAgents" / f"{_app_id()}.plist"


def _mac_is_enabled() -> bool:
    return _mac_plist_path().is_file()


def _mac_enable() -> None:
    plist = {
        "Label": _app_id(),
        "ProgramArguments": _agent_command(),
        "RunAtLoad": True,
        # Bring it back if it crashes, but don't fight a deliberate quit: the
        # agent exits 0 on /quit, and SuccessfulExit=False means "only restart on
        # a *failure*". Without this, quitting from the tray would just respawn it.
        "KeepAlive": {"SuccessfulExit": False},
        "ProcessType": "Interactive",
    }
    path = _mac_plist_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as fh:
            plistlib.dump(plist, fh)
    except OSError as exc:
        raise AutostartError(f"Couldn't write {path}: {exc}") from exc

    # Load it now so it doesn't only take effect at the next login.
    _run(["launchctl", "load", "-w", str(path)])


def _mac_disable() -> None:
    path = _mac_plist_path()
    if path.is_file():
        _run(["launchctl", "unload", "-w", str(path)])
        try:
            path.unlink()
        except OSError:
            pass


# -- Linux ----------------------------------------------------------------


def _linux_desktop_path() -> Path:
    base = os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config")
    return Path(base) / "autostart" / _desktop_name()


def _linux_is_enabled() -> bool:
    return _linux_desktop_path().is_file()


def _linux_enable() -> None:
    path = _linux_desktop_path()
    command = " ".join(_agent_command())
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            "[Desktop Entry]\n"
            "Type=Application\n"
            f"Name={APP_NAME}\n"
            f"Exec={command}\n"
            "Terminal=false\n"
            "NoDisplay=true\n"
            "X-GNOME-Autostart-enabled=true\n",
            encoding="utf-8",
        )
    except OSError as exc:
        raise AutostartError(f"Couldn't write {path}: {exc}") from exc


def _linux_disable() -> None:
    try:
        _linux_desktop_path().unlink()
    except OSError:
        pass


# -- interface ------------------------------------------------------------


def _run(cmd: list[str]) -> None:
    """Best-effort helper: a missing launchctl shouldn't fail the whole toggle."""
    try:
        subprocess.run(cmd, capture_output=True, timeout=20, check=False)
    except (OSError, subprocess.SubprocessError):
        log.debug("autostart helper failed: %s", cmd)


def _adopt_legacy_entry() -> None:
    """Take over an entry written before the names were split per profile.

    Every profile used to write the same registry value, plist and .desktop file, so a
    dev agent and an installed one overwrote each other. Splitting the names fixes that
    going forward, but it strands whatever is already there: a dev agent's entry sits
    under the release name, invisible to both profiles, still starting an agent at
    login that neither believes it enabled.

    So a non-release profile claims a legacy entry that is plainly its own, by reading
    the recorded command and looking for its own --profile. Release needs nothing: it
    kept the unsuffixed names, so its entry is already where it looks.

    Best effort; a failure here leaves exactly the situation we had before.
    """
    suffix = _suffix()
    if not suffix or sys.platform != "win32":
        return
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            try:
                legacy, _ = winreg.QueryValueEx(key, RUN_VALUE)
            except OSError:
                return  # nothing under the old name
        if f'"{suffix}"' not in legacy and f"--profile {suffix}" not in legacy:
            return  # it belongs to another profile; leave it alone
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE
        ) as key:
            # Write the new name BEFORE removing the old one. The other order leaves a
            # window where neither exists, and a crash inside it turns "autostart is
            # on" into an entry nobody has: the exact disagreement this is fixing.
            winreg.SetValueEx(key, _run_value(), 0, winreg.REG_SZ, legacy)
            winreg.DeleteValue(key, RUN_VALUE)
        log.info("Adopted the legacy autostart entry as %s", _run_value())
    except OSError:
        pass


def registered_command() -> list[str]:
    """The command the autostart entry actually holds, or [] if it cannot be read."""
    if sys.platform == "win32":
        import winreg

        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
                value, _ = winreg.QueryValueEx(key, _run_value())
        except OSError:
            return []
        try:
            import shlex

            return shlex.split(value, posix=False)
        except ValueError:
            return []

    if sys.platform == "darwin":
        try:
            with _mac_plist_path().open("rb") as handle:
                return list(plistlib.load(handle).get("ProgramArguments") or [])
        except (OSError, ValueError):
            return []

    try:
        for line in _linux_desktop_path().read_text(encoding="utf-8").splitlines():
            if line.startswith("Exec="):
                import shlex

                return shlex.split(line[len("Exec=") :])
    except (OSError, ValueError):
        pass
    return []


def is_stale() -> bool:
    """Does the entry launch something other than what we would write now?

    An autostart entry outlives builds, checkouts and installs, and it records an
    absolute path. An update that moves the binary, or a checkout that moves, leaves an
    entry pointing at a file that starts the wrong agent or nothing at all. The setting
    still reads "enabled", so nothing looks wrong until a login produces no agent.

    Same shape as protocol.is_stale, and for the same reason: is_enabled() only answers
    whether the entry exists, not whether it still means what it said.
    """
    if not is_enabled():
        return False  # absent is "off", not "stale"

    current = registered_command()
    if not current:
        return False  # unreadable on this platform: do not guess, do not rewrite

    want = _agent_command()

    def normalise(parts):
        return [str(x).strip('"').replace("\\", "/").casefold() for x in parts]

    return normalise(current) != normalise(want)


def is_enabled() -> bool:
    _adopt_legacy_entry()
    if sys.platform == "win32":
        return _win_is_enabled()
    if sys.platform == "darwin":
        return _mac_is_enabled()
    return _linux_is_enabled()


def enable() -> None:
    if sys.platform == "win32":
        _win_enable()
    elif sys.platform == "darwin":
        _mac_enable()
    else:
        _linux_enable()


def disable() -> None:
    if sys.platform == "win32":
        _win_disable()
    elif sys.platform == "darwin":
        _mac_disable()
    else:
        _linux_disable()


def set_enabled(want: bool) -> None:
    if want == is_enabled():
        return
    enable() if want else disable()
