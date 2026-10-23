"""A small bounded LRU of shaped variant-catalog results.

The catalog is a few hundred bytes read out of a bundle member that can be tens
of megabytes (``projections/semantic-index.json``). Rebuilding it means
inflating, hashing, parsing and walking that whole member, so the shaped result
is worth keeping: a revision's member is immutable, and its SHA-256 names its
bytes.

The cache is deliberately narrow (VAR-08 only). It is keyed by the bundle key
and the member's SHA-256, bounded by entry count and by the serialized size of
its values, and it stores a private copy: ``get`` returns a copy so a caller can
never mutate what a later request reads. It is not a general cache of parsed
semantic indexes.

Size is the UTF-8 length of the value's JSON encoding. That is the catalog
payload's own size (the thing this cache retains); it is not a heap
measurement and does not count Python object overhead, which is why the byte
bound is one of two limits rather than the only one.
"""

from __future__ import annotations

import copy
import json
import threading
from collections import OrderedDict
from typing import Any, Hashable

#: Enough for a few revisions of a few projects on one process; small on purpose.
DEFAULT_MAX_ENTRIES = 32
DEFAULT_MAX_BYTES = 4 * 1024 * 1024


def _encoded_size(value: Any) -> int:
    return len(json.dumps(value, separators=(",", ":")).encode("utf-8"))


class CatalogResultCache:
    """A thread-safe LRU of immutable catalog results, bounded in entries and bytes."""

    def __init__(self, *, max_entries: int = DEFAULT_MAX_ENTRIES, max_bytes: int = DEFAULT_MAX_BYTES) -> None:
        self._max_entries = max_entries
        self._max_bytes = max_bytes
        #: key -> (private value, accounted bytes)
        self._entries: OrderedDict[Hashable, tuple[Any, int]] = OrderedDict()
        self._bytes = 0
        self._hits = 0
        self._misses = 0
        self._lock = threading.Lock()

    def get(self, key: Hashable) -> Any | None:
        """A private copy of the cached value, or ``None`` when absent."""

        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                self._misses += 1
                return None
            self._entries.move_to_end(key)
            self._hits += 1
            return copy.deepcopy(entry[0])

    def put(self, key: Hashable, value: Any) -> None:
        """Cache a private copy of ``value``, evicting oldest entries past either bound."""

        stored = copy.deepcopy(value)
        size = _encoded_size(stored)
        with self._lock:
            self._forget(key)
            if size > self._max_bytes:
                # One entry larger than the whole cache is not worth caching.
                return
            self._entries[key] = (stored, size)
            self._bytes += size
            while len(self._entries) > self._max_entries or self._bytes > self._max_bytes:
                _, (_, evicted_size) = self._entries.popitem(last=False)
                self._bytes -= evicted_size

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self._bytes = 0
            self._hits = 0
            self._misses = 0

    def stats(self) -> dict[str, int]:
        """Entries, accounted bytes, and hit/miss counters (for tests and operators)."""

        with self._lock:
            return {
                "entries": len(self._entries),
                "bytes": self._bytes,
                "maxEntries": self._max_entries,
                "maxBytes": self._max_bytes,
                "hits": self._hits,
                "misses": self._misses,
            }

    def _forget(self, key: Hashable) -> None:
        entry = self._entries.pop(key, None)
        if entry is not None:
            self._bytes -= entry[1]
