"""Entry point for the packaged agent binary.

PyInstaller runs its entry script as a top-level script, with no package context,
so pointing it straight at prism_agent/__main__.py fails on the first relative
import ("attempted relative import with no known parent package"). This module is
imported *as a package member's caller*, so `prism_agent` resolves normally.

Keep it trivial. Everything real lives in prism_agent.__main__.
"""

from __future__ import annotations

import multiprocessing
import sys

from prism_agent.__main__ import main

if __name__ == "__main__":
    # Without this, a frozen app on Windows re-executes the whole binary in every
    # child process it spawns, the classic PyInstaller fork bomb.
    multiprocessing.freeze_support()
    sys.exit(main())
