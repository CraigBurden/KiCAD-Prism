"""Link (or copy) the KiCad plugin into KiCad's plugin directory.

Prefers a SYMLINK so the repo stays the single source of truth: you edit the
plugin here, KiCad picks it up on its next "Refresh Plugins", no copy step to
forget, and no risk of editing the installed copy and losing it.

Falls back to copying if the OS won't allow symlinks (Windows needs Developer
Mode or admin), and says so, because a silent copy would quietly turn every later
edit into a no-op.

    python tools/install_plugin.py            # install
    python tools/install_plugin.py --uninstall
    python tools/install_plugin.py --copy     # force a copy instead of a link
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from prism_agent.profiles import PROFILES, resolve

PLUGIN_DIRNAME = "kicad_plugin"  # the single source folder in the repo


def _installed_kicad_versions() -> set[str]:
    """Versions that actually have KiCad installed.

    KiCad leaves a config dir behind for every version you've ever run, so the
    newest *config* dir is often not the newest *installed* KiCad (an upgrade or
    a trial can leave an orphan). Installing into an orphan means the plugin
    silently never appears. Cross-check against the real install locations.
    """
    if sys.platform == "win32":
        roots = [Path(r"C:\Program Files\KiCad"), Path(r"C:\Program Files (x86)\KiCad")]
    elif sys.platform == "darwin":
        roots = [Path("/Applications")]  # KiCad.app carries no version dir
    else:
        roots = []
    versions = set()
    for root in roots:
        if root.is_dir():
            versions.update(p.name for p in root.iterdir() if p.is_dir())
    return versions


def kicad_plugin_dirs() -> list[Path]:
    """Plausible KiCad plugin dirs, newest INSTALLED version first."""
    home = Path.home()
    if sys.platform in ("win32", "darwin"):
        base = home / "Documents" / "KiCad"
    else:
        base = home / ".local" / "share" / "kicad"

    if not base.is_dir():
        return []

    installed = _installed_kicad_versions()
    candidates = []
    for version in base.iterdir():
        plugins = version / "scripting" / "plugins"
        if not plugins.is_dir():
            continue
        # Prefer config dirs backed by a real install; keep the others as a
        # fallback so this still works where we can't detect the install root.
        candidates.append((version.name in installed, version.name, plugins))

    if not candidates:
        return []
    # installed first, then by version descending
    candidates.sort(key=lambda c: (c[0], c[1]), reverse=True)
    return [c[2] for c in candidates]


def install(source: Path, target_dir: Path, install_name: str, force_copy: bool) -> None:
    target = target_dir / install_name

    if target.is_symlink() or target.exists():
        uninstall(target_dir, install_name)

    if not force_copy:
        try:
            target.symlink_to(source, target_is_directory=True)
            print(f"Linked  {target}  ->  {source}")
            print(
                "Edits in the repo take effect directly (Tools > External Plugins > Refresh)."
            )
            return
        except OSError:
            print("Symlink not permitted; falling back to a copy.", file=sys.stderr)

    shutil.copytree(source, target, ignore=shutil.ignore_patterns("__pycache__"))
    print(f"Copied  {source}  ->  {target}")
    print("NOTE: this is a COPY. Re-run this script after every change to the plugin.")


def uninstall(target_dir: Path, install_name: str) -> None:
    if not target_dir.is_dir():
        # Say so. An uninstaller that silently does nothing when handed a bad path
        # is worse than one that fails: you walk away believing it worked.
        print(f"Not a directory: {target_dir}", file=sys.stderr)
        return

    target = target_dir / install_name
    if target.is_symlink():
        target.unlink()
        print(f"Removed link {target}")
    elif target.is_dir():
        shutil.rmtree(target)
        print(f"Removed {target}")
    else:
        print(f"Nothing installed at {target}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--uninstall", action="store_true")
    ap.add_argument("--copy", action="store_true", help="copy instead of symlinking")
    ap.add_argument("--dir", help="KiCad plugin dir (default: autodetect)")
    ap.add_argument(
        "--profile",
        metavar="NAME",
        choices=sorted(PROFILES),
        help=(
            "install under this profile's name so dev and release coexist as "
            "separate KiCad plugins, one of: " + ", ".join(sorted(PROFILES))
            + ". Defaults to auto-detection (a source checkout is 'dev')."
        ),
    )
    args = ap.parse_args()

    install_name = resolve(args.profile).install_name

    source = (Path(__file__).parent / PLUGIN_DIRNAME).resolve()
    if not source.is_dir():
        print(f"Plugin source not found: {source}", file=sys.stderr)
        return 1

    if args.dir:
        targets = [Path(args.dir)]
    else:
        targets = kicad_plugin_dirs()
        if not targets:
            print(
                "Couldn't find a KiCad plugin directory. Pass one with --dir, e.g.\n"
                r"    python tools/install_plugin.py --dir "
                r"C:\Users\<you>\Documents\KiCad\8.0\scripting\plugins",
                file=sys.stderr,
            )
            return 1
        targets = targets[:1]  # newest KiCad only

    for target_dir in targets:
        if args.uninstall:
            uninstall(target_dir, install_name)
        else:
            install(source, target_dir, install_name, force_copy=args.copy)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
