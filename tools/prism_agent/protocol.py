"""`prism://` deep links.

Two separable halves:

  * **Dispatch**, parsing a prism:// URL and acting on it. Portable, pure Python.
  * **Registration**, telling the OS that *we* handle the scheme. NOT portable:
    every platform does it differently, and one of them can't do it at all from a
    plain script.

Registration, per platform. All three are per-user, and all three work:

  Windows   a registry key under HKCU\\Software\\Classes\\prism. No admin needed.
  Linux     a .desktop file declaring MimeType=x-scheme-handler/prism, then
            update-desktop-database.
  macOS     an .app bundle in ~/Applications whose Info.plist declares
            CFBundleURLTypes. LaunchServices genuinely will not read the scheme from
            anywhere else, so a bare `python -m prism_agent` cannot claim it.

            But an .app is just a DIRECTORY with a plist and an executable. Nothing
            about it is privileged: no Apple account, no signing, no notarisation.
            So we build one at opt-in time, containing a shell script that hands the
            URL back to the agent. No .app needs to be shipped.

Nothing here runs unless the user opts in (settings.protocol_handler). Claiming a
URL scheme behind someone's back is exactly the sort of thing people resent.

The URL grammar:

    prism://open/<project_id>            open a project HERE, in KiCad, cloning it
                                         first if this machine doesn't have it
    prism://web/<project_id>             open a project in the web app instead
    prism://ping                         prove the scheme is registered
    prism://auth/callback?code=...       OIDC redirect lands back here

`open` means "open it on this machine". That is the point of a desktop agent: if you
wanted the web app you would have followed a web link. `web` is the escape hatch.
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qs, urlparse

SCHEME = "prism"

log = logging.getLogger(__name__)


class RegistrationError(Exception):
    """Couldn't register (or unregister) the scheme, with a reason to show."""


@dataclass
class Link:
    """A parsed prism:// URL."""

    action: str  # "open" | "auth" | ...
    path: str  # whatever followed the action
    params: dict  # query string, flattened

    @property
    def project_id(self) -> str:
        return self.path.strip("/")


def parse(url: str) -> Link | None:
    """Parse a prism:// URL. None if it isn't one."""
    try:
        u = urlparse(url)
    except ValueError:
        return None
    if u.scheme != SCHEME:
        return None
    # In prism://open/xyz the host is "open" and the path is "/xyz".
    params = {k: v[0] if len(v) == 1 else v for k, v in parse_qs(u.query).items()}
    return Link(action=(u.netloc or "").lower(), path=u.path or "", params=params)


# -- registration ---------------------------------------------------------


def _launch_command() -> list[str]:
    """How the OS should invoke us to handle a link.

    Frozen, this is just the binary, the simple, robust case, and the reason we
    ship one.

    From a source checkout it's messier: the browser launches us from *its* working
    directory, not ours, so `-m prism_agent` alone can't import. Bootstrap sys.path
    explicitly rather than relying on cwd or PYTHONPATH, neither of which we
    control at the moment the OS invokes us.

    The PROFILE has to be baked in too, and forgetting it was a real bug. The OS
    launches this handler as a fresh process with none of our environment, so a dev
    agent (PRISM_PROFILE=dev) would register a command that runs with NO profile. The
    handler then read a different settings file than the agent that registered it:
    different server, no projects roots, and "no projects folder is set" for folders the
    user had just added. The profile is part of *which agent this is*, so it belongs in
    the command, not in an environment we do not control.
    """
    # Read the environment, not discovery.PROFILE: that is captured at import time, and
    # this has to reflect the profile of the process doing the registering.
    profile = os.environ.get("PRISM_PROFILE", "").strip()

    if getattr(sys, "frozen", False):
        # own_binary(), not sys.executable: see autostart. A registry command outlives
        # every build, so recording a renamed temp file is worse here than anywhere.
        from .discovery import own_binary

        cmd = [own_binary(), "--open-url"]
        # A frozen build reads the profile from the environment, and we cannot set one
        # in a registry command. In practice a frozen agent is the installed one, which
        # has no profile, so this is the expected case rather than a gap.
        return cmd

    root = Path(__file__).resolve().parent.parent  # tools/
    bootstrap = (
        "import sys, os; "
        + (f"os.environ['PRISM_PROFILE'] = {profile!r}; " if profile else "")
        + f"sys.path.insert(0, r'{root}'); "
        "from prism_agent.__main__ import main; sys.exit(main())"
    )
    return [sys.executable, "-c", bootstrap, "--open-url"]


