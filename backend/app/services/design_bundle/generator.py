"""The generator id, its digest, and the bundle key (cli-spec.md §5.1).

The generator id is ``prism-kicad version``'s ``CliVersionA0``. Its canonical
bytes are recomputed from the parsed document, never taken from key order
(§5.1.3), so a manifest's embedded ``generator`` hashes the same.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Mapping

BUNDLE_KEY_DOMAIN = b"prism.bundle_key.a0"


def generator_bytes(doc: Mapping[str, Any]) -> bytes:
    """§5.1.3: ``schema`` first, every other key in code point order, compact ASCII."""

    def order(value: Any) -> Any:
        if isinstance(value, Mapping):
            return {key: order(value[key]) for key in sorted(value)}
        if isinstance(value, list):
            return [order(item) for item in value]
        return value

    top = {"schema": doc["schema"], **{key: order(doc[key]) for key in sorted(doc) if key != "schema"}}
    return json.dumps(top, separators=(",", ":"), ensure_ascii=True).encode("ascii")


def generator_digest(doc: Mapping[str, Any]) -> str:
    return hashlib.sha256(generator_bytes(doc)).hexdigest()


def bundle_key(revision_key: str, doc: Mapping[str, Any]) -> str:
    """§5.1.4: SHA-256 of the domain, NUL, the revision key, NUL, the generator bytes."""

    if len(revision_key) != 64 or revision_key.strip("0123456789abcdef"):
        raise ValueError("revision key must be 64 lowercase hex digits")
    framed = BUNDLE_KEY_DOMAIN + b"\0" + revision_key.encode("ascii") + b"\0" + generator_bytes(doc)
    return hashlib.sha256(framed).hexdigest()


@dataclass(frozen=True)
class Generator:
    """One ``prism-kicad`` generator id, as K uses it."""

    document: Mapping[str, Any]

    @property
    def bytes(self) -> bytes:
        return generator_bytes(self.document)

    @property
    def digest(self) -> str:
        return generator_digest(self.document)

    @property
    def kicad_version(self) -> str:
        return str(self.document["kicad_version"])

    @property
    def models_procedure(self) -> str:
        return str(self.document["models_procedure"])

    def bundle_key(self, revision_key: str) -> str:
        return bundle_key(revision_key, self.document)
