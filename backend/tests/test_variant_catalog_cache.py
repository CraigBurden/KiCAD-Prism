"""The bounded catalog-result cache (VAR-08).

It keeps shaped catalogs, not parsed members: keyed by the bundle key and the
member's SHA-256, limited by entry count and serialized bytes, and returning a
private copy so one request can never mutate another's answer.
"""

from __future__ import annotations

import unittest

from app.services.variant_catalog_cache import CatalogResultCache


def body(*names: str) -> dict:
    return {"variants": [{"name": name} for name in names], "diagnostics": []}


class CatalogResultCacheTests(unittest.TestCase):
    def test_a_cached_value_is_returned_as_a_private_copy(self) -> None:
        cache = CatalogResultCache()
        original = body("A")
        cache.put("k", original)
        original["variants"].append({"name": "mutated"})
        first = cache.get("k")
        first["variants"].append({"name": "also mutated"})
        self.assertEqual([entry["name"] for entry in cache.get("k")["variants"]], ["A"])

    def test_the_oldest_entry_is_evicted_past_the_entry_limit(self) -> None:
        cache = CatalogResultCache(max_entries=2)
        for key in ("a", "b", "c"):
            cache.put(key, body(key))
        self.assertIsNone(cache.get("a"))
        self.assertEqual(cache.get("b")["variants"][0]["name"], "b")
        self.assertEqual(cache.get("c")["variants"][0]["name"], "c")
        self.assertEqual(cache.stats()["entries"], 2)

    def test_reading_an_entry_keeps_it_recent(self) -> None:
        cache = CatalogResultCache(max_entries=2)
        cache.put("a", body("a"))
        cache.put("b", body("b"))
        cache.get("a")
        cache.put("c", body("c"))
        self.assertIsNotNone(cache.get("a"))
        self.assertIsNone(cache.get("b"))

    def test_entries_are_evicted_past_the_byte_limit(self) -> None:
        cache = CatalogResultCache(max_bytes=80)
        cache.put("a", body("a"))
        cache.put("b", body("b"))
        self.assertLessEqual(cache.stats()["bytes"], 80)
        self.assertLessEqual(cache.stats()["entries"], 1)

    def test_an_entry_larger_than_the_whole_cache_is_not_stored(self) -> None:
        cache = CatalogResultCache(max_bytes=10)
        cache.put("a", body("too big"))
        self.assertIsNone(cache.get("a"))
        self.assertEqual(cache.stats()["entries"], 0)

    def test_replacing_a_key_does_not_double_count_its_bytes(self) -> None:
        cache = CatalogResultCache()
        cache.put("k", body("a"))
        first = cache.stats()["bytes"]
        cache.put("k", body("a"))
        self.assertEqual(cache.stats()["bytes"], first)
        self.assertEqual(cache.stats()["entries"], 1)

    def test_misses_are_not_cached(self) -> None:
        cache = CatalogResultCache()
        self.assertIsNone(cache.get("missing"))
        self.assertEqual(cache.stats()["misses"], 1)
        self.assertEqual(cache.stats()["entries"], 0)

    def test_clear_forgets_everything(self) -> None:
        cache = CatalogResultCache()
        cache.put("k", body("a"))
        cache.clear()
        self.assertEqual(cache.stats(), {
            "entries": 0,
            "bytes": 0,
            "maxEntries": 32,
            "maxBytes": 4 * 1024 * 1024,
            "hits": 0,
            "misses": 0,
        })


if __name__ == "__main__":
    unittest.main()
