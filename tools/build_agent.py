"""Build the agent into a self-contained executable.

Why this exists: the KiCad plugin runs inside KiCad's embedded Python, which has
no pystray/Pillow, and we cannot assume the user has *any* other Python. The old
approach (hunt the machine for an interpreter that happens to have the deps) fails
for exactly the person we're building for: someone who installed a zip from KiCad's
Plugin Manager and has never run pip.

So the agent ships as a binary. The plugin just runs it. No interpreter, no
dependencies, no install step.

    python tools/build_agent.py

PyInstaller cannot cross-compile: a macOS binary must be built on macOS, a Linux
one on Linux. Run this on each target (CI does exactly that), see
.github/workflows/build-plugin.yml.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
DIST = TOOLS / "dist"
BUILD = TOOLS / "build"

NAME = "prism-agent"

REQUIREMENTS = TOOLS / "prism_agent" / "requirements.txt"


def _check_requirements_installed() -> None:
    """Refuse to build from an interpreter missing a declared runtime dependency.

    Found the hard way: a binary built from a venv that predated truststore being
    added to requirements.txt still built successfully (PyInstaller only bundles what
    the entry script actually imports, and __main__.py's import is wrapped in a
    try/except specifically so a MISSING truststore degrades gracefully at runtime,
    see _use_os_trust_store). The result looked completely normal, right version
    string, no error anywhere, and simply couldn't verify any HTTPS certificate.
    Nothing about that build step said so. This does, before PyInstaller ever runs.

    Checks by distribution name (importlib.metadata, what pip itself tracks), not by
    import name, so this stays correct as dependencies are added: pystray/Pillow/
    truststore's import names already don't all match their package names.
    """
    from importlib.metadata import PackageNotFoundError, version

    names = []
    for line in REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        name = re.split(r"[<>=!~\s]", line, maxsplit=1)[0]
        if name:
            names.append(name)

    missing = []
    for name in names:
        try:
            version(name)
        except PackageNotFoundError:
            missing.append(name)

    # Not a pip package, so requirements.txt can't say it: every agent dialog (the
    # prism:// results, errors, the uninstall prompts) is tkinter. A distro Python
    # without it (Debian's, unless python3-tk is installed) builds a binary that
    # works in every other way and silently shows no message at all. Found live.
    try:
        import tkinter  # noqa: F401
    except ImportError:
        missing.append("tkinter (a system package: python3-tk on Debian/Ubuntu)")

    if missing:
        raise SystemExit(
            "This interpreter is missing packages requirements.txt declares: %s\n"
            "The build would succeed anyway (PyInstaller only bundles what it can "
            "see imported, and the agent degrades some of these at runtime rather "
            "than crash), producing a binary that's silently missing them. Install "
            "any system package named above, then:\n"
            "    %s -m pip install -r %s"
            % (", ".join(missing), sys.executable, REQUIREMENTS)
        )


def _sep() -> str:
    """PyInstaller's --add-data separator: ';' on Windows, ':' elsewhere."""
    return ";" if sys.platform == "win32" else ":"


