"""What counts as KiCad-generated noise, rather than design work.

KiCad writes a lot of files nobody wants to see in a change list or a commit
history. The worst is the auto-archive: `auto_backup` is ON by default and keeps up
to 25 zips / 100 MB per project in a `<project>-backups/` folder. There are also
`-bak` files, autosaves, and caches KiCad regenerates on demand.

None of it tells you anything about the design, and there can be dozens of entries
per real edit — which is exactly how the signal gets drowned.

Two things this module deliberately does NOT do:

  * It doesn't delete anything. It classifies.
  * It doesn't hide things silently. Callers should *gate* — show a count and let
    the user unfold it — because a file that vanishes with no trace is worse than
    one that's merely noisy. Silently hiding a file the user actually committed
    would be a lie about the state of their repo.

The honest fix for most of these is a .gitignore entry: they shouldn't be committed
at all. This module is what lets us say so.
"""

from __future__ import annotations

import re

# Directories KiCad owns end-to-end. Anything under them is noise.
NOISE_DIRS = (
    "-backups",  # the auto-archive: <project>-backups/*.zip. The big one.
)

# Suffixes for files KiCad writes for itself.
NOISE_SUFFIXES = (
    ".kicad_pcb-bak",
    ".kicad_sch-bak",
    ".kicad_prl",  # per-user local project state; not shared design data
    ".bak",
    ".bck",
    "-bak",
    "~",  # editor/KiCad leftovers
)

# Exact names (case-insensitive) that are generated rather than designed.
#   fp-info-cache  a footprint index KiCad rebuilds whenever it feels like it
#   .prism.json    our own project marker. We put it there; it is not the user's work,
#                  and showing it in their change list is us adding to the noise we are
#                  supposed to be removing.
NOISE_NAMES = ("fp-info-cache", ".prism.json")

# Directories whose contents we fetch rather than the user authoring them. RemoteLibrary
# is where the symbol provider downloads placed parts; it is a cache of upstream assets,
# and it churns on every placement.
_FETCHED_DIRS = re.compile(r"(^|/)RemoteLibrary(/|$)", re.IGNORECASE)

# Autosaves: KiCad prefixes the filename, e.g. _autosave-board.kicad_pcb
_AUTOSAVE = re.compile(r"(^|/)[_~]autosave[-_]", re.IGNORECASE)

# Cache libraries KiCad rebuilds from the schematic.
_CACHE_LIB = re.compile(r"-cache\.(lib|dcm)$", re.IGNORECASE)

# Lock files: "~<project>.kicad_pcb.lck", written while a document is open and deleted
# on close. They only appear in a change list because KiCad happened to be running.
_LOCK = re.compile(r"(^|/)~.*\.lck$", re.IGNORECASE)


def is_noise(path: str) -> bool:
    """Is this path something KiCad generated rather than something you designed?

    `path` is repo-relative and forward-slashed, as git reports it.
    """
    if not path:
        return False

    p = path.replace("\\", "/")
    lower = p.lower()
    name = lower.rsplit("/", 1)[-1]

    # A backups *directory* anywhere in the path — the archive folder, and anything
    # git reports inside it.
    for segment in lower.split("/"):
        if segment.endswith(NOISE_DIRS):
            return True

    if name in NOISE_NAMES:
        return True

    if lower.endswith(NOISE_SUFFIXES):
        return True

    if _AUTOSAVE.search(lower) or _CACHE_LIB.search(lower) or _LOCK.search(lower):
        return True

    return bool(_FETCHED_DIRS.search(p))


def partition(paths):
    """Split an iterable of paths into (design, noise), preserving order."""
    design, noise = [], []
    for p in paths:
        (noise if is_noise(p) else design).append(p)
    return design, noise


# The .gitignore that stops most of the above from ever reaching a change list.
#
# It lives HERE, beside the patterns it mirrors, because it is the same knowledge said
# twice: `is_noise` decides what to hide once a file is already in the way, and this
# decides what should never have been in the way at all. Two copies in two packages
# would drift the first time KiCad changes a suffix, and then Prism would hide a file in
# the history while git kept reporting it as your work.
#
# Deliberately NOT ignored, though `is_noise` is quiet about them elsewhere:
#
#   fp-lib-table / sym-lib-table  KiCad generates them, but people edit them, and they
#                                 decide what the board resolves to. Ignoring those would
#                                 hide a real change to a real dependency.
#
# The rule: ignore what KiCad rebuilds without being asked. Filter, but do not ignore,
# what KiCad writes and a human might mean.
#
# Note this only ever affects files that are NOT already tracked. A project that has
# committed one of these made a choice, and git keeps reporting a tracked file whatever
# the ignore rules say, so nothing here reverses that decision.
GITIGNORE = """\
# KiCad-Prism: files KiCad generates and rebuilds on its own.
# Filtering these from the history is not enough; they should not be committed at all.

# Auto-archive. On by default: up to 25 zips / 100 MB per project.
*-backups/

# Per-user local state: window layout, visible layers, last-opened sheet. Not design
# data, and it churns every time the project is opened and closed.
*.kicad_prl

# Backups and autosaves
*.kicad_pcb-bak
*.kicad_sch-bak
*.bak
*.bck
*-bak
_autosave-*
~autosave-*

# Lock files, written while a document is open
*.lck
~*.lck

# Caches KiCad rebuilds on demand
fp-info-cache
*-cache.lib
*-cache.dcm

# Fetched by the Prism remote library, not authored here
RemoteLibrary/
"""


def default_gitignore() -> str:
    """The KiCad .gitignore Prism writes. See GITIGNORE."""
    return GITIGNORE
