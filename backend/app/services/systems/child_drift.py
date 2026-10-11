"""Child drift: a subsystem's new catalog revision against the parent's links (CONTRACTS_P2 §7).

The P1 drift engine does the comparison unchanged. A revision's export
interface, presented as an interface artifact (``exports.as_interface``), is
the "candidate"; the parent's link ends on that assembly instance hold the
accepted export baselines and row nets. So the same rules apply at the
export boundary:

- an export that still resolves by ID, with the same connector facts and the
  same nets on every used pad, changes nothing (auto-advance);
- an export gone is ``connector_missing`` (bind a ranked candidate, or remove
  the rows); a re-created export with the same name, connector and nets is
  rebound silently;
- a changed connector is ``connector_changed``; pads are ``pin_missing`` or
  ``net_changed``.

Only exports the parent's links use are compared; internal child changes
never reach the parent. A review is kind ``child_update`` with the old and
new revision IDs in ``from_commit``/``to_commit``.
"""

from __future__ import annotations

import logging
from typing import Any, Mapping, Optional

from app.services.job_kinds import JobKind
from app.services.systems import drift, exports
from app.services.systems.detection import _item_row, _pending_changes, _silent_row


def apply_child_evaluation(
    store: Any, change: Any, instance: Mapping[str, Any], revision: Mapping[str, Any], *, auto_kind: str,
    candidate: Optional[Mapping[str, Any]] = None,
) -> tuple[str, Optional[str]]:
    """Evaluate ``revision`` for ``instance`` and apply §7.2 inside ``change``. Returns ``(outcome, review_id)``.

    ``candidate`` is the revision as an interface artifact: an assembly's exports by default, or a
    module's connectors (§5.6, SB2-51) given by the caller.
    """

    candidate = candidate or exports.as_interface(revision.get("interface")) or {"components": []}
    links = store.drift_links(instance["system_id"])  # harness ends drift like link ends (P2 §17.2)
    outcome = drift.evaluate(links, instance["id"], candidate)
    open_review = store.open_source_review(instance["id"])
    if open_review is not None:
        store.set_review_status(change, open_review["id"], "superseded",
                                audit_kind="review_superseded", payload={"supersededBy": revision["revisionId"]})
    if outcome.auto_advance:
        for (link_id, end), port in sorted(outcome.port_updates.items()):
            store.set_link_port(change, link_id, end, port)
        for silent in outcome.silent:
            change.audit(silent.kind, {"instanceId": instance["id"], **_silent_row(silent)})
        store.set_catalog_revision(change, instance["id"], revision["revisionId"], kind=auto_kind,
                                   payload={"version": revision.get("version"), "silentChanges": len(outcome.silent)})
        return "auto_advanced", None
    review = store.open_review(
        change, instance_id=instance["id"], kind="child_update",
        from_commit=instance["catalog_revision_id"], to_commit=revision["revisionId"],
        items=[_item_row(item) for item in outcome.items],
        pending_changes=_pending_changes(outcome, drift.basis(links, instance["id"])),
    )
    return "review_opened", review["id"]


# ---------------------------------------------------------------------------
# The release trigger (§7.1): a released revision advances every parent following it.

CHILD_CHECK_JOB_KIND = "system_child_check"
CHILD_ACTOR = "system:detection"


def followers(connect: Any, component_id: str) -> list[tuple[str, str]]:
    """``(system_id, instance_id)`` of every instance following ``component_id``'s released revisions."""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT i.system_id, i.id FROM system_instances i
            JOIN system_projects s ON s.id = i.system_id
            WHERE i.catalog_component_id = %s AND i.follow = 'latest_released'
              AND s.archived_at IS NULL  -- D-P2-31: an archived system takes no changes
            ORDER BY i.system_id, i.id
            """,
            (component_id,),
        ).fetchall()
    return [(row["system_id"], row["id"]) for row in rows]


def enqueue_child_check(component_id: str, revision_id: str, *, requested_by: str = CHILD_ACTOR) -> Optional[dict]:
    """Queue one check per released revision, only when some parent follows the component."""
    from app.services.systems.jobs import workspace_connection

    if not followers(workspace_connection, component_id):
        return None
    return CHILD_CHECK.enqueue({"componentId": component_id, "revisionId": revision_id},
                               artifact_key=f"system-child-check:{revision_id}", requested_by=requested_by)


def run_child_check_job(context: Any) -> Any:
    from app.services.job_runtime import JobResult
    from app.services.systems import service as system_service
    from app.services.systems.jobs import workspace_connection

    component_id = str(context.payload["componentId"])
    revision_id = str(context.payload["revisionId"])
    context.progress(stage="system-child-check", message="Checking parent systems", percent=10, force=True)
    counts: dict[str, int] = {}
    for system_id, instance_id in followers(workspace_connection, component_id):
        try:
            outcome = system_service.service.advance_child(
                CHILD_ACTOR, system_id, instance_id, revision_id, auto_kind="child_auto_advanced",
            )["outcome"]
        except Exception:  # one parent's failure must not stop the others
            logging.getLogger(__name__).exception("Child check failed for %s/%s", system_id, instance_id)
            outcome = "check_failed"
        counts[outcome] = counts.get(outcome, 0) + 1
    return JobResult(message=f"Checked {sum(counts.values())} parent instance(s)", details={"outcomes": counts})


CHILD_CHECK = JobKind(CHILD_CHECK_JOB_KIND, run_child_check_job)
JOB_KINDS = (CHILD_CHECK,)
