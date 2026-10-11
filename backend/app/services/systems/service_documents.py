"""The system document and its validation report (§8.1, CONTRACTS_P2 §8.4), and finding waivers (SB2-100)."""

from __future__ import annotations

from typing import Sequence

from app.services.systems import validation
from app.services.systems.jobs import artifact_key
from app.services.systems.service_base import Caller, Result
from app.services.systems.store import Invalid, NotFound, StaleVersion

MAX_BATCH_WAIVERS = 1000  # SB2-113: one group waive; the C&DH stack's largest group is 401


class DocumentsMixin:
    def document(self, caller: Caller, system_id: str, *, include_validation: bool = False) -> Result:
        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            built = self._build(loaded)
            restricted = loaded.restricted(caller)
            board_total = self._loaded_board_total(loaded)  # SB2-101
            dropped = ("reviewRowIds",) if include_validation else ("validation", "reviewRowIds")
            body = {k: v for k, v in built.items() if k not in dropped}
            body["system"] = {**body["system"], "boardTotal": board_total}
            body = self._for_reader(loaded, caller, body)
        ready = {i["id"] for i in built["instances"] if i["interface"]["status"] == "ready"}
        for instance in loaded.boards:
            key = artifact_key(instance["project_id"], instance["baseline_commit"])
            if (instance["id"] not in ready and instance["id"] not in restricted
                    and key not in loaded.job_state and instance["resolution"] == "resolved"):
                self._enqueue_quietly(instance["project_id"], instance["baseline_commit"], caller)
        return Result(body, system_id, loaded.version)

    def validation_report(self, caller: Caller, system_id: str) -> Result:
        """``GET …/validation`` (§7.2), redacted for restricted boards (§8.2)."""

        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            report = self._report_for_reader(loaded, caller, self._build(loaded)["validation"])
        return Result(report, system_id, loaded.version)

    def _reader_report(self, caller: Caller, system_id: str, version: int) -> dict:
        """The reader's report at ``version`` from one consistent read without the lock (SB2-94)."""
        with self._tx(consistent=True) as store:
            loaded = self._load(store, system_id, caller)
            if int(loaded.version) != int(version):
                raise StaleVersion(int(loaded.version), system_id)
            return self._report_for_reader(loaded, caller, self._build(loaded)["validation"])

    # ------------------------------------------------------------------
    # Finding waivers (SB2-100, SB2-113)

    def waive_finding(self, caller: Caller, system_id: str, version: int, finding_key: str, note: str) -> Result:
        """SB2-100 (D-P2-56): waive one warning or info finding with a note. The finding is found and
        checked from a consistent read without the lock; the lock only stores the waiver (SB2-94)."""
        report = self._reader_report(caller, system_id, version)
        finding = next((f for f in report["findings"] if f["key"] == finding_key and not f.get("redacted")), None)
        if finding is None:
            raise NotFound("Finding not found")
        if finding["severity"] not in validation.WAIVABLE_SEVERITIES:
            raise Invalid("finding_not_waivable: errors are fixed or reviewed, never waived")
        with self._tx() as store:
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                row = store.add_waiver(change, finding_key=finding_key, rule=finding["rule"], note=note,
                                       created_by=caller.actor)
        return Result({**validation.waiver_doc(row), "findingKey": row["finding_key"], "rule": row["rule"],
                       "active": True}, system_id, change.version)

    def waive_findings(self, caller: Caller, system_id: str, version: int, finding_keys: Sequence[str],
                       note: str) -> Result:
        """SB2-113: waive several warnings or info findings with one note, in one version. Keys already
        waived are skipped; an unknown, hidden or error finding refuses the whole batch."""
        keys = list(dict.fromkeys(finding_keys))
        if not keys or len(keys) > MAX_BATCH_WAIVERS:
            raise Invalid(f"waive 1 to {MAX_BATCH_WAIVERS} findings at once")
        report = self._reader_report(caller, system_id, version)
        by_key = {f["key"]: f for f in report["findings"] if not f.get("redacted")}
        missing = [key for key in keys if key not in by_key]
        if missing:
            raise NotFound(f"{len(missing)} of the findings were not found")
        if any(by_key[key]["severity"] not in validation.WAIVABLE_SEVERITIES for key in keys):
            raise Invalid("finding_not_waivable: errors are fixed or reviewed, never waived")
        todo = [key for key in keys if not by_key[key].get("waived")]
        rows: list[dict] = []
        with self._tx() as store:
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                for key in todo:
                    rows.append(store.add_waiver(change, finding_key=key, rule=by_key[key]["rule"], note=note,
                                                 created_by=caller.actor))
        return Result({"waived": [{**validation.waiver_doc(row), "findingKey": row["finding_key"], "rule": row["rule"],
                                   "active": True} for row in rows],
                       "skipped": len(keys) - len(todo)}, system_id, change.version)

    def unwaive_finding(self, caller: Caller, system_id: str, version: int, waiver_id: str) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                store.delete_waiver(change, waiver_id)
        return Result(None, system_id, change.version)
