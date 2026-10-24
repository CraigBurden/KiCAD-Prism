"""KiCad-Prism agent.

Runs independent of KiCad. It owns the machine-side work, knowing the local
projects, running git, diffing the working tree, talking to the Prism backend,
and exposes it on a loopback HTTP API (see server.py). The KiCad plugin is a thin
UI client over that API, so the capabilities exist whether or not KiCad is open.

The tray icon is the *convenience*, not the architecture. The agent's real control
surface is its HTTP API, which works identically everywhere. So when no tray can
be drawn, Wayland without an appindicator, a headless box, SSH, the agent says
so and keeps serving, rather than dying or (worse) running invisibly with no way
to stop it. See _run_headless.

Run:  python -m prism_agent
      python -m prism_agent --no-tray     # explicit headless
"""

from __future__ import annotations

import argparse
import json
import logging
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

from . import discovery, loopback, protocol
from . import settings as settings_store
from .prism_client import PrismClient, PrismConfig
from .server import serve
from .version import VERSION, should_retire

log = logging.getLogger(__name__)


def _setup_logging() -> None:
    """Log to a rotating file in the config dir, so the detached agent leaves a trail.

    The agent has no console, so a bare `logging` call vanishes. That is fine until
    something fails where the user cannot see it, a scheduled branch switch that quietly
    does nothing being the case that prompted this. A small rotating file costs nothing
    and turns "it just didn't switch" into a line we can read.

    Best-effort: if the file can't be opened (a read-only dir, a locked file), fall back
    to stderr and carry on. Logging must never be the thing that stops the agent.
    """
    root = logging.getLogger()
    if root.handlers:
        return  # a --notify/--open-url child may have set this up already
    root.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        from logging.handlers import RotatingFileHandler

        path = discovery.config_dir() / "agent.log"
        path.parent.mkdir(parents=True, exist_ok=True)
        handler: logging.Handler = RotatingFileHandler(
            path, maxBytes=1_000_000, backupCount=3, encoding="utf-8"
        )
    except Exception:
        handler = logging.StreamHandler()
    handler.setFormatter(fmt)
    root.addHandler(handler)


def _assets_dir() -> Path:
    """Where the icons live, which differs once we're a frozen binary.

    PyInstaller unpacks bundled data into a temp dir and points sys._MEIPASS at it,
    so the source-relative path is wrong there and the tray would silently fall
    back to a plain coloured tile.
    """
    base = getattr(sys, "_MEIPASS", None)
    if base:
        return Path(base) / "prism_agent" / "assets"
    return Path(__file__).parent / "assets"


ASSETS = _assets_dir()


def is_frozen() -> bool:
    """Are we the packaged binary rather than a source checkout?"""
    return getattr(sys, "frozen", False)


# Fallback brand colour if the asset is missing (see kicad_plugin/prism_theme.py).
PRIMARY = (37, 99, 235)  # #2563EB

# Tray icons are small, and the platforms don't agree on how big. Handing a 256px
# image straight to the tray gives a blurry or oversized icon, so we ship
# purpose-built sizes and pick one. macOS wants a larger source because it renders
# at 2x on Retina; Windows and Linux trays are nominally 16-24px but look better
# fed a 32-64px image they can downscale once.
TRAY_ICON_PX = 32 if sys.platform == "win32" else 64


