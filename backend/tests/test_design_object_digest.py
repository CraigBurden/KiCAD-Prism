import unittest

from app.services import design_object_digest as digest


def _by_id(entries):
    return {entry.source_id[:8]: entry for entry in entries}


SCHEMATIC = """
(kicad_sch
  (lib_symbols
    (symbol "Device:R"
      (pin "1" (uuid "cafecafe-0000-0000-0000-000000000000"))
    )
  )
  (symbol (lib_id "Device:R") (at 10 20 0)
    (uuid "11111111-1111-1111-1111-111111111111")
    (property "Reference" "R1")
    (pin "1" (uuid "22222222-2222-2222-2222-222222222222"))
  )
  (wire (pts (xy 0 0) (xy 10 0)) (uuid "33333333-3333-3333-3333-333333333333"))
  (junction (at 5 5) (diameter 0))
)
"""


class ObjectDigestTests(unittest.TestCase):
    def test_emits_one_entry_per_addressable_object(self) -> None:
        entries = _by_id(digest.digest_document(SCHEMATIC, "root.kicad_sch"))

        self.assertEqual(
            sorted(entries), ["11111111", "22222222", "33333333"]
        )
        self.assertEqual(entries["11111111"].kind, "symbol")
        self.assertEqual(entries["22222222"].parent_source_id[:8], "11111111")

    def test_skips_the_library_symbol_cache(self) -> None:
        """lib_symbols is a definition cache, not placed design content.

        Scanning into it would emit phantom objects that no schematic item
        ever resolves to -- and its pin UUIDs would collide conceptually with
        real instance pins.
        """
        entries = _by_id(digest.digest_document(SCHEMATIC, "root.kicad_sch"))

        self.assertNotIn("cafecafe", entries)

    def test_folds_anonymous_objects_into_their_parent(self) -> None:
        """A junction with no uuid is not independently addressable."""
        entries = digest.digest_document(SCHEMATIC, "root.kicad_sch")

        self.assertNotIn("junction", {entry.kind for entry in entries})

    def test_keeps_a_centroid_but_no_point_list(self) -> None:
        entries = _by_id(digest.digest_document(SCHEMATIC, "root.kicad_sch"))

        # `at` for a placed symbol, mean of the point list for a wire.
        self.assertEqual(entries["11111111"].centroid, (10.0, 20.0))
        self.assertEqual(entries["33333333"].centroid, (5.0, 0.0))
        self.assertNotIn("points", entries["33333333"].as_dict())

    def test_a_child_edit_does_not_cascade_into_the_parent(self) -> None:
        """The whole point of the shallow hash.

        A footprint whose hash covered its pads would report both the pad and
        the footprint for a single pad edit, and every group and zone above it
        too.
        """
        before = """
        (kicad_pcb
          (footprint "R_0402" (at 1 2)
            (uuid "aaaaaaaa-0000-0000-0000-000000000000")
            (pad "1" smd rect (at 0 0) (size 1 1)
              (uuid "bbbbbbbb-0000-0000-0000-000000000000"))
          )
        )
        """
        after = before.replace("(size 1 1)", "(size 2 2)")

        base = _by_id(digest.digest_document(before, "board.kicad_pcb"))
        head = _by_id(digest.digest_document(after, "board.kicad_pcb"))

        self.assertNotEqual(base["bbbbbbbb"].hash, head["bbbbbbbb"].hash)
        self.assertEqual(base["aaaaaaaa"].hash, head["aaaaaaaa"].hash)

    def test_a_parent_edit_does_not_disturb_its_children(self) -> None:
        before = """
        (kicad_pcb
          (footprint "R_0402" (at 1 2)
            (uuid "aaaaaaaa-0000-0000-0000-000000000000")
            (pad "1" smd rect (at 0 0) (size 1 1)
              (uuid "bbbbbbbb-0000-0000-0000-000000000000"))
          )
        )
        """
        after = before.replace("(at 1 2)", "(at 9 9)")

        base = _by_id(digest.digest_document(before, "board.kicad_pcb"))
        head = _by_id(digest.digest_document(after, "board.kicad_pcb"))

        self.assertNotEqual(base["aaaaaaaa"].hash, head["aaaaaaaa"].hash)
        self.assertEqual(base["bbbbbbbb"].hash, head["bbbbbbbb"].hash)
        self.assertEqual(head["aaaaaaaa"].centroid, (9.0, 9.0))

    def test_a_regenerated_zone_fill_is_not_an_authored_change(self) -> None:
        """KiCad recomputes fills on every board edit.

        Hashing them would report every zone as modified whenever anything on
        the board moved, which is worse than useless in a review tool.
        """
        before = """
        (kicad_pcb
          (zone (net 1) (layer "F.Cu") (uuid "cccccccc-0000-0000-0000-000000000000")
            (polygon (pts (xy 0 0) (xy 10 0) (xy 10 10)))
            (filled_polygon (layer "F.Cu") (pts (xy 0 0) (xy 5 0) (xy 5 5)))
          )
        )
        """
        refilled = before.replace("(xy 5 0) (xy 5 5)", "(xy 6 0) (xy 6 6)")
        reshaped = before.replace("(xy 10 10)", "(xy 11 11)")

        base = _by_id(digest.digest_document(before, "board.kicad_pcb"))
        fill = _by_id(digest.digest_document(refilled, "board.kicad_pcb"))
        shape = _by_id(digest.digest_document(reshaped, "board.kicad_pcb"))

        self.assertEqual(base["cccccccc"].hash, fill["cccccccc"].hash)
        self.assertNotEqual(base["cccccccc"].hash, shape["cccccccc"].hash)

    def test_reordering_objects_is_not_a_change(self) -> None:
        first = """
        (kicad_sch
          (wire (pts (xy 0 0) (xy 1 0)) (uuid "aaaaaaaa-0000-0000-0000-000000000000"))
          (wire (pts (xy 5 5) (xy 6 5)) (uuid "dddddddd-0000-0000-0000-000000000000"))
        )
        """
        second = """
        (kicad_sch
          (wire (pts (xy 5 5) (xy 6 5)) (uuid "dddddddd-0000-0000-0000-000000000000"))
          (wire (pts (xy 0 0) (xy 1 0)) (uuid "aaaaaaaa-0000-0000-0000-000000000000"))
        )
        """
        base = _by_id(digest.digest_document(first, "root.kicad_sch"))
        head = _by_id(digest.digest_document(second, "root.kicad_sch"))

        self.assertEqual(base["aaaaaaaa"].hash, head["aaaaaaaa"].hash)
        self.assertEqual(base["dddddddd"].hash, head["dddddddd"].hash)

    def test_point_order_is_still_significant(self) -> None:
        """Order is semantic in a polygon even though it is not in a file."""
        first = '(kicad_sch (polyline (pts (xy 0 0) (xy 1 1) (xy 2 0)) (uuid "eeeeeeee-0000-0000-0000-000000000000")))'
        second = '(kicad_sch (polyline (pts (xy 0 0) (xy 2 0) (xy 1 1)) (uuid "eeeeeeee-0000-0000-0000-000000000000")))'

        base = _by_id(digest.digest_document(first, "root.kicad_sch"))
        head = _by_id(digest.digest_document(second, "root.kicad_sch"))

        self.assertNotEqual(base["eeeeeeee"].hash, head["eeeeeeee"].hash)

    def test_whitespace_only_reformatting_is_not_a_change(self) -> None:
        first = '(kicad_sch (wire (pts (xy 0 0) (xy 1 0)) (uuid "aaaaaaaa-0000-0000-0000-000000000000")))'
        second = '(kicad_sch\n  (wire\n    (pts (xy 0 0)   (xy 1 0))\n    (uuid "aaaaaaaa-0000-0000-0000-000000000000")\n  )\n)'

        base = _by_id(digest.digest_document(first, "root.kicad_sch"))
        head = _by_id(digest.digest_document(second, "root.kicad_sch"))

        self.assertEqual(base["aaaaaaaa"].hash, head["aaaaaaaa"].hash)

    def test_diff_reports_add_remove_and_modify(self) -> None:
        base = {
            "a.kicad_sch#keep": digest.ObjectDigest("keep", "wire", "a.kicad_sch", "h1"),
            "a.kicad_sch#edit": digest.ObjectDigest("edit", "wire", "a.kicad_sch", "h2"),
            "a.kicad_sch#gone": digest.ObjectDigest("gone", "wire", "a.kicad_sch", "h3"),
        }
        head = {
            "a.kicad_sch#keep": digest.ObjectDigest("keep", "wire", "a.kicad_sch", "h1"),
            "a.kicad_sch#edit": digest.ObjectDigest("edit", "wire", "a.kicad_sch", "h2x"),
            "a.kicad_sch#new": digest.ObjectDigest("new", "wire", "a.kicad_sch", "h4"),
        }

        delta = digest.diff_digests(base, head)

        self.assertEqual(delta.counts, {"added": 1, "removed": 1, "modified": 1})
        self.assertEqual(delta.added[0].source_id, "new")
        self.assertEqual(delta.removed[0].source_id, "gone")
        self.assertEqual(delta.modified[0][1].source_id, "edit")

    def test_the_same_uuid_in_two_documents_is_two_objects(self) -> None:
        """A reused hierarchical sheet shares UUIDs across its instances.

        Keying on the UUID alone is what collapsed distinct components onto one
        change id in Phase 0B; the digest keys on document + UUID.
        """
        text = '(kicad_sch (wire (pts (xy 0 0) (xy 1 0)) (uuid "aaaaaaaa-0000-0000-0000-000000000000")))'
        entries = {}
        for path in ("a.kicad_sch", "b.kicad_sch"):
            for entry in digest.digest_document(text, path):
                entries[f"{entry.document_path}#{entry.source_id}"] = entry

        self.assertEqual(len(entries), 2)


if __name__ == "__main__":
    unittest.main()
