"""Source-change detection (``docs/system-builder/CONTRACTS.md`` §10.1, §6.2, §6.5).

After a project sync fetches a repository, ``enqueue_source_check`` queues one
``system_source_check`` job for it, but only when some tracked instance uses a
project in that repository. The job runs ``check_instance`` for each of them:

1. resolve ``origin/<tracked_ref>`` to the tip (``ref_missing`` when absent);
2. stop when the tip is the baseline or was already checked;
3. a pinned instance records ``update_available`` and stops;
4. an unreadable baseline makes the instance unresolved and opens a
   ``baseline_unreachable`` review (default O3);
5. otherwise evaluate the drift engine against the tip's interface and
   auto-advance or open a ``source_update`` review, superseding an older one.

Re-running a check for the same tip changes nothing.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable, ContextManager, Mapping, Optional

from app.services.job_kinds import JobKind, JobSubject, repository_lock
from app.services.systems import drift, exports, renames, sources
from app.services.systems.jobs import extract_and_store, workspace_connection
from app.services.systems.store import SystemStore

logger = logging.getLogger(__name__)

SOURCE_CHECK_JOB_KIND = "system_source_check"
DETECTION_ACTOR = "system:detection"


@dataclass(frozen=True)
class CheckResult:
    instance_id: str
    outcome: str  # ref_missing | at_baseline | already_checked | update_available |
    #               baseline_unreachable | auto_advanced | review_opened | review_current |
    #               extraction_failed | project_missing
    tip: Optional[str] = None
    review_id: Optional[str] = None


class _Unchanged(Exception):
    """Raised inside a mutation to leave without writing or bumping the version."""

    def __init__(self, outcome: str, review_id: Optional[str] = None) -> None:
        super().__init__(outcome)
        self.outcome = outcome
        self.review_id = review_id


def _default_project_loader(project_id: str) -> Any:
    # Detection acts for the system, not for a user: no role applies here.
    from app.services.project_service import _workspace_row_to_project
    from app.services.workspace_service import workspace

    row = workspace.get_project_by_id(project_id)
    return _workspace_row_to_project(row) if row else None


def _item_row(item: drift.Item) -> dict:
    return {
        "kind": item.kind, "linkId": item.link_id, "end": item.end, "rowIds": list(item.row_ids),
        "expected": item.expected, "observed": item.observed,
        "candidates": None if item.candidates is None else list(item.candidates),
    }


def _silent_row(silent: drift.Silent) -> dict:
    return {"kind": silent.kind, "linkId": silent.link_id, "end": silent.end, "via": silent.via,
            "before": dict(silent.before), "after": dict(silent.after)}


def _pending_changes(outcome: drift.Outcome, basis: str) -> dict:
    return {
        "basis": basis,
        "portUpdates": [
            {"linkId": link_id, "end": end, "port": port}
            for (link_id, end), port in sorted(outcome.port_updates.items())
        ],
        "silent": [_silent_row(s) for s in outcome.silent],
    }


def apply_evaluation(
    store: SystemStore, change: Any, instance: Mapping[str, Any], tip: str,
    candidate: Mapping[str, Any], *, auto_kind: str,
) -> tuple[str, Optional[str]]:
    """Evaluate ``tip`` against the stored baselines and apply §6.2 inside ``change``.

    Shared by detection (``baseline_auto_advanced``) and rebase
    (``baseline_rebased``). An open ``source_update`` review is superseded
    (§6.5) and an open ``baseline_unreachable`` review is closed, since a new
    evaluation replaces both. Returns ``(outcome, review_id)``.
    """

    links = store.drift_links(instance["system_id"])  # harness ends drift like link ends (P2 §17.2)
    outcome = drift.evaluate(links, instance["id"], candidate)
    open_review = store.open_source_review(instance["id"])
    if open_review is not None:
        if open_review["kind"] == "baseline_unreachable":
            store.set_review_status(change, open_review["id"], "closed")
        else:
            # Decisions taken on the older candidate are discarded.
            store.set_review_status(change, open_review["id"], "superseded",
                                    audit_kind="review_superseded", payload={"supersededBy": tip})
    # P2 §23.3: net changes that are proposed renames arriving need no review.
    proposals = store.renames_on([instance["id"]])
    arrived = [renames.match(item, proposals) for item in outcome.items]
    if outcome.auto_advance or all(arrived):
        for (link_id, end), port in sorted(outcome.port_updates.items()):
            store.set_link_port(change, link_id, end, port)
        for silent in outcome.silent:
            change.audit(silent.kind, {"instanceId": instance["id"], **_silent_row(silent)})
        for item in outcome.items:
            for row_id in item.row_ids:
                store.update_row_end(change, item.link_id, row_id, item.end, nets=item.observed)
        exports.refresh_after_advance(store, change, instance["id"], candidate)
        payload = {"silentChanges": len(outcome.silent)}
        if outcome.items:
            payload["renamedRows"] = sum(len(item.row_ids) for item in outcome.items)
        store.set_baseline(change, instance["id"], tip, kind=auto_kind, payload=payload)
        store.close_applied_renames(change, instance["id"], tip)
        return "auto_advanced", None
    review = store.open_review(
        change, instance_id=instance["id"], kind="source_update",
        from_commit=instance["baseline_commit"], to_commit=tip,
        items=[_item_row(item) for item in outcome.items],
        pending_changes=_pending_changes(outcome, drift.basis(links, instance["id"])),
    )
    return "review_opened", review["id"]


class Detector:
    def __init__(
        self,
        *,
        connect: Callable[[], ContextManager[Any]] = workspace_connection,
        project_loader: Callable[[str], Any] = _default_project_loader,
        extract: Callable[[Any, str], Mapping[str, Any]] | None = None,
    ) -> None:
        self._connect = connect
        self._load_project = project_loader
        self._extract = extract or (lambda project, commit: extract_and_store(project, commit, connect))

    # ------------------------------------------------------------------
    # Which instances a fetch concerns

    def tracked_instances_for_repository(self, repository_id: str) -> list[str]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT i.id FROM system_instances i
                JOIN ws_projects p ON p.id = i.project_id
                JOIN system_projects s ON s.id = i.system_id
                WHERE p.repo_id = %s AND i.tracked_ref IS NOT NULL
                  AND s.archived_at IS NULL  -- D-P2-31: an archived system takes no changes
                ORDER BY i.system_id, i.id
                """,
                (repository_id,),
            ).fetchall()
        return [row["id"] for row in rows]

    # ------------------------------------------------------------------
    # One instance

    def _record(self, instance_id: str, tip: Optional[str], checked: Optional[str], outcome: str,
                review_id: Optional[str] = None, *, retry: bool = False) -> CheckResult:
        with self._connect() as conn:
            SystemStore(conn).record_source_check(
                instance_id, tip_commit=tip, checked_commit=checked, outcome=outcome, retry=retry
            )
            conn.commit()
        return CheckResult(instance_id, outcome, tip, review_id)

    def check_instance(self, instance_id: str, *, force: bool = False) -> CheckResult:
        """§10.1 for one instance. ``force`` re-checks a tip already seen ("Check now")."""

        with self._connect() as conn:
            store = SystemStore(conn)
            row = conn.execute("SELECT * FROM system_instances WHERE id = %s", (instance_id,)).fetchone()
            instance = dict(row) if row else None
            previous = store.get_source_check(instance_id) if instance else None
            open_review = store.open_source_review(instance_id) if instance else None
        if instance is None:
            return CheckResult(instance_id, "instance_missing")
        if not instance["tracked_ref"]:
            return CheckResult(instance_id, "untracked")

        project = self._load_project(instance["project_id"])
        if project is None:
            return self._record(instance_id, None, None, "project_missing")
        try:
            tip = sources.resolve_tracked_ref(project, instance["tracked_ref"])
        except sources.SourceError:
            return self._record(instance_id, None, None, "source_unavailable")
        if tip is None:
            return self._record(instance_id, None, None, "ref_missing")
        if tip == instance["baseline_commit"]:
            return self._record(instance_id, tip, tip, "at_baseline")
        if not force and previous and previous["last_checked_commit"] == tip:
            return CheckResult(instance_id, "already_checked", tip)
        if instance["pinned"]:
            return self._record(instance_id, tip, tip, "update_available")
        if open_review and open_review["kind"] == "baseline_unreachable":
            # O3: only a rebase or removal closes it; do not evaluate around it.
            return self._record(instance_id, tip, tip, "baseline_unreachable", open_review["id"])
        if open_review and open_review["to_commit"] == tip:
            return self._record(instance_id, tip, tip, "review_current", open_review["id"])

        try:
            readable = sources.resolve_commit(project, instance["baseline_commit"]) == instance["baseline_commit"]
        except sources.SourceError:
            readable = False
        if not readable:
            return self._baseline_unreachable(instance, tip)

        try:
            candidate = self._extract(project, tip)
        except Exception:
            logger.exception("Interface extraction failed for %s@%s", instance["project_id"], tip)
            # The tip stays unchecked so the next fetch retries it.
            return self._record(instance_id, tip, None, "extraction_failed", retry=True)
        try:
            return self._apply(instance, tip, candidate)
        except drift.DriftInconsistency:
            # Nothing was applied; the tip stays unchecked so a fixed engine retries it.
            logger.exception("Drift engine inconsistency for instance %s", instance_id)
            return self._record(instance_id, tip, None, "engine_error", retry=True)

    def _baseline_unreachable(self, instance: dict, tip: str) -> CheckResult:
        with self._connect() as conn:
            store = SystemStore(conn)
            with store.mutation(instance["system_id"], expected_version=None, actor=DETECTION_ACTOR) as change:
                open_review = store.open_source_review(instance["id"])
                if open_review is not None:
                    store.set_review_status(change, open_review["id"], "superseded",
                                            audit_kind="review_superseded", payload={"supersededBy": None})
                store.set_resolution(change, instance["id"], "unresolved")
                review = store.open_review(
                    change, instance_id=instance["id"], kind="baseline_unreachable",
                    from_commit=instance["baseline_commit"], to_commit=None,
                )
            conn.commit()
        return self._record(instance["id"], tip, tip, "baseline_unreachable", review["id"])

    def _apply(self, instance: dict, tip: str, candidate: Mapping[str, Any]) -> CheckResult:
        try:
            return self._apply_locked(instance, tip, candidate)
        except _Unchanged as unchanged:
            return self._record(instance["id"], tip, tip, unchanged.outcome, unchanged.review_id)

    def _apply_locked(self, instance: dict, tip: str, candidate: Mapping[str, Any]) -> CheckResult:
        with self._connect() as conn:
            store = SystemStore(conn)
            with store.mutation(instance["system_id"], expected_version=None, actor=DETECTION_ACTOR) as change:
                # Under the system lock, so rows and baselines cannot move meanwhile.
                # A concurrent check of the same tip may have finished first.
                current = store.get_instance(instance["system_id"], instance["id"])
                open_review = store.open_source_review(instance["id"])
                if current["baseline_commit"] == tip:
                    raise _Unchanged("at_baseline")
                if current["pinned"]:
                    raise _Unchanged("update_available")
                if open_review is not None and (
                    open_review["kind"] == "baseline_unreachable" or open_review["to_commit"] == tip
                ):
                    outcome_name = ("baseline_unreachable" if open_review["kind"] == "baseline_unreachable"
                                    else "review_current")
                    raise _Unchanged(outcome_name, open_review["id"])
                result, review_id = apply_evaluation(
                    store, change, current, tip, candidate, auto_kind="baseline_auto_advanced"
                )
            conn.commit()
        return self._record(instance["id"], tip, tip, result, review_id)

    # ------------------------------------------------------------------
    # A fetched repository

    def check_repository(self, repository_id: str) -> list[CheckResult]:
        results = []
        for instance_id in self.tracked_instances_for_repository(repository_id):
            try:
                results.append(self.check_instance(instance_id))
            except Exception:
                logger.exception("Source check failed for instance %s", instance_id)
                results.append(CheckResult(instance_id, "check_failed"))
        return results


