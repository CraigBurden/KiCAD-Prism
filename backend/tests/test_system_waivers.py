"""SB2-100 (D-P2-56): waiving warning and info findings with a note, versioned like links."""

from __future__ import annotations

import json
import unittest

from test_system_snapshots import DESIGNER, VIEWER, SnapshotCase

from app.services.systems import interface_cache, manifest as manifest_io
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.store import Conflict, Invalid, NotFound, StaleVersion
from support.postgres import seed_folder


class WaiverTest(SnapshotCase):
    def setUp(self) -> None:
        super().setUp()
        # The fixture is clean at F0. A second link reusing a pin of the first raises SYS-V02 warnings.
        link = next(link for link in self.service.document(DESIGNER, self.sid).body["links"] if link["rows"])
        ends = {side: {"instanceId": link[side]["instanceId"], "portKey": link[side]["port"]["portKey"]} for side in "ab"}
        second = self.service.create_link(DESIGNER, self.sid, self.version(), a=ends["a"], b=ends["b"],
                                          name="Fan-out", harness=None).body
        row = link["rows"][0]
        self.service.replace_rows(DESIGNER, self.sid, self.version(), second["id"],
                                  [{"pinA": row["pinA"], "pinB": row["pinB"], "signal": "dup"}])

    def raise_an_error(self) -> None:
        """SYS-V04: a linked pad vanishes from its board's interface."""
        link = next(link for link in self.service.document(DESIGNER, self.sid).body["links"] if link["rows"])
        row, end = link["rows"][0], link["b"]
        instance = self.store.get_instance(self.sid, end["instanceId"])
        artifact = self.store.get_interface(instance["project_id"], instance["baseline_commit"], EXTRACTOR_VERSION)
        components = [{**c, "pins": [p for p in c["pins"] if p["pad"] != row["pinB"]]}
                      if c["portKey"] == end["port"]["portKey"] else c for c in artifact["components"]]
        interface_cache.interfaces.clear()  # a direct artifact write bypasses the SB2-93 cache
        self.conn.execute("UPDATE system_interface_artifacts SET payload = %s WHERE project_id = %s AND commit = %s",
                          (json.dumps({**artifact, "components": components}), instance["project_id"],
                           instance["baseline_commit"]))
        self.conn.commit()

    def report(self, caller=DESIGNER) -> dict:
        return self.service.validation_report(caller, self.sid).body

    def first(self, severity: str) -> dict:
        found = [f for f in self.report()["findings"] if f["severity"] == severity and not f["waived"]]
        if not found:
            self.skipTest(f"the fixture raises no {severity}")
        return found[0]

    def waive(self, finding: dict, note: str = "Accepted: intentional") -> dict:
        return self.service.waive_finding(DESIGNER, self.sid, self.version(), finding["key"], note).body

    def test_a_waived_warning_stays_listed_but_leaves_the_counts(self) -> None:
        before = self.report()
        warning = self.first("warning")
        version = self.version()
        waiver = self.waive(warning)
        self.assertGreater(self.version(), version, "waiving is a versioned edit")
        after = self.report()
        [listed] = [f for f in after["findings"] if f["key"] == warning["key"]]
        self.assertEqual((listed["waived"]["note"], listed["waived"]["by"]), ("Accepted: intentional", DESIGNER.actor))
        self.assertEqual(after["counts"]["warning"], before["counts"]["warning"] - 1)
        self.assertEqual(after["counts"]["waived"], 1)
        self.assertEqual([w["id"] for w in after["waivers"] if w["active"]], [waiver["id"]])
        document = self.service.document(DESIGNER, self.sid).body
        self.assertEqual(document["findingCounts"]["warning"], after["counts"]["warning"])
        kinds = [r["kind"] for r in self.conn.execute(
            "SELECT kind FROM system_audit_events WHERE system_id = %s ORDER BY seq", (self.sid,)).fetchall()]
        self.assertIn("finding_waived", kinds)

    def test_errors_are_never_waived(self) -> None:
        self.raise_an_error()
        error = self.first("error")
        with self.assertRaisesRegex(Invalid, "finding_not_waivable"):
            self.waive(error)

    def test_a_note_is_required_and_a_finding_is_waived_once(self) -> None:
        warning = self.first("warning")
        with self.assertRaisesRegex(Invalid, "note"):
            self.waive(warning, note="   ")
        self.waive(warning)
        with self.assertRaisesRegex((Conflict, NotFound), "waived|not found"):
            self.waive(warning)

    def test_unknown_findings_and_stale_versions_are_refused(self) -> None:
        with self.assertRaises(NotFound):
            self.service.waive_finding(DESIGNER, self.sid, self.version(), "SYS-V99|nothing", "x")
        warning = self.first("warning")
        with self.assertRaises(StaleVersion):
            self.service.waive_finding(DESIGNER, self.sid, self.version() - 1, warning["key"], "x")

    def test_a_group_is_waived_with_one_note_in_one_version(self) -> None:
        """SB2-113: a batch skips findings already waived; an error or unknown key refuses it whole."""
        warnings = [f for f in self.report()["findings"] if f["severity"] == "warning" and not f["waived"]]
        if len(warnings) < 2:
            self.skipTest("the fixture raises fewer than two warnings")
        self.waive(warnings[0])
        version = self.version()
        body = self.service.waive_findings(DESIGNER, self.sid, version, [f["key"] for f in warnings], "Known fan-out").body
        self.assertEqual((len(body["waived"]), body["skipped"]), (len(warnings) - 1, 1))
        self.assertEqual(self.version(), version + 1, "one version for the whole group")
        self.assertEqual(self.report()["counts"]["warning"], 0)
        with self.assertRaises(NotFound):
            self.service.waive_findings(DESIGNER, self.sid, self.version(), ["SYS-V99|nothing"], "x")
        self.raise_an_error()
        with self.assertRaisesRegex(Invalid, "finding_not_waivable"):
            self.service.waive_findings(DESIGNER, self.sid, self.version(), [self.first("error")["key"]], "x")

    def test_unwaiving_brings_the_finding_back_into_the_counts(self) -> None:
        before = self.report()["counts"]
        waiver = self.waive(self.first("warning"))
        self.service.unwaive_finding(DESIGNER, self.sid, self.version(), waiver["id"])
        self.assertEqual(self.report()["counts"]["warning"], before["warning"])
        self.assertEqual(self.report()["waivers"], [])

    def test_waivers_travel_in_the_manifest_and_the_frozen_icd(self) -> None:
        warning = self.first("warning")
        waiver = self.waive(warning)
        with self.connect() as conn:
            from app.services.systems.store import SystemStore
            store = SystemStore(conn)
            manifest = manifest_io.build(store, self.sid, created_by="t", created_at=None, snapshot=None, catalog_refs=[])
        [entry] = manifest.waivers
        self.assertEqual((entry.id, entry.findingKey, entry.note), (waiver["id"], warning["key"], "Accepted: intentional"))
        snapshot = self.snapshot("CDR")
        frozen = self.service.get_snapshot(DESIGNER, self.sid, snapshot["id"])["document"]
        self.assertEqual(frozen["validation"]["counts"]["waived"], 1)
        html, _name, _version = self.service.icd(DESIGNER, self.sid, "html", snapshot_id=snapshot["id"])
        self.assertIn("Waived findings", html)
        self.assertIn("Accepted: intentional", html)

    def test_a_waiver_whose_finding_is_gone_is_marked_inactive(self) -> None:
        waiver = self.waive(self.first("warning"))
        self.conn.execute("UPDATE system_finding_waivers SET finding_key = 'SYS-V09|gone' WHERE id = %s", (waiver["id"],))
        self.conn.commit()
        [listed] = self.report()["waivers"]
        self.assertFalse(listed["active"])

    def test_a_reader_who_cannot_see_the_board_sees_neither_note_nor_key(self) -> None:
        warning = self.first("warning")
        if not warning["instanceId"]:
            self.skipTest("the fixture's first warning names no board")
        self.waive(warning)
        project = self.store.get_instance(self.sid, warning["instanceId"])["project_id"]
        seed_folder(self.conn, "fld_admins", visibility_mode="roles", allowed_roles=["admin"], on_conflict_skip=True)
        self.conn.execute("UPDATE ws_projects SET folder_id = 'fld_admins' WHERE id = %s", (project,))
        self.conn.commit()
        report = self.report(VIEWER)
        [waiver] = report["waivers"]
        self.assertEqual((waiver["findingKey"], waiver["note"], waiver["redacted"]), (None, None, True))
        self.assertTrue(all(f["key"] is None for f in report["findings"] if f["redacted"]))


if __name__ == "__main__":
    unittest.main()