def is_registered() -> bool:
    """Does this machine currently route prism:// to us?"""
    if sys.platform == "win32":
        import winreg

        try:
            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER, rf"Software\Classes\{SCHEME}"
            ):
                return True
        except OSError:
            return False
    if sys.platform == "darwin":
        return _mac_app_bundle().is_dir()
    return _linux_desktop_file().is_file()


def registered_command() -> str:
    """The command the OS currently has for prism://, or "" if none.

    Only implemented where it is cheap to read back. Elsewhere it returns "", which
    `is_stale` treats as "cannot tell", so nothing is rewritten on a guess.
    """
    if sys.platform == "win32":
        import winreg

        try:
            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                rf"Software\Classes\{SCHEME}\shell\open\command",
            ) as key:
                return winreg.QueryValueEx(key, "")[0]
        except OSError:
            return ""
    return ""


def is_stale() -> bool:
    """Is the registered command different from the one we would write now?

    A registration is not just "present or absent". It embeds the interpreter, the
    source path and the PROFILE, and any of those can change under it: the dev agent
    registered a command with no profile, so the handler read a different settings file
    than the agent, and the user got "no projects folder is set" for folders they could
    see in the plugin.

    is_registered() cannot catch that, because the key was there and looked fine. So the
    agent checks the *contents* and rewrites its own registration when they drift, rather
    than leaving the user with a handler that silently points at the wrong config.
    """
    if not is_registered():
        return False  # not registered at all is not "stale", it is "off"

    if sys.platform == "darwin":
        # There is no text command to read back from a compiled applet, unlike
        # Windows' registry value, so staleness is tracked by version instead: does
        # this bundle carry the marker the agent that built it would have written.
        from . import version

        marker = _mac_version_marker(_mac_app_bundle())
        try:
            return marker.read_text(encoding="utf-8").strip() != version.VERSION
        except OSError:
            return True  # a bundle from before this marker existed: rebuild it once

    current = registered_command()
    if not current:
        return False  # cannot read it back on this platform: do not guess

    want = " ".join(f'"{part}"' for part in _launch_command()) + ' "%1"'

    # Compare case-insensitively on Windows. sys.executable reports a lower-case drive
    # letter ("c:\...") while the registry holds whatever was written ("C:\..."), and a
    # difference that means nothing would make the command look stale forever and
    # rewrite the registry on every single boot.
    if sys.platform == "win32":
        return current.casefold() != want.casefold()
    return current != want


def register() -> None:
    """Claim prism:// for this user. Called only on explicit opt-in."""
    if sys.platform == "win32":
        _register_windows()
    elif sys.platform == "darwin":
        _register_macos()
    else:
        _register_linux()


def unregister() -> None:
    if sys.platform == "win32":
        _unregister_windows()
    elif sys.platform == "darwin":
        _unregister_macos()
    else:
        _unregister_linux()


# -- Windows --------------------------------------------------------------


def _register_windows() -> None:
    import winreg

    cmd = _launch_command()
    # "%1" is the URL the browser hands us. Quote the exe and the placeholder;
    # paths contain spaces (C:\Program Files\...) and an unquoted %1 would split.
    command = " ".join(f'"{part}"' for part in cmd) + ' "%1"'

    try:
        # HKCU, not HKLM: per-user, so no admin prompt, and it can't affect anyone
        # else on the machine.
        with winreg.CreateKey(
            winreg.HKEY_CURRENT_USER, rf"Software\Classes\{SCHEME}"
        ) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, "URL:Prism Protocol")
            # This exact value name is what tells Windows the key is a URL scheme.
            winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
        with winreg.CreateKey(
            winreg.HKEY_CURRENT_USER, rf"Software\Classes\{SCHEME}\shell\open\command"
        ) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, command)
    except OSError as exc:
        raise RegistrationError("Couldn't write the registry key: %s" % exc) from exc


def _unregister_windows() -> None:
    import winreg

    for sub in (
        rf"Software\Classes\{SCHEME}\shell\open\command",
        rf"Software\Classes\{SCHEME}\shell\open",
        rf"Software\Classes\{SCHEME}\shell",
        rf"Software\Classes\{SCHEME}",
    ):
        try:
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, sub)
        except OSError:
            pass  # already gone, or never there