detector = Detector()


def _enqueue(payload: dict, *, artifact: str, repository_id: Optional[str], project_id: Optional[str],
             requested_by: str) -> dict:
    return SOURCE_CHECK.enqueue(payload, subject=JobSubject(project_id=project_id, repository_id=repository_id),
                                artifact_key=artifact, requested_by=requested_by)


def enqueue_source_check(repository_id: str, *, requested_by: str = DETECTION_ACTOR) -> Optional[dict]:
    """§10.1: one job per fetched repository, only when a tracked instance uses it."""

    if not repository_id or not detector.tracked_instances_for_repository(repository_id):
        return None
    return _enqueue({"repository_id": repository_id}, artifact=f"system-source-check:{repository_id}",
                    repository_id=repository_id, project_id=None, requested_by=requested_by)


def project_synced(project_id: str) -> None:
    """After a project sync: a fetch may have moved a branch some system tracks.

    Best effort: a queue problem never fails the sync.
    """
    from app.services.workspace_service import workspace

    try:
        enqueue_source_check(str((workspace.get_project_by_id(project_id) or {}).get("repo_id") or ""))
    except Exception:  # noqa: BLE001 - best effort; the next sync or a manual check catches up
        logger.exception("Could not queue system source check for %s", project_id)


def enqueue_instance_check(instance_id: str, project_id: str, *, requested_by: str) -> dict:
    """``POST …/check``: re-check one instance even if its tip was seen."""

    from app.services.workspace_service import workspace

    row = workspace.get_project_by_id(project_id) or {}
    return _enqueue({"instance_id": instance_id, "force": True},
                    artifact=f"system-source-check:instance:{instance_id}",
                    repository_id=str(row.get("repo_id") or "") or None, project_id=project_id,
                    requested_by=requested_by)


def run_source_check_job(context: Any) -> Any:
    from app.services.job_runtime import JobResult

    payload = context.payload
    context.progress(stage="system-source-check", message="Checking system boards", percent=10, force=True)
    if payload.get("instance_id"):
        results = [detector.check_instance(str(payload["instance_id"]), force=bool(payload.get("force")))]
    else:
        results = detector.check_repository(str(payload["repository_id"]))
    from app.services.systems.service import service as system_service

    # D12: the checks commit outside the system service; refresh the counts of the systems they changed.
    system_service.refresh_stale_counts(instance_ids=[result.instance_id for result in results])
    counts: dict[str, int] = {}
    for result in results:
        counts[result.outcome] = counts.get(result.outcome, 0) + 1
    return JobResult(message=f"Checked {len(results)} system board(s)", details={"outcomes": counts})


SOURCE_CHECK = JobKind(
    SOURCE_CHECK_JOB_KIND,
    run_source_check_job,
    resources={"prism_worker": 1, "semantic_compile": 1},
    lock=repository_lock("read"),
)
JOB_KINDS = (SOURCE_CHECK,)
