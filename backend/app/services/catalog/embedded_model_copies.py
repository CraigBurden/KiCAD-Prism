"""The compressed copy of each 3D model placement embeds (issue #698, D2).

zstd output is stable for one library version only, so compressing a model
again after a ``zstandard`` upgrade could change the bytes of a footprint that
was already placed, and with them its manifest hash. Placement therefore
compresses a model once, keeps the result under the catalog store at
``embedded-models/zstd<level>/<sha256[:2]>/<sha256>.zst`` (``sha256`` of the
raw model) and reuses it from then on. The copy is part of the component store
and travels with its backups.

A copy is used only when it decompresses to the raw model's sha256; a damaged
or truncated copy is replaced by a fresh compression and logged. Copies are
written atomically and never edited, so concurrent placements at worst write
the same copy twice.
"""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
import tempfile

import zstandard

from app.services.catalog.kicad_embedded_files import ZSTD_LEVEL, compress_model, decompress_model


logger = logging.getLogger(__name__)

EMBEDDED_MODELS_DIRNAME = "embedded-models"


class CompressedModelCopies:
    """Compress a model once per content and keep the result under ``root``."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    @classmethod
    def under_store(cls, store_root: Path) -> "CompressedModelCopies":
        return cls(Path(store_root) / EMBEDDED_MODELS_DIRNAME)

    def path_for(self, sha256: str) -> Path:
        return self.root / f"zstd{ZSTD_LEVEL}" / sha256[:2] / f"{sha256}.zst"

    def compress(self, data: bytes) -> bytes:
        """The kept compressed copy of ``data``, compressing and keeping it the first time."""
        sha256 = hashlib.sha256(data).hexdigest()
        path = self.path_for(sha256)
        try:
            stored = path.read_bytes()
        except FileNotFoundError:
            stored = None
        except OSError:
            logger.warning("Could not read the compressed copy %s; compressing again", path, exc_info=True)
            stored = None
        if stored is not None:
            try:
                if hashlib.sha256(decompress_model(stored)).hexdigest() == sha256:
                    return stored
            except (ValueError, zstandard.ZstdError):
                pass
            logger.warning("Compressed model copy %s does not match its model; replacing it", path)
        compressed = compress_model(data)
        try:
            self._write(path, compressed)
        except OSError:
            # Placement still works; the next request tries to keep the copy again.
            logger.warning("Could not keep the compressed copy %s", path, exc_info=True)
        return compressed

    @staticmethod
    def _write(path: Path, payload: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
        try:
            with os.fdopen(handle, "wb") as output:
                output.write(payload)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, path)
        finally:
            Path(temporary).unlink(missing_ok=True)


__all__ = ["EMBEDDED_MODELS_DIRNAME", "CompressedModelCopies"]