def _load_tray():
    """Import pystray, or explain precisely why there's no tray.

    Two *different* failures both surface as ImportError here, and conflating them
    sends the user down the wrong path:

      - pystray/Pillow genuinely aren't installed  -> pip install
      - they are installed, but no backend works   -> a system package (Linux) or
        simply no desktop at all (headless/SSH)

    pystray picks its backend at import: darwin on macOS, win32 on Windows, and on
    Linux it tries appindicator -> gtk -> xorg, raising ImportError if all three
    fail. That makes the "no tray available" case detectable rather than silent,
    we don't have to know anything about individual distros.

    Except when it doesn't raise ImportError. The xorg backend imports Xlib fine,
    then Xlib itself raises trying to open a display (DisplayNameError, a plain
    Exception, not an ImportError) when there's no DISPLAY at all, a headless
    service or an SSH session with no X forwarding. Narrowing this to ImportError
    let that crash the whole agent instead of falling back; any failure importing
    pystray, whatever its type, means the same thing here: no tray, try headless.
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None, (
            "Pillow isn't installed.\n"
            "    pip install -r tools/prism_agent/requirements.txt"
        )

    try:
        import pystray
    except Exception as exc:  # noqa: BLE001 - see the docstring: not just ImportError
        # Distinguish "not installed" from "installed but unusable here".
        try:
            import importlib.util

            installed = importlib.util.find_spec("pystray") is not None
        except (ImportError, ValueError):
            installed = False

        if not installed:
            return None, (
                "pystray isn't installed.\n"
                "    pip install -r tools/prism_agent/requirements.txt"
            )
        return None, (
            "No system tray is available here (%s: %s).\n"
            "On GNOME, the icon needs the AppIndicator extension:\n"
            "    sudo apt install gnome-shell-extension-appindicator\n"
            "The agent works fine without it, see below." % (type(exc).__name__, exc)
        )

    return (pystray, Image, ImageDraw), None


def _make_icon(Image, ImageDraw):
    """The Prism logo at a size the tray can render crisply.

    Prefers a purpose-built asset at the exact size (they're hand-tuned for small
    renders and beat any downscale); falls back to resampling the 256px master,
    then to a plain brand-coloured tile.
    """
    exact = ASSETS / f"prism-{TRAY_ICON_PX}.png"
    if exact.is_file():
        try:
            return Image.open(exact).convert("RGBA")
        except OSError:
            pass

    try:
        icon = Image.open(ASSETS / "prism-256.png").convert("RGBA")
        return icon.resize((TRAY_ICON_PX, TRAY_ICON_PX), Image.LANCZOS)
    except OSError:
        # A missing asset must never stop the agent, the icon is cosmetic, the
        # agent is not.
        icon = Image.new("RGBA", (TRAY_ICON_PX, TRAY_ICON_PX), (0, 0, 0, 0))
        ImageDraw.Draw(icon).rounded_rectangle(
            [0, 0, TRAY_ICON_PX - 1, TRAY_ICON_PX - 1],
            radius=TRAY_ICON_PX // 5,
            fill=PRIMARY,
        )
        return icon


# GNOME's top bar, and the usual dark panel elsewhere. See _flatten_for_xembed.
_XEMBED_PANEL_RGB = (0, 0, 0)


def _flatten_for_xembed(icon, Image):
    """`icon` blended onto the panel colour, for pystray's X11 backend only.

    A legacy (XEmbed) tray icon has no transparency, so pystray's _xorg backend pastes
    our RGBA image into a plain RGB one and drops the alpha channel. Fully clear
    pixels are black underneath and pass for background, but the half-transparent
    anti-aliased edge keeps its full-strength colour: on GNOME (via the AppIndicator
    extension, which hosts these icons) the gem came out jagged, with a light-blue
    ring. Compositing it onto the panel colour first turns those edge pixels into
    the blend they were meant to be. Windows, macOS and the AppIndicator backend
    all honour alpha and never see this.
    """
    background = Image.new("RGBA", icon.size, _XEMBED_PANEL_RGB + (255,))
    return Image.alpha_composite(background, icon.convert("RGBA")).convert("RGB")


def _prism_config() -> PrismConfig:
    """Backend location, from the user's saved settings.

    settings.load() already lets PRISM_URL / PRISM_TOKEN win over the saved values,
    so a dev pointing at a staging backend for one run neither loses their saved
    setting nor silently overwrites it.
    """
    saved = settings_store.load()
    return PrismConfig(base_url=saved.server_url, token=saved.api_token)


def _shutdown(server) -> None:
    server.shutdown()
    discovery.clear_endpoint()


def _handle_url(url: str) -> int:
    """Act on a prism:// link. This is what the OS invokes for a registered scheme.

    Runs as a short-lived process, separate from the agent: the browser launches a
    *new* copy of us with the URL, it isn't delivered to the one already running.
    So do the work and exit, don't try to start a second agent (which the
    single-instance guard would refuse anyway).
    """
    link = protocol.parse(url)
    if link is None:
        print(f"Not a prism:// URL: {url}", file=sys.stderr)
        return 2

    saved = settings_store.load()

    if link.action == "open":
        import webbrowser

        if not link.project_id:
            # No project named: just the web app.
            webbrowser.open(saved.server_url.rstrip("/"))
            return 0

        # A project link opens the project ON THIS MACHINE, in KiCad. That is the
        # point of having a desktop agent at all; if the user wanted the web app they
        # would have clicked a web link.
        #
        # ?commit=<sha> (or ?ref=) opens a PRECISE revision, which is what makes a link
        # from a diff or a release actually land somewhere useful.
        ref = link.params.get("commit") or link.params.get("ref") or ""
        return _open_project_locally(link.project_id, saved, ref)

    if link.action == "web":
        # The escape hatch: prism://web/<id> forces the browser. Go through
        # PrismClient rather than hand-rolling the path, it's the one place that
        # knows the web app's route, and building it here is how this drifted to the
        # wrong (pluralised) URL before.
        import webbrowser

        client = PrismClient(
            PrismConfig(base_url=saved.server_url, token=saved.api_token)
        )
        target = (
            client.project_url(link.project_id)
            if link.project_id
            else saved.server_url.rstrip("/")
        )
        webbrowser.open(target)
        return 0

    if link.action == "ping":
        # End-to-end check of the registration itself: the browser hands the OS a
        # prism:// URL, the OS launches us, we say so. No project, no KiCad.
        _show_dialog("Prism", "prism:// links are working.")
        return 0

    if link.action == "auth":
        # Sign-in does NOT use this scheme. The agent signs in through a loopback
        # listener (see signin.py), the browser redirects back to 127.0.0.1
        # directly, so a prism://auth callback should never occur. If one does,
        # say so plainly rather than appear to accept a login we did nothing with.
        print(
            "Received a prism://auth callback, but the agent signs in over a "
            "loopback listener, not this scheme. Nothing to do.",
            file=sys.stderr,
        )
        return 1

    print(f"Don't know how to handle prism://{link.action}", file=sys.stderr)
    return 2


def _open_project_locally(project_id: str, saved, ref: str = "") -> int:
    """prism://open/<id>: open the project in KiCad, cloning it first if needed.

    `ref` opens a precise revision. Runs in the short-lived process the OS spawned for
    the URL, so there is no tray and no wx here. Anything the user needs to see or answer
    goes through the themed tkinter dialogs in dialogs.py.
    """
    from . import open_project

    try:
        opened = open_project.open_project(
            project_id,
            confirm=_ask,
            ref=ref,
            ask_choice=_ask_uncommitted,
            clone_flow=_clone_flow,
            on_root_added=_root_added,
            offer_reapply=_offer_reapply,
        )
    except open_project.OpenError as exc:
        msg = str(exc)
        if msg == "Cancelled.":
            return 0  # the user said no; that is an outcome, not an error
        _show_dialog("Prism", msg)
        return 1

    log.info("Opened %s from %s", project_id, opened)
    return 0


def _clone_flow(name: str, origin: str) -> str | None:
    """Ask to clone, let the user pick a parent folder, then confirm. Returns the
    parent directory, or None to cancel.

    Prism only ever clones the project's own Prism-known origin, with the user's local
    git. This is the consent path for that: a plain link is not permission to write to
    disk, so nothing happens until the user says Clone, chooses where, and confirms.
    """
    from . import dialogs
    from .open_project import _safe_dirname

    if not dialogs.ask_clone_or_cancel(
        "Prism doesn't have %s on this machine.\n\n"
        "Clone it from remote repository?" % name,
        title="Open in KiCad",
    ):
        return None

    parent = dialogs.pick_clone_folder(
        "Pick a folder to clone %s into.\n\n"
        "That folder is added to "
        "your project list in the plugin." % name,
        title="Choose a folder",
    )
    if not parent:
        return None

    destination = "%s/%s" % (parent.rstrip("/\\"), _safe_dirname(name))
    if not dialogs.ask_clone_or_cancel(
        "Clone %s into:\n%s\n\n"
        "This uses your own git access (the same credentials you use for git)."
        % (name, destination),
        title="Clone",
    ):
        return None
    return parent


def _root_added(cloned_dir: str) -> None:
    """Tell the user the cloned folder was added to their project list."""
    _show_dialog(
        "Project list updated",
        "Added this folder to your Prism project list:\n\n%s"
        % cloned_dir,
    )


def _offer_reapply(entry: dict) -> bool:
    """Offer to bring back work set aside from the branch we just landed on.

    git stashes are a global stack, not per-branch, so without this the work the user set
    aside last time they switched off this branch just sits in the list. Offering (never
    auto-applying) closes that loop: applying can conflict, so it stays the user's yes.
    """
    from . import dialogs

    message = entry.get("message") or "your uncommitted changes"
    when = entry.get("when") or ""
    return dialogs.ask_reapply(
        "This branch has a stash%s:\n\n    %s\n\n"
        "Apply it to the working tree now?"
        % (f" {when}" if when else "", message),
        title="Stash",
    )


def _ask(question: str) -> bool:
    """A yes/no the user can actually refuse.

    Cloning a repo they did not ask for, into a folder they did not choose, is not
    something a link in a browser should authorise. So we ask, and a failure to ask
    (no dialog available) is a NO, never a silent yes.
    """
    from . import dialogs

    return dialogs.ask(question, confirm="Continue")


def _ask_uncommitted(question: str) -> tuple[str, str]:
    """The three-way choice for uncommitted work: set aside, discard, or cancel.

    Returns (action, message). Cancel when we cannot ask: a link is not consent to move,
    let alone destroy, somebody's unsaved board.
    """
    from . import dialogs

    return dialogs.ask_stash_or_discard(question, title="Uncommitted changes")


def _show_dialog(title: str, message: str) -> None:
    """Say something, from a process with no GUI toolkit loaded.

    Falls back to stdout if no window can be opened, which is all a headless machine can
    do and better than swallowing the message.
    """
    from . import dialogs

    dialogs.tell(message, title=title)


def spawn_notify(title: str, message: str) -> None:
    """Show a message from the agent WITHOUT touching a GUI toolkit on this thread.

    The long-lived agent may own a tray/tk loop, and tkinter is not thread-safe, so a
    background watcher must not call it directly. Instead spawn a short-lived copy of the
    agent in --notify mode, exactly as the OS spawns one to handle a prism:// link.
    Best-effort: a message that cannot be shown is not worth crashing a background thread.
    """
    try:
        cwd = None if is_frozen() else str(Path(__file__).resolve().parent.parent)
        subprocess.Popen(
            self_command("--notify", title, message),
            cwd=cwd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            **_detached(),
        )
    except Exception:  # noqa: BLE001 - never let a notification take a thread down
        log.warning("couldn't spawn a notification", exc_info=True)


def _watch_for_uninstall(stop: threading.Event) -> None:
    """Notice that we've been uninstalled, and tidy up after ourselves.

    PCM has no uninstall hook, and the agent is a detached process that outlives KiCad.
    So uninstalling the plugin deletes our binary from under a still-running agent,
    which then keeps serving, keeps its autostart entry, and keeps owning the prism://
    scheme, all pointing at a file that no longer exists.

    Nobody else can clean that up, so we watch for our own binary disappearing. Only
    meaningful when frozen; from a source checkout there's no single file to miss, and
    a developer deleting one is not an uninstall.
    """
    exe = Path(sys.executable) if getattr(sys, "frozen", False) else None
    if exe is None:
        return

    while not stop.wait(30):
        if exe.exists():
            continue
        # Give a slow or retrying installer a moment; a brief gap during a file
        # replace is an update, not an uninstall.
        time.sleep(5)
        if exe.exists():
            continue

        print(
            f"{exe} is gone; the plugin was uninstalled. Cleaning up.", file=sys.stderr
        )
        _cleanup_os_integration()
        stop.set()
        return


def _sweep_replaced_binaries() -> None:
    """Delete the copies of ourselves an installer left behind.

    Windows cannot delete a running .exe, so an installer replacing one renames it
    aside and writes the new build under the real name. The rename is permanent:
    nothing ever removes `prism-agent.exe~RF1a2b3c4.TMP`, and every update adds another
    20 MB. An install directory was found at twice its proper size after one update.

    Safe here because we are the agent that just started under the canonical name, so
    anything matching the pattern is by definition not us. A file still locked by an
    agent that has not exited yet simply fails to delete, and the next startup gets it.
    """
    if not is_frozen():
        return
    binary = Path(discovery.own_binary() or sys.executable)
    try:
        for leftover in binary.parent.glob(binary.name + "~*"):
            # The pattern cannot match our own name, since it requires a `~` suffix.
            # Checked anyway: this deletes files beside a 20 MB binary, and the cost of
            # being wrong is the agent removing itself.
            if leftover == binary:
                continue
            try:
                leftover.unlink()
                log.info("Removed %s, left by an earlier update", leftover.name)
            except OSError:
                pass  # still locked, or gone already; next startup will retry
    except OSError:
        pass  # unreadable directory is not worth failing a startup over


def _cleanup_os_integration() -> None:
    """Undo everything we registered with the OS. Best effort: a failure here must not
    stop the agent exiting, or an uninstall leaves a process running."""
    from . import autostart

    try:
        autostart.disable()
    except Exception:
        print("Couldn't remove the autostart entry.", file=sys.stderr)
    try:
        protocol.unregister()
    except Exception:
        print("Couldn't unregister the prism:// handler.", file=sys.stderr)


def uninstall(forget_settings: bool) -> list[str]:
    """Undo everything the agent registered with this machine, and say what was done.

    The counterpart to installing. `_watch_for_uninstall` tries to do this by noticing
    its own binary vanish, which is the best it can manage unprompted, but it cannot be
    relied on: an installer that RENAMES the locked .exe rather than deleting it leaves
    a file at that path, so the watcher stays quiet while the plugin is gone. It also
    only exists in a frozen build, so a source checkout never cleans up at all.

    Being asked directly has neither problem, and it answers the question the watcher
    cannot: how do I remove the agent WITHOUT uninstalling the plugin?

    `forget_settings` also drops the saved server URL and API token. Kept separate
    because the common case is reinstalling, where being signed in already is a
    kindness rather than a leak.

    Returns what it actually did, so the caller can show it rather than claim success
    over a list of silent failures.
    """
    done: list[str] = []

    from . import autostart

    try:
        if autostart.is_enabled():
            autostart.disable()
            done.append("Removed the autostart entry.")
    except Exception:
        done.append("Couldn't remove the autostart entry.")

    try:
        if protocol.is_registered():
            protocol.unregister()
            done.append("Unregistered the prism:// handler.")
    except Exception:
        done.append("Couldn't unregister the prism:// handler.")

    if forget_settings:
        try:
            path = settings_store.settings_path()
            if path.is_file():
                path.unlink()
                done.append("Forgot the saved server and sign-in.")
        except OSError:
            done.append("Couldn't remove the saved settings.")

    if not done:
        done.append("Nothing was registered; there was nothing to undo.")
    return done


def _claim_singleton() -> bool:
    """Become the one agent, retiring an older one if it holds the post.

    This is what makes an UPDATE work. The agent is detached and outlives KiCad, and
    autostart brings it back at login, so installing a new version routinely lands a
    new binary beside an OLD agent that is still running. The old code then serves
    forever: the newcomer used to see it, say "already running", and exit.

    So: if the incumbent is older than us, ask it to quit and take over. If it's the
    same version or newer, defer to it, there's nothing to gain by churning. If we
    can't tell (an agent from before this field existed), retire it anyway: an unknown
    version is by definition not newer than ours.

    Returns True if we should go on to serve.
    """
    existing = discovery.running_agent()
    if not existing:
        return True

    theirs = existing.get("version", "")
    if theirs and not should_retire(theirs):
        print(
            f"The Prism agent is already running on 127.0.0.1:{existing['port']} "
            f"(pid {existing.get('pid')}, version {theirs}).",
            file=sys.stderr,
        )
        return False

    print(
        f"Retiring agent {theirs or 'of unknown version'} "
        f"(pid {existing.get('pid')}) in favour of {VERSION}.",
        file=sys.stderr,
    )
    if not _retire(existing):
        print("Couldn't stop the running agent; leaving it in place.", file=sys.stderr)
        return False
    return True


def _retire(existing: dict) -> bool:
    """Ask a running agent to quit, and wait for it to actually go.

    Uses its own /quit route, so it shuts down cleanly and clears its discovery file
    rather than being killed and leaving a stale one behind.
    """
    port, token = existing.get("port"), existing.get("token")
    if not port or not token:
        return False

    try:
        loopback.call(port, "POST", "/quit", token=token, body={}, timeout=10)
    except (loopback.Refused, loopback.Unreachable, TypeError, ValueError):
        return False

    # It answers before it stops (shutting down from inside a handler would deadlock),
    # so wait for the port to actually go quiet rather than racing it for the bind.
    for _ in range(50):
        if discovery.running_agent() is None:
            return True
        time.sleep(0.1)
    return False


def self_command(*args: str) -> list[str]:
    """How to invoke *this* agent again, frozen or not.

    Frozen, the agent IS an executable, so it takes the arguments directly. From a
    checkout it's a Python interpreter, which needs `-m prism_agent`. Everything
    that re-launches us (restart, autostart, the prism:// handler) must go through
    here, or it will work in a dev tree and break in the shipped binary.
    """
    if is_frozen():
        return [discovery.own_binary(), *args]
    return [sys.executable, "-m", "prism_agent", *args]


def _detached() -> dict:
    """Popen flags for a process that must outlive its parent.

    CREATE_NO_WINDOW keeps the relaunched agent from opening a console window on
    restart, DETACHED_PROCESS alone frees it from the parent's console but does
    not stop a console-subsystem python from creating its own."""
    if sys.platform == "win32":
        return {
            "creationflags": (
                subprocess.CREATE_NEW_PROCESS_GROUP
                | subprocess.DETACHED_PROCESS
                | subprocess.CREATE_NO_WINDOW
            )
        }
    return {"start_new_session": True}  # setsid


def _relaunch() -> None:
    """Start a fresh agent process, for /restart.

    Detached, and only *after* the current one has released its port and discovery
    file, otherwise the new agent's single-instance guard would see us still alive
    and politely refuse to start.
    """
    cwd = None if is_frozen() else str(Path(__file__).resolve().parent.parent)
    subprocess.Popen(
        self_command(),
        cwd=cwd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        **_detached(),
    )


class _DockFailureWatch(logging.Handler):
    """Catches pystray's own "Failed to dock icon" log line.

    pystray's X11 backend (_xorg.py) deliberately swallows a missing systray
    manager: no exception reaches us, no exit code changes, it just logs and
    waits to retry if one ever appears. On a desktop with no systray host at
    all (stock GNOME Shell, confirmed on Debian 13: no crash, no error the
    agent itself could see, just a silently undocked icon forever), that retry
    never comes and the user is left thinking the agent isn't running.

    We can't ask pystray "did you actually dock" through any public API, so
    this watches for the one symptom it does surface, its own log message, and
    treats "it complained about docking, and never later logged success" as
    good enough evidence to fall back rather than promise an icon nobody sees.
    """

    def __init__(self):
        super().__init__(level=logging.ERROR)
        self.failed = threading.Event()

    def emit(self, record: logging.LogRecord) -> None:
        if "Failed to dock icon" in record.getMessage():
            self.failed.set()


def _run_tray(tray_mods, server, stop: threading.Event, config, port) -> int:
    pystray, Image, ImageDraw = tray_mods

    def on_quit(icon, _item):
        stop.set()
        _shutdown(server)
        icon.stop()

    def on_restart(icon, _item):
        # Same path /restart takes: stop, then relaunch once we've released the
        # port and the discovery file.
        if server.state.request_restart:
            server.state.request_restart()
        _shutdown(server)
        icon.stop()

    def on_uninstall(icon, _item):
        # Off the tray thread: the dialogs block, and a blocked tray loop is a frozen
        # icon with no way back.
        def run():
            from . import dialogs

            if not dialogs.ask(
                "Remove the Prism agent from this computer?\n\n"
                "It will stop running, no longer start at login, and no longer open "
                "prism:// links.\n\n"
                "The KiCad plugin stays installed; remove it from KiCad's Plugin "
                "Manager if you want that gone too.",
                title="Remove the Prism agent",
                confirm="Remove",
            ):
                return

            forget = dialogs.ask(
                "Also forget the saved server and sign-in?\n\n"
                "Say no to keep them, so reinstalling picks up where you left off.",
                title="Remove the Prism agent",
                confirm="Forget them",
            )

            done = uninstall(forget_settings=forget)
            _show_dialog("Prism agent removed", "\n".join(done))

            # Only now stop: doing it first would take the dialogs down with us.
            stop.set()
            _shutdown(server)
            icon.stop()

        threading.Thread(target=run, name="prism-uninstall", daemon=True).start()

    def on_open_prism(_icon, _item):
        import webbrowser

        # Read the setting fresh: the user may have changed the server URL since
        # the agent started, and opening the old one would be quietly wrong.
        webbrowser.open(settings_store.load().server_url)

    def _identity() -> dict:
        # Cheap enough to read on each menu open: it is a couple of loopback-ish
        # calls to the backend, and it keeps the Sign in/out items honest (a token
        # can expire or be revoked under a running agent).
        try:
            return server.state.prism.identity()
        except Exception:
            return {}

    def sign_in_visible(_item) -> bool:
        ident = _identity()
        return bool(ident.get("sign_in_required")) and not ident.get("signed_in")

    def sign_out_visible(_item) -> bool:
        return bool(_identity().get("signed_in"))

    def on_sign_in(_icon, _item):
        from .server import apply_sign_in

        # Off the tray thread: the browser wait can take minutes, and blocking the
        # tray loop would freeze the icon and its menu.
        def run():
            status, result = apply_sign_in(server.state)
            if status != 200:
                _show_dialog("Prism sign-in", result.get("error", "Sign-in failed."))

        threading.Thread(target=run, name="prism-signin", daemon=True).start()

    def on_sign_out(_icon, _item):
        from .server import apply_sign_out

        def run():
            warning = apply_sign_out(server.state)
            if warning:
                _show_dialog("Prism sign-out", warning)

        threading.Thread(target=run, name="prism-signout", daemon=True).start()

    def status_text(_item) -> str:
        # pystray re-evaluates this each time the menu opens, so it stays live.
        return f"Agent running on 127.0.0.1:{port}"

    def server_text(_item) -> str:
        return f"Server: {settings_store.load().server_url}"

    def _kicad_menu():
        """A radio submenu to choose which KiCad opens project files.

        Rebuilt each time the tray menu is constructed (once per run); discovery is
        cheap and the set of installed KiCads does not change under a running agent
        often enough to warrant re-scanning on every menu open. "System default"
        clears the pinned command, restoring the OS file association.
        """
        from . import kicad_versions

        try:
            installs = kicad_versions.discover()
        except Exception:
            installs = []

        def choose(command):
            return lambda _icon, _item: settings_store.update(kicad_command=command)

        def is_current(command):
            return lambda _item: settings_store.load().kicad_command.strip() == command

        items = [
            pystray.MenuItem(
                "System default",
                choose(""),
                checked=is_current(""),
                radio=True,
            )
        ]
        for install in installs:
            items.append(
                pystray.MenuItem(
                    install.label,
                    choose(install.path),
                    checked=is_current(install.path),
                    radio=True,
                )
            )
        if not installs:
            items.append(
                pystray.MenuItem("(no KiCad found)", None, enabled=False)
            )
        return pystray.Menu(*items)

    # pystray.Icon is the backend's own class. The X11 one drops alpha and has no
    # menus at all (see tray_menu.py); every other backend does both itself.
    x11_backend = getattr(pystray.Icon, "__module__", "").endswith("_xorg")

    icon_image = _make_icon(Image, ImageDraw)
    if x11_backend:
        icon_image = _flatten_for_xembed(icon_image, Image)

    menu_open = threading.Lock()
    menu_helper: dict = {"proc": None}

    def on_click_open_menu(icon, _item):
        # The X11 backend's only click: it runs the default item. Show the rest of
        # this same menu ourselves, off the tray thread (the helper waits on the user).
        def run():
            if not menu_open.acquire(blocking=False):
                # A second click while it's open closes it, like a real tray menu.
                proc = menu_helper["proc"]
                if proc is not None:
                    proc.terminate()
                return
            try:
                from . import tray_menu

                spec, items = tray_menu.describe(icon.menu, pystray.Menu.SEPARATOR)
                cwd = None if is_frozen() else str(Path(__file__).resolve().parent.parent)
                proc = subprocess.Popen(
                    self_command("--tray-menu", json.dumps(spec)),
                    cwd=cwd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                )
                menu_helper["proc"] = proc
                try:
                    stdout, _ = proc.communicate(timeout=180)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    stdout, _ = proc.communicate()
                lines = (stdout or "").strip().splitlines()
                chosen = items.get(lines[-1]) if lines else None
                if chosen is not None:
                    chosen(icon)
            except Exception:  # noqa: BLE001 - a menu must never take the agent down
                log.warning("couldn't show the tray menu", exc_info=True)
            finally:
                menu_helper["proc"] = None
                menu_open.release()

        threading.Thread(target=run, name="prism-tray-menu", daemon=True).start()

    # Hidden: never listed, only fired by a click, and only on the X11 backend.
    click_menu = (
        (pystray.MenuItem("Menu", on_click_open_menu, default=True, visible=False),)
        if x11_backend
        else ()
    )

    icon = pystray.Icon(
        "kicad-prism",
        icon_image,
        f"KiCad-Prism agent {VERSION}",
        menu=pystray.Menu(
            *click_menu,
            pystray.MenuItem(status_text, None, enabled=False),
            pystray.MenuItem(server_text, None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Open Prism", on_open_prism),
            # Sign in / out show only when they apply: sign in when the server
            # wants a token and we have none, sign out when we are signed in. On a
            # no-auth server neither appears. pystray re-checks visible() each time
            # the menu opens, so the pair stays in step with the real state.
            pystray.MenuItem("Sign in", on_sign_in, visible=sign_in_visible),
            pystray.MenuItem("Sign out", on_sign_out, visible=sign_out_visible),
            pystray.Menu.SEPARATOR,
            # Which KiCad opens project files, when several are installed.
            pystray.MenuItem("Open files with", _kicad_menu()),
            pystray.Menu.SEPARATOR,
            # Settings live in the plugin's dialog, which is a real UI toolkit,
            # pystray menus can't host text fields, so pointing at it beats a
            # half-usable tray form.
            pystray.MenuItem("Restart agent", on_restart),
            pystray.MenuItem("Quit", on_quit),
            pystray.Menu.SEPARATOR,
            # Below Quit and behind two questions: this is the destructive one, and it
            # should not sit where a mis-click lands.
            pystray.MenuItem("Remove the agent...", on_uninstall),
        ),
    )

    # /quit sets the same event the tray's Quit item does, so the API can stop the
    # agent even while the tray loop owns the main thread. Without this the process
    # would keep running after /quit answered "stopping".
    def _watch_for_api_quit():
        stop.wait()
        _shutdown(server)
        icon.stop()

    threading.Thread(target=_watch_for_api_quit, daemon=True).start()

    # pystray's own X11 backend logs "Failed to dock icon" and silently waits to
    # retry, rather than raising. On a desktop with no systray host at all that
    # retry never comes, so watch for the same symptom and fall back to headless:
    # keep the agent running, just say plainly that there's no icon to look for.
    dock_watch = _DockFailureWatch()
    pystray_log = logging.getLogger("pystray")
    pystray_log.addHandler(dock_watch)

    def _watch_for_dock_failure():
        # Give it a moment to actually try before giving up on it: the first
        # attempt happens as the mainloop starts, not the instant run() is called.
        if dock_watch.failed.wait(timeout=3) and not stop.is_set():
            log.warning(
                "No system tray is available on this desktop (pystray couldn't "
                "dock an icon); continuing without one. On GNOME, install and "
                "enable gnome-shell-extension-appindicator, then log in again."
            )
            icon.stop()

    threading.Thread(
        target=_watch_for_dock_failure, name="prism-tray-dock-watch", daemon=True
    ).start()

    try:
        icon.run()  # blocks on the platform's tray loop
    finally:
        pystray_log.removeHandler(dock_watch)
        if not stop.is_set() and not dock_watch.failed.is_set():
            _shutdown(server)

    if dock_watch.failed.is_set() and not stop.is_set():
        # icon.run() returned because we called icon.stop() above, not because
        # anyone asked to quit. Same server, same port, same discovery file:
        # just keep serving without a tray loop blocking on nothing.
        #
        # pystray leaves a non-daemon setup thread stuck on the icon it never
        # docked, and the interpreter waits on it forever at exit: found live,
        # /quit and SIGTERM both stopped the server and left the process running,
        # which also broke the plugin's Restart (the old agent never went away).
        # main() exits hard once everything real is cleaned up. See
        # _hard_exit_after_run.
        global _hard_exit_after_run
        _hard_exit_after_run = True
        return _run_headless(
            server, stop, port, "No system tray available; continuing headless."
        )
    return 0


# Set when the tray fell back to headless after pystray failed to dock (only its X11
# backend does that, so Linux in practice). main() then ends with os._exit rather
# than a normal interpreter shutdown, which would wait forever on pystray's stuck
# thread. Everything that matters (server stopped, discovery file removed, relaunch
# on restart) has already happened by then.
_hard_exit_after_run = False


def _run_headless(server, stop: threading.Event, port, reason: str | None) -> int:
    """Serve with no tray. The API is the control surface, so nothing is lost but
    the icon, as long as we say so loudly and explain how to stop it."""
    if reason:
        print(reason, file=sys.stderr)
        print(file=sys.stderr)

    print(f"KiCad-Prism agent {VERSION} running on 127.0.0.1:{port} (no tray).")
    print("The KiCad plugin will find it as usual.")
    print(f"Stop it with Ctrl-C, or POST /quit (token in {discovery.endpoint_path()}).")
    sys.stdout.flush()

    def _sig(_signum, _frame):
        stop.set()

    signal.signal(signal.SIGINT, _sig)
    try:
        signal.signal(signal.SIGTERM, _sig)
    except (AttributeError, ValueError):
        pass  # not settable on every platform / thread

    try:
        stop.wait()
    finally:
        _shutdown(server)
    print("\nAgent stopped.")
    return 0


def _use_os_trust_store() -> None:
    """Verify HTTPS against the OS's certificate store, not OpenSSL's.

    The frozen macOS agent's OpenSSL looks for CAs under the build machine's
    Python.framework path, which doesn't exist on a user's Mac, so it could verify no
    certificate at all, public ones included. truststore routes verification through
    the Keychain / Windows certificate store instead: the agent trusts exactly what the
    browser and KiCad trust, a private CA the user installed included.
    """
    try:
        import truststore
    except ImportError:
        log.warning("truststore isn't installed; HTTPS uses OpenSSL's own CA paths")
        return
    truststore.inject_into_ssl()


def main() -> int:
    # First, before anything can launch a program: see linux_env. No-op off Linux.
    from . import linux_env

    linux_env.clean_process_environment()

    ap = argparse.ArgumentParser(prog="prism_agent", description=__doc__)
    ap.add_argument(
        "--no-tray",
        action="store_true",
        help="run without a tray icon (headless, SSH, or a desktop with no tray)",
    )
    ap.add_argument(
        "--open-url",
        metavar="URL",
        help="handle a prism:// link and exit (this is how the OS invokes us)",
    )
    ap.add_argument(
        "--uninstall",
        action="store_true",
        help="undo the autostart entry and the prism:// registration, then exit. "
        "The tray offers the same thing; this is how a machine with no tray "
        "(headless, SSH, Wayland without an appindicator) gets at it",
    )
    ap.add_argument(
        "--forget-settings",
        action="store_true",
        help="with --uninstall, also delete the saved server URL and API token",
    )
    ap.add_argument(
        "--notify",
        nargs=2,
        metavar=("TITLE", "MESSAGE"),
        help="show one themed message and exit (the agent spawns us for this so a "
        "background thread never touches a GUI toolkit directly)",
    )
    # Internal, like --notify: the tray's click menu on Linux, see tray_menu.py.
    ap.add_argument("--tray-menu", metavar="SPEC", help=argparse.SUPPRESS)
    from .profiles import PROFILES, is_known

    ap.add_argument(
        "--profile",
        metavar="NAME",
        choices=sorted(PROFILES),
        help=(
            "run as this profile (own discovery file, settings, port, and "
            "single-instance guard), one of: "
            + ", ".join(sorted(PROFILES))
            + ". Lets a dev copy and an installed one coexist. Defaults to "
            "auto-detection (a source checkout is 'dev')."
        ),
    )
    args = ap.parse_args()

    if args.profile:
        # Set the env var before anything resolves the profile: discovery,
        # server, and any child process we spawn all read PRISM_PROFILE through
        # the registry, so this one assignment steers them all. discovery.PROFILE
        # (captured at import) is refreshed too for callers that read it directly.
        import os

        os.environ["PRISM_PROFILE"] = args.profile
        discovery.PROFILE = args.profile if is_known(args.profile) else discovery.PROFILE

    _setup_logging()
    _use_os_trust_store()
    # After the profile is known: the settings file it writes to depends on it.
    linux_env.remember_kicad_appimage()

    if args.open_url:
        return _handle_url(args.open_url)

    if args.notify:
        # A one-shot themed dialog, run as its own short-lived process. The agent uses
        # this instead of calling tkinter from a background thread while the tray owns
        # its own event loop, which is not safe.
        _show_dialog(args.notify[0], args.notify[1])
        return 0

    if args.tray_menu:
        from . import tray_menu

        return tray_menu.run_helper(args.tray_menu)

    if args.uninstall:
        # Deliberately does NOT stop a running agent: this process is a separate,
        # short-lived one, and killing the other would be doing something the flag
        # does not say. The registrations are what outlive a session, and those go.
        for line in uninstall(forget_settings=args.forget_settings):
            print(line)
        return 0

    # One agent per machine. A second would bind a different port, overwrite the
    # discovery file, and leave two processes racing, with whichever exits last
    # deleting the file and orphaning the other, so the plugin can find neither.
    if not _claim_singleton():
        return 0  # an equal-or-newer agent already holds the post

    # We hold the post under the canonical name, so any prism-agent.exe~* beside us is
    # a copy an installer renamed out of the way and never cleaned up.
    _sweep_replaced_binaries()

    # A prism:// registration embeds the interpreter, the source path and the profile,
    # and any of those can drift under it: moving the checkout, switching venvs, or
    # (the one that bit) a dev agent that registered a command carrying no profile, so
    # the handler read a different settings file than the agent and reported "no
    # projects folder is set" for folders the user could see in the plugin.
    #
    # is_registered() cannot catch that, the key is there and looks fine, so rewrite our
    # own registration when its contents no longer match what we would write. Only when
    # one already exists: this repairs, it never claims the scheme uninvited.
    try:
        if protocol.is_stale():
            protocol.register()
            log.info("Rewrote a stale prism:// registration")
    except protocol.RegistrationError as exc:
        log.warning("Couldn't refresh the prism:// registration: %s", exc)

    # The autostart entry drifts the same way, and worse: it records an absolute path,
    # so an update that moves the binary leaves an entry that starts the old agent
    # until it is swept and then nothing at all. The setting still reads "enabled", so
    # nothing looks wrong until a login produces no agent. Repairs only, same as above.
    try:
        from . import autostart

        if autostart.is_stale():
            autostart.enable()
            log.info("Rewrote a stale autostart entry")
    except Exception as exc:
        log.warning("Couldn't refresh the autostart entry: %s", exc)

    config = _prism_config()
    server, _thread, state = serve(config)
    port = server.server_address[1]

    # One stop signal for every route out: the tray's Quit item, Ctrl-C, and the
    # API's /quit all set it. That's what keeps the agent controllable on a
    # machine where no tray icon can be drawn.
    stop = threading.Event()
    restarting = threading.Event()
    state.request_stop = stop.set

    def request_restart():
        # Relaunch only after we've exited, so the new agent's single-instance
        # guard doesn't see us still alive and refuse to start.
        restarting.set()
        stop.set()

    state.request_restart = request_restart

    # Uninstalling the plugin deletes our binary from under us. Nobody else can notice
    # that (PCM has no uninstall hook, and we're detached from KiCad), so we do.
    threading.Thread(
        target=_watch_for_uninstall,
        args=(stop,),
        name="prism-uninstall-watch",
        daemon=True,
    ).start()

    try:
        if args.no_tray:
            return _run_headless(server, stop, port, None)
        return _run_with_tray(server, stop, config, port)
    finally:
        if restarting.is_set():
            _relaunch()
        if _hard_exit_after_run:
            import os

            logging.shutdown()
            sys.stdout.flush()
            sys.stderr.flush()
            os._exit(0)


def _run_with_tray(server, stop, config, port) -> int:
    tray_mods, problem = _load_tray()
    if tray_mods is None:
        # No tray available, but the agent is still perfectly useful, and exiting
        # here would take the plugin's only backend down with it.
        return _run_headless(server, stop, port, problem)
    return _run_tray(tray_mods, server, stop, config, port)


if __name__ == "__main__":
    raise SystemExit(main())
