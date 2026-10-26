"""Removing a folder that holds read-only copies, which Windows refuses to delete."""

from __future__ import annotations

import os
import shutil
import stat
from pathlib import Path
from typing import Any, Callable


def _clear_read_only(function: Callable[..., Any], path: str, error: BaseException) -> None:
    """``rmtree`` error handler: make the entry writable and retry once."""

    if not isinstance(error, PermissionError):
        raise error
    os.chmod(path, stat.S_IWRITE | stat.S_IREAD)
    function(path)


def remove_tree(path: str | Path, *, ignore_errors: bool = False) -> None:
    """``shutil.rmtree`` that clears the read-only attribute of what it cannot delete."""

    shutil.rmtree(path, ignore_errors=ignore_errors, onexc=None if ignore_errors else _clear_read_only)