def build(clean: bool = True, console: bool = False) -> Path:
    _check_requirements_installed()

    if clean:
        for d in (DIST, BUILD):
            shutil.rmtree(d, ignore_errors=True)

    assets = TOOLS / "prism_agent" / "assets"

    # The agent loads the backend's noise classifier by path (see worktree_diff), so
    # the plugin and the web UI agree on what a KiCad backup is. A shipped binary has
    # no repo to load it from, so it gets bundled.
    services = TOOLS.parent / "backend" / "app" / "services"
    bundled_services = ("kicad_noise_service.py",)
    for required in bundled_services:
        if not (services / required).is_file():
            raise SystemExit(f"can't find {required} in {services}")

    args = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--onefile",
        "--name",
        NAME,
        "--distpath",
        str(DIST),
        "--workpath",
        str(BUILD),
        "--specpath",
        str(BUILD),
        # The tray icons live inside the binary; _make_icon() resolves them via
        # sys._MEIPASS at runtime (see prism_agent/__main__.py).
        "--add-data",
        f"{assets}{_sep()}prism_agent/assets",
        # The palette, for the agent's own dialogs. It lives in the plugin package (which
        # is what ships to KiCad), but the plugin's __init__ imports pcbnew, so a frozen
        # agent cannot import its way to it: dialogs.py loads this file by path, from
        # sys._MEIPASS when frozen. Without it the prism:// popups silently fall back to
        # light-mode defaults on a dark desktop.
        "--add-data",
        f"{TOOLS / 'kicad_plugin' / 'prism_theme.py'}{_sep()}.",
        # Flattened to backend_services/, worktree_diff looks for them there when
        # frozen (sys._MEIPASS/backend_services).
        *[
            arg
            for svc in bundled_services
            for arg in ("--add-data", f"{services / svc}{_sep()}backend_services")
        ],
        # pystray picks its backend at import by trying each in turn, so the one it
        # needs is never a literal import PyInstaller can see. Name them all.
        "--hidden-import",
        "pystray._win32",
        "--hidden-import",
        "pystray._darwin",
        "--hidden-import",
        "pystray._appindicator",
        "--hidden-import",
        "pystray._gtk",
        "--hidden-import",
        "pystray._xorg",
        "--noconfirm",
    ]

    # A tray app must not flash a console. But --windowed on Windows also detaches
    # stdout/stderr, so a crash vanishes silently, hence --console for debugging.
    if console:
        args.append("--console")
    else:
        args.append("--windowed")

    if sys.platform == "win32":
        icon = assets / "prism-256.png"
        ico = TOOLS / "prism_agent" / "assets" / "prism.ico"
        if not ico.exists() and icon.exists():
            _png_to_ico(icon, ico)
        if ico.exists():
            args += ["--icon", str(ico)]

    # agent_main.py, NOT prism_agent/__main__.py: PyInstaller runs its entry script
    # with no package context, so __main__.py's relative imports would fail with
    # "attempted relative import with no known parent package".
    args.append(str(TOOLS / "agent_main.py"))

    print("$", " ".join(args[1:]))
    subprocess.run(args, check=True, cwd=str(TOOLS))

    out = DIST / (NAME + (".exe" if sys.platform == "win32" else ""))
    if not out.exists():
        raise SystemExit(f"build reported success but {out} is missing")

    if sys.platform == "darwin":
        _adhoc_sign(out)

    size = out.stat().st_size / (1024 * 1024)
    print(f"\nbuilt {out}  ({size:.1f} MB)")
    return out


def _adhoc_sign(binary: Path) -> None:
    """Ad-hoc sign the macOS binary.

    Free, and needs no Apple Developer account, `codesign -s -` signs with no
    identity. It does NOT satisfy Gatekeeper for a quarantined file (that needs
    notarisation), but:

      * On Apple Silicon an arm64 binary must carry at least an ad-hoc signature to
        execute *at all*, so this isn't optional.
      * In the normal install path the binary never gets quarantined anyway,
        Gatekeeper only inspects files carrying com.apple.quarantine, and that flag
        is applied by the *downloading* app. KiCad's Plugin Manager fetches and
        extracts the zip itself, so the flag is never set.

    A user who instead downloads the zip in a browser and extracts it with Finder
    *will* get a flagged binary and a "cannot be opened" prompt. The plugin strips
    the flag from our own binary before launching (see agent_launcher), and the
    install docs say the prompt may appear.
    """
    try:
        subprocess.run(
            ["codesign", "--force", "--sign", "-", str(binary)],
            check=True,
            capture_output=True,
            text=True,
        )
        print("ad-hoc signed", binary.name)
    except FileNotFoundError:
        print("WARNING: codesign not found; the binary is unsigned", file=sys.stderr)
    except subprocess.CalledProcessError as exc:
        print(f"WARNING: ad-hoc signing failed: {exc.stderr}", file=sys.stderr)


def _png_to_ico(png: Path, ico: Path) -> None:
    """Windows wants a .ico for the executable's icon."""
    try:
        from PIL import Image
    except ImportError:
        return
    img = Image.open(png).convert("RGBA")
    img.save(ico, sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
    print("wrote", ico)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument(
        "--windowed",
        action="store_true",
        help="build the default no-console tray binary explicitly",
    )
    mode.add_argument(
        "--console",
        action="store_true",
        help="keep a console window (so a crash is visible; use when debugging)",
    )
    ap.add_argument("--no-clean", action="store_true")
    args = ap.parse_args()

    build(clean=not args.no_clean, console=args.console)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
