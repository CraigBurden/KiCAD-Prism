"""Keep KiCad's AppImage runtime, and PyInstaller's, out of what the agent launches.

Linux only; on Windows and macOS every function here returns its input untouched.

Found live on Debian with KiCad's AppImage. The plugin starts the agent from inside
KiCad, so the agent inherits the AppImage's runtime environment: PATH with the
AppImage's own bin/ first, LD_PRELOAD of a library inside it, PYTHONHOME/PYTHONPATH
pointing at KiCad's bundled Python, GIO/GdkPixbuf module paths, and more. Every
program the agent then starts (git, kicad-cli, the browser for sign-in, KiCad itself)
got all of it, and the whole mount (/tmp/.mount_*) vanishes the moment KiCad closes
while the agent keeps running, so from then on those paths point at nothing.

A frozen agent adds its own: PyInstaller sets LD_LIBRARY_PATH to its unpack folder
so the agent finds its bundled libraries, and a child inherits that too, so git or
kicad-cli can end up loading the agent's copy of libssl or libz instead of the
system's. PyInstaller keeps the original in LD_LIBRARY_PATH_ORIG for exactly this.

Changing os.environ does not affect the running agent itself (the loader reads its
paths once, at startup), only what it launches, which is the point.
"""

from __future__ import annotations

import os
import sys

# Set by the AppImage runtime about itself. Meaningless to anything we launch.
_APPIMAGE_OWN = ("APPDIR", "APPIMAGE", "ARGV0", "OWD")


def _is_linux() -> bool:
    return sys.platform.startswith("linux")


def without_appimage(env: dict) -> dict:
    """`env` minus everything KiCad's AppImage runtime injected.

    Recognised by value, not by a fixed list of names: anything pointing inside
    APPDIR came from the AppImage. A path list (PATH, XDG_DATA_DIRS, PYTHONPATH)
    loses just those entries; a single value (LD_PRELOAD, PYTHONHOME, GIO_MODULE_DIR)
    is dropped. So a variable the user set themselves, pointing elsewhere, survives.
    """
    appdir = env.get("APPDIR", "")
    if not _is_linux() or not appdir:
        return dict(env)

    out = {}
    for key, value in env.items():
        if key in _APPIMAGE_OWN:
            continue
        if appdir not in value:
            out[key] = value
            continue
        kept = [p for p in value.split(":") if p and not p.startswith(appdir)]
        if ":" in value and kept:
            out[key] = ":".join(kept)
        # else: a single value inside the AppImage, or a list with nothing left.
    return out


def without_frozen_library_path(env: dict) -> dict:
    """`env` with LD_LIBRARY_PATH as it was before PyInstaller changed it."""
    if not _is_linux() or not getattr(sys, "frozen", False):
        return dict(env)
    out = dict(env)
    original = out.pop("LD_LIBRARY_PATH_ORIG", None)
    if original:
        out["LD_LIBRARY_PATH"] = original
    else:
        out.pop("LD_LIBRARY_PATH", None)
    return out


# Set by the plugin when KiCad is an AppImage (see agent_launcher._env): the path of
# the .AppImage file, which unlike APPDIR survives KiCad closing.
KICAD_APPIMAGE_VAR = "PRISM_KICAD_APPIMAGE"


def remember_kicad_appimage() -> None:
    """Record the KiCad AppImage the plugin runs inside, if it told us, in settings.

    Persisted rather than just read from the environment, so an agent started at
    login (no KiCad, no plugin, no variable) still knows which KiCad to open projects
    with. Only rewritten when it changed, so the settings file is not touched on
    every start.
    """
    path = os.environ.pop(KICAD_APPIMAGE_VAR, "")
    if not _is_linux() or not path or not os.path.isfile(path):
        return
    from . import settings as settings_store

    if settings_store.load().kicad_appimage != path:
        settings_store.update(kicad_appimage=path)


def clean_process_environment() -> None:
    """Apply both to os.environ, once, before the agent starts anything."""
    if not _is_linux():
        return
    cleaned = without_frozen_library_path(without_appimage(dict(os.environ)))
    for key in set(os.environ) - set(cleaned):
        del os.environ[key]
    for key, value in cleaned.items():
        if os.environ.get(key) != value:
            os.environ[key] = value
