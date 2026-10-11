"""Reviews (§7): decide, keep pinned and rebase; and CSV imports through review (§9.3)."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from app.services.systems import child_drift, csv_import, reconcile, sources
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.service_base import Caller, Result
from app.services.systems.store import Conflict, Invalid, NotFound, SystemStore


class ReviewsMixin:
    # ------------------------------------------------------------------
    # Reviews

    def list_reviews(self, caller: Caller, system_id: str, status: Optional[str]) -> list[dict]:
        with self._tx() as store:
            self._system(store, system_id, caller)
            restricted = self._restricted_instances(store, system_id, caller)
            return [self._review_doc(store, review, review["instance_id"] in restricted, restricted)
                    for review in store.list_reviews(system_id, status=status)]

    def _open_review_instance(self, store: SystemStore, system_id: str, review_id: str, caller: Caller) -> None:
        try:
            review = store.get_review(system_id, review_id)
        except NotFound:
            raise NotFound("Review not found") from None
        if review["instance_id"]:
            try:
                self._open_instance(store, system_id, review["instance_id"], caller)
            except NotFound:
                raise NotFound("Review not found") from None

    def _require_visible_import_item(
        self, store: SystemStore, system_id: str, review_id: str, item_id: str, caller: Caller
    ) -> None:
        """An import item proposing a row on a restricted board is 404 to its caller (§8.2)."""

        review = store.get_review(system_id, review_id)
        if review["kind"] != "import":
            return
        item = next((i for i in review["items"] if i["id"] == item_id), None)
        touched = {((item["observed"] or {}).get(side) or {}).get("instanceId") for side in ("from", "to")} if item else set()
        if touched & self._restricted_instances(store, system_id, caller):
            raise NotFound("Review item not found")

    def decide(
        self, caller: Caller, system_id: str, version: int, review_id: str, item_id: str,
        decision: str, payload: Optional[Mapping[str, Any]],
    ) -> Result:
        try:
            return self._decide(caller, system_id, version, review_id, item_id, decision, payload)
        except reconcile.StaleReview as stale:
            self._reevaluate(caller, stale.review)
            raise Conflict(
                "review_stale: links or rows on this board changed while the review was open, "
                "so it has been evaluated again; review the new items"
            ) from None

    def _reevaluate(self, caller: Caller, review: Mapping[str, Any]) -> None:
        """Replace a stale review with a fresh evaluation of the same commit."""

        from app.services.systems.detection import apply_evaluation

        with self._tx() as store:
            with store.mutation(review["system_id"], expected_version=None, actor=caller.actor) as change:
                current = store.get_review(review["system_id"], review["id"])
                if current["status"] != "open" or not reconcile.is_stale(store, current):
                    return  # someone else already re-evaluated it
                instance = store.get_instance(review["system_id"], review["instance_id"])
                if current["kind"] == "child_update":
                    revision = self._catalog_revision(current["to_commit"])
                    if revision is None:
                        raise Conflict("the review's candidate revision cannot be read from the catalog")
                    child_drift.apply_child_evaluation(store, change, instance, revision,
                                                       auto_kind="child_auto_advanced")
                    return
                candidate = reconcile.candidate_interface(store, current)
                apply_evaluation(store, change, instance, current["to_commit"], candidate,
                                 auto_kind="baseline_auto_advanced")

    def _decide(
        self, caller: Caller, system_id: str, version: int, review_id: str, item_id: str,
        decision: str, payload: Optional[Mapping[str, Any]],
    ) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._open_review_instance(store, system_id, review_id, caller)
                self._require_visible_import_item(store, system_id, review_id, item_id, caller)
                review = reconcile.decide(store, change, review_id, item_id, decision, payload,
                                          child_loader=self._child_interface)
                restricted = self._restricted_instances(store, system_id, caller)
                body = self._review_doc(store, review, False, restricted)
        return Result(body, system_id, change.version)

    def keep_pinned(self, caller: Caller, system_id: str, version: int, review_id: str) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._open_review_instance(store, system_id, review_id, caller)
                review = reconcile.keep_pinned(store, change, review_id)
                restricted = self._restricted_instances(store, system_id, caller)
                body = self._review_doc(store, review, False, restricted)
        return Result(body, system_id, change.version)

    def rebase(
        self, caller: Caller, system_id: str, version: int, instance_id: str, commit: str
    ) -> tuple[str, Any]:
        """``POST …/rebase``: evaluate an explicit commit like detection (§8.1, §10.1).

        Returns ``("queued", job)`` while the commit's interface is extracted,
        else ``("done", Result)``.
        """

        with self._tx() as store:
            self._system(store, system_id, caller)
            instance = self._open_instance(store, system_id, instance_id, caller)
            project = self._require_project(store, instance["project_id"], caller)
        try:
            target = sources.resolve_commit(project, commit)
        except sources.SourceError as error:
            raise Invalid(str(error)) from None
        if target is None:
            raise Invalid("commit does not exist in the project repository")
        if target == instance["baseline_commit"]:
            raise Conflict("commit is already the baseline")
        with self._tx() as store:
            candidate = store.get_interface(instance["project_id"], target, EXTRACTOR_VERSION)
        if candidate is None:
            job = self._enqueue(instance["project_id"], target, requested_by=caller.email)
            return "queued", {"job_id": str(job["job_id"]), "status": job["status"]}
        from app.services.systems.detection import apply_evaluation

        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                current = self._open_instance(store, system_id, instance_id, caller)
                if current["baseline_commit"] == target:
                    raise Conflict("commit is already the baseline")
                outcome, review_id = apply_evaluation(
                    store, change, current, target, candidate, auto_kind="baseline_rebased"
                )
                row = store.get_instance(system_id, instance_id)
        body = {"outcome": outcome, "reviewId": review_id, "instance": self._instance_row(row)}
        return "done", Result(body, system_id, change.version)

    # ------------------------------------------------------------------
    # CSV imports (§9.3)

    def upload_import(
        self, caller: Caller, system_id: str, *, filename: str, raw: bytes, delimiter: Optional[str],
    ) -> dict:
        """``POST …/imports``: store the upload and describe it for mapping."""

        text = csv_import.decode(raw)
        parsed = csv_import.parse(text, delimiter)
        with self._tx() as store:
            self._system(store, system_id, caller)
            row = store.create_import_session(
                system_id, actor=caller.actor, filename=filename[:255], delimiter=parsed.delimiter,
                content=text, row_count=len(parsed.rows),
            )
        return {"importId": row["id"], "filename": row["filename"], **csv_import.summary(parsed)}

    def _import_state(
        self, store: SystemStore, system_id: str, caller: Caller, session: Mapping[str, Any],
        column_map: Mapping[str, str], board_map: Mapping[str, str], delimiter: Optional[str],
    ) -> dict:
        """Parse the session and classify it against the system's current state."""

        parsed = csv_import.parse(session["content"], delimiter or session["delimiter"])
        instances = {i["id"]: i for i in store.list_instances(system_id)}
        csv_import.check_maps(parsed, column_map, board_map, instances)
        restricted = self._restricted_instances(store, system_id, caller)
        if {v for v in board_map.values() if v != csv_import.SKIP} & restricted:
            raise NotFound("Instance not found")
        interfaces = csv_import.baseline_interfaces(store, system_id)
        overrides = {iid: store.list_overrides(iid) for iid in instances}
        return csv_import.classify(parsed, column_map, board_map, instances=instances, interfaces=interfaces,
                                   overrides=overrides, links=store.list_links(system_id),
                                   harnesses=store.list_harnesses(system_id), subports=store.list_subports(system_id))

    def preview_import(
        self, caller: Caller, system_id: str, import_id: str, column_map: Mapping[str, str],
        board_map: Mapping[str, str], delimiter: Optional[str],
    ) -> Result:
        with self._tx() as store:
            system = self._system(store, system_id, caller)
            session = store.get_import_session(system_id, import_id)
            buckets = self._import_state(store, system_id, caller, session, column_map, board_map, delimiter)
        return Result({"importId": import_id, "committed": session["committed_at"] is not None, **buckets},
                      system_id, system["version"])

    def commit_import(
        self, caller: Caller, system_id: str, version: int, import_id: str, column_map: Mapping[str, str],
        board_map: Mapping[str, str], delimiter: Optional[str],
    ) -> Result:
        """``POST …/imports/{imid}/commit``: write Matched rows, review Needs review rows.

        The rows are classified again under the lock, so the commit acts on the
        state it writes to, not on whatever an earlier preview saw.
        """

        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                session = store.get_import_session(system_id, import_id, lock=True)
                if session["committed_at"] is not None:
                    raise Conflict("this import has already been committed")
                buckets = self._import_state(store, system_id, caller, session, column_map, board_map, delimiter)
                interfaces = csv_import.baseline_interfaces(store, system_id)
                written = csv_import.apply_rows(store, change, buckets["matched"], interfaces)
                review_id = None
                if buckets["needsReview"]:
                    review = store.open_review(
                        change, instance_id=None, kind="import", from_commit=None, to_commit=None,
                        items=[{
                            "kind": "signal_mismatch", "linkId": entry["linkId"],
                            "rowIds": [entry["rowId"]] if entry["rowId"] else [],
                            "expected": {"leaves": sorted({csv_import.leaf(n) for side in ("from", "to")
                                                           for n in (entry[side] or {}).get("nets") or []})},
                            "observed": csv_import.proposal(entry),
                        } for entry in buckets["needsReview"]],
                    )
                    review_id = review["id"]
                report = {**written, "reviewId": review_id, "counts": buckets["counts"]}
                store.mark_import_committed(change, import_id, report)
        body = {"importId": import_id, **report, "unresolved": buckets["unresolved"],
                "conflict": buckets["conflict"]}
        return Result(body, system_id, change.version)