# -- macOS ----------------------------------------------------------------
#
# LaunchServices only reads CFBundleURLTypes from an app bundle's Info.plist, so a bare
# `python -m prism_agent` genuinely cannot claim a scheme. That is a real OS rule.
#
# It also does not deliver a scheme invocation as argv. It sends a kAEGetURL Apple
# Event, over the Mach-port channel a Cocoa run loop listens on, so the bundle needs a
# real Apple-Event-capable process behind it, not just a plist and any executable. An
# earlier version of this used a `#!/bin/sh` shim as CFBundleExecutable: LaunchServices
# launched it without complaint, but a bare shell script has no run loop and no Apple
# Event handler, so the URL arrived at a process with nowhere to put it and was
# silently dropped every time (see _register_macos). An AppleScript applet, built with
# `osacompile`, is the smallest thing macOS ships that has both: `on open location` is
# wired to kAEGetURL for free, no Xcode, no compiled binary of our own to maintain
# across three architectures.
#
# Nothing about the bundle is privileged: no Apple account, no signing, no
# notarisation, no App Store. We build it in the user's own ~/Applications, at the
# moment they opt in.
#
# (This is separate from Gatekeeper. Gatekeeper only inspects files carrying
# com.apple.quarantine, which is set by the app that DOWNLOADS a file. Nothing here is
# downloaded, we write it locally, so the flag is never set and never checked.)


def _mac_app_bundle() -> Path:
    return Path.home() / "Applications" / "KiCad-Prism Agent.app"


def _mac_version_marker(bundle: Path) -> Path:
    """Where the bundle records which agent version built it.

    is_registered() only answers whether the .app exists, and registered_command()
    cannot read anything back from it (osacompile's applet is compiled, there is no
    text command to compare against, unlike Windows' registry value). Without this,
    a version that changes what the applet should run (see _open_location_applescript)
    ships with no way to tell an old bundle apart from a current one, and the fix
    only takes effect after the user manually toggles the setting off and back on.
    """
    return bundle / "Contents" / "Resources" / "prism-agent-version.txt"


def _open_location_applescript(command: list[str]) -> str:
    """The applet source: receive the URL via `on open location`, run `command` with
    it appended as the final argument.

    `do shell script` runs under /bin/sh, so `command` is baked in as one AppleScript
    string literal (its only escaping need is a literal double quote or backslash).
    `theURL` is different: it is untrusted, handed to us by whatever page or app sent
    the link, so it is concatenated as its own shell-quoted word via AppleScript's own
    `quoted form of` rather than spliced into the string, and can never break out of
    the argument it belongs in.

    The handler runs in the background (`> /dev/null 2>&1 &`), so the applet returns at
    once: `do shell script` otherwise blocks until the handler exits, including while it
    shows a dialog, and every further link click queues behind it. And it runs inside
    `try`: an uncaught failure in an applet is a raw AppleScript error dialog. The
    handler reports its own problems in its own dialogs.
    """
    joined = " ".join('"%s"' % part for part in command)
    literal = joined.replace("\\", "\\\\").replace('"', '\\"')
    return (
        "on open location theURL\n"
        "    try\n"
        '        do shell script "%s" & " " & quoted form of theURL'
        ' & " > /dev/null 2>&1 &"\n'
        "    end try\n"
        "end open location\n"
    ) % literal


