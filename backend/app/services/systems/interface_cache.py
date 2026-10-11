"""Parsed interface artifacts kept in process (SB2-93).

An artifact is keyed by ``(project, commit, extractor version)`` and never changes once
stored (the first writer wins, §3), so a parsed copy can be reused by every request
without invalidation. Reading and decoding the multi-MB payload was the largest cost of
the system document and the scene.

The cache is bounded by an estimate of the parsed size and evicts least recently used
artifacts, so memory does not grow with the number of systems or boards. Parsed JSON is
about 30 times its stored size (JTYU-CMBD: 0.69 MB stored, 20 MB parsed); the budget is
``PRISM_INTERFACE_CACHE_MB`` (default 256).

Callers share the cached objects and must not mutate them. With
``PRISM_INTERFACE_CACHE_VERIFY`` set (the test suite sets it), every hit re-hashes the
artifact and raises if anything changed it.
"""

from __future__ import annotations

import hashlib
import json
import threading
from collections import OrderedDict
from typing import Any, Optional

from app.core.config import settings

PARSED_PER_STORED_BYTE = 30
Key = tuple[str, str, str]


class _Entry:
    __slots__ = ("payload", "size", "components", "check")

    def __init__(self, payload: dict, size: int, check: Optional[str]) -> None:
        self.payload = payload
        self.size = size
        self.components: Optional[dict[str, dict]] = None
        self.check = check


def _hash(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


class InterfaceCache:
    def __init__(self, budget_bytes: int, *, verify: bool = False) -> None:
        self.budget_bytes = budget_bytes
        self.verify = verify
        self._entries: "OrderedDict[Key, _Entry]" = OrderedDict()
        self._bytes = 0
        self._lock = threading.Lock()

    def get(self, key: Key) -> Optional[dict]:
        entry = self._entry(key)
        return entry.payload if entry else None

    def put(self, key: Key, payload: dict, stored_bytes: int) -> dict:
        """Keep ``payload`` (from a row of ``stored_bytes``); an artifact larger than the budget is not kept."""
        size = max(1, int(stored_bytes)) * PARSED_PER_STORED_BYTE
        if size > self.budget_bytes:
            return payload
        entry = _Entry(payload, size, _hash(payload) if self.verify else None)
        with self._lock:
            if key in self._entries:
                return self._entries[key].payload  # same artifact read twice concurrently: keep the first
            self._entries[key] = entry
            self._bytes += size
            while self._bytes > self.budget_bytes:
                _, evicted = self._entries.popitem(last=False)
                self._bytes -= evicted.size
        return payload

    def component(self, key: Key, port_key: str) -> tuple[bool, Optional[dict]]:
        """``(cached, component)``: whether the artifact is cached, and its component with ``port_key``."""
        entry = self._entry(key)
        if entry is None:
            return False, None
        if entry.components is None:
            index: dict[str, dict] = {}
            for component in entry.payload.get("components") or ():
                index.setdefault(str(component.get("portKey")), component)
            entry.components = index
        return True, entry.components.get(port_key)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self._bytes = 0

    def stats(self) -> dict:
        with self._lock:
            return {"entries": len(self._entries), "bytes": self._bytes, "budgetBytes": self.budget_bytes}

    def _entry(self, key: Key) -> Optional[_Entry]:
        with self._lock:
            entry = self._entries.get(key)
            if entry is not None:
                self._entries.move_to_end(key)
        if entry is not None and entry.check is not None and _hash(entry.payload) != entry.check:
            raise AssertionError(f"cached interface {key} was mutated by a caller")
        return entry


_VERIFY = settings.PRISM_INTERFACE_CACHE_VERIFY
interfaces = InterfaceCache(int(settings.PRISM_INTERFACE_CACHE_MB * 1024 * 1024), verify=_VERIFY)
# SB2-95: the same mechanism for the other immutable inputs of a hierarchy resolve. A child
# snapshot's manifest never changes, nor does the snapshot a catalog revision was published from.
manifests = InterfaceCache(64 * 1024 * 1024, verify=_VERIFY)
revision_sources = InterfaceCache(4 * 1024 * 1024, verify=_VERIFY)


def clear_all() -> None:
    for cache in (interfaces, manifests, revision_sources):
        cache.clear()
