"""Read projection members from a bundle, an unpacked bundle, or a plain directory.

Accepted forms of one bundle:

- a ``.prism`` archive (bundle-format.md): members ``projections/<stem>.json`` and ``bundle.json``;
- a directory holding ``projections/`` (an unpacked bundle, or ``prism-kicad bundle extract`` output);
- a directory of ``<stem>.json`` files (any projection JSON, for example a golden directory).

Only member names are read from an archive; nothing is extracted to disk.
"""

from __future__ import annotations

import json
import zipfile
from pathlib import Path
from typing import Any

from .members import Member


class BundleError(Exception):
    pass


class Bundle:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._zip: zipfile.ZipFile | None = None
        self._dir: Path | None = None
        if path.is_file():
            try:
                self._zip = zipfile.ZipFile(path)
            except zipfile.BadZipFile as error:
                raise BundleError(f"{path}: not a .prism archive: {error}") from error
            self.form = "archive"
        elif path.is_dir():
            self._dir = path / "projections" if (path / "projections").is_dir() else path
            self.form = "unpacked" if (path / "projections").is_dir() else "directory"
        else:
            raise BundleError(f"{path}: no such bundle")

    def close(self) -> None:
        if self._zip is not None:
            self._zip.close()

    def _read(self, archive_name: str, file_path: Path | None) -> bytes | None:
        if self._zip is not None:
            try:
                return self._zip.read(archive_name)
            except KeyError:
                return None
        if file_path is not None and file_path.is_file():
            return file_path.read_bytes()
        return None

    def member_bytes(self, member: Member) -> bytes | None:
        return self._read(member.bundle_path, self._dir / member.golden_name if self._dir else None)

    def member(self, member: Member) -> Any:
        data = self.member_bytes(member)
        if data is None:
            return None
        try:
            return json.loads(data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise BundleError(f"{self.path}: {member.bundle_path} is not JSON: {error}") from error

    def manifest(self) -> dict | None:
        """``bundle.json`` when the bundle has one (archive or unpacked)."""

        root = self.path if self._zip is None else None
        data = self._read("bundle.json", root / "bundle.json" if root is not None else None)
        return json.loads(data) if data else None


def find_bundles(directory: Path) -> dict[str, Path]:
    """``<case>.prism`` files and ``<case>/`` directories in ``directory``, by case id."""

    found: dict[str, Path] = {}
    for entry in sorted(directory.iterdir()):
        if entry.is_file() and entry.suffix == ".prism":
            found[entry.stem] = entry
        elif entry.is_dir() and not entry.name.startswith("."):
            found.setdefault(entry.name, entry)
    return found