def _register_macos() -> None:
    """Build the .app LaunchServices needs to claim prism://. See the module comment
    above _mac_app_bundle for why this has to be an AppleScript applet.

    Built in a temporary folder and swapped in only once complete. Building in place
    meant deleting the working bundle first, so a failed rebuild left no handler at
    all; and a failed plist edit still got the version marker, so is_stale() called the
    broken bundle current and never retried.
    """
    import shutil
    import tempfile

    bundle = _mac_app_bundle()
    script = _open_location_applescript(_launch_command())
    workdir = Path(tempfile.mkdtemp(prefix="prism-applet-"))
    staged = workdir / bundle.name

    try:
        source = workdir / "handler.applescript"
        source.write_text(script, encoding="utf-8")
        result = subprocess.run(
            ["osacompile", "-o", str(staged), str(source)],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if result.returncode != 0 or not staged.is_dir():
            raise RegistrationError(
                "osacompile couldn't build %s: %s"
                % (bundle, (result.stderr or "").strip())
            )

        # osacompile writes its own Info.plist (a real applet's: CFBundleExecutable
        # is its compiled runner, not anything we name). Add only what it doesn't
        # already have: the scheme claim, and keeping it out of the Dock/app switcher.
        # Every step is checked: a bundle missing CFBundleURLTypes claims nothing.
        plist = staged / "Contents" / "Info.plist"
        for args in (
            ["Add", ":LSUIElement", "bool", "true"],
            ["Add", ":CFBundleURLTypes", "array"],
            ["Add", ":CFBundleURLTypes:0", "dict"],
            ["Add", ":CFBundleURLTypes:0:CFBundleURLName", "string", "Prism"],
            ["Add", ":CFBundleURLTypes:0:CFBundleURLSchemes", "array"],
            ["Add", ":CFBundleURLTypes:0:CFBundleURLSchemes:0", "string", SCHEME],
        ):
            step = subprocess.run(
                ["/usr/libexec/PlistBuddy", "-c", " ".join(args), str(plist)],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if step.returncode != 0:
                raise RegistrationError(
                    "Couldn't set %s in %s: %s"
                    % (args[1], plist, (step.stderr or step.stdout or "").strip())
                )

        from . import version

        _mac_version_marker(staged).write_text(version.VERSION, encoding="utf-8")
        _swap_bundle(staged, bundle)
    except OSError as exc:
        raise RegistrationError("Couldn't write %s: %s" % (bundle, exc)) from exc
    except subprocess.SubprocessError as exc:
        raise RegistrationError("Couldn't build %s: %s" % (bundle, exc)) from exc
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    # Tell LaunchServices the bundle exists. Without this it may not notice until the
    # next login, which would make the opt-in look like it silently failed.
    for tool in (
        "/System/Library/Frameworks/CoreServices.framework/Frameworks"
        "/LaunchServices.framework/Support/lsregister",
    ):
        try:
            subprocess.run(
                [tool, "-f", str(bundle)], capture_output=True, timeout=20, check=False
            )
        except (OSError, subprocess.SubprocessError):
            log.debug("lsregister unavailable while registering the scheme")


def _swap_bundle(staged: Path, bundle: Path) -> None:
    """Replace `bundle` with the finished `staged` one, keeping the old bundle until the
    new one is in place, and putting it back if the move fails."""
    import shutil

    bundle.parent.mkdir(parents=True, exist_ok=True)
    old = bundle.with_name(bundle.name + ".old")
    shutil.rmtree(old, ignore_errors=True)
    if bundle.exists():
        bundle.rename(old)
    try:
        shutil.move(str(staged), str(bundle))
    except OSError:
        shutil.rmtree(bundle, ignore_errors=True)
        if old.exists():
            old.rename(bundle)
        raise
    shutil.rmtree(old, ignore_errors=True)


def _unregister_macos() -> None:
    import shutil

    try:
        shutil.rmtree(_mac_app_bundle())
    except OSError:
        pass


# -- Linux ----------------------------------------------------------------


def _linux_desktop_file() -> Path:
    base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    return Path(base) / "applications" / "kicad-prism-agent.desktop"


def _register_linux() -> None:
    cmd = " ".join(_launch_command())
    desktop = _linux_desktop_file()
    try:
        desktop.parent.mkdir(parents=True, exist_ok=True)
        desktop.write_text(
            "[Desktop Entry]\n"
            "Type=Application\n"
            "Name=KiCad-Prism Agent\n"
            f"Exec={cmd} %u\n"  # %u = the URL
            "NoDisplay=true\n"  # a handler, not something to show in a menu
            f"MimeType=x-scheme-handler/{SCHEME};\n",
            encoding="utf-8",
        )
    except OSError as exc:
        raise RegistrationError("Couldn't write %s: %s" % (desktop, exc)) from exc

    # Without this the desktop environment won't notice the new handler.
    for tool, args in (
        ("update-desktop-database", [str(desktop.parent)]),
        ("xdg-mime", ["default", desktop.name, f"x-scheme-handler/{SCHEME}"]),
    ):
        try:
            subprocess.run([tool, *args], capture_output=True, timeout=15, check=False)
        except (OSError, subprocess.SubprocessError):
            # Not fatal: the .desktop file is written, and many environments pick
            # it up anyway. Don't fail the opt-in over a missing helper.
            log.debug("%s unavailable while registering the scheme", tool)


def _unregister_linux() -> None:
    try:
        _linux_desktop_file().unlink()
    except OSError:
        pass
