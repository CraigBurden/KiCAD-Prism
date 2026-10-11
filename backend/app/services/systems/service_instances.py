"""Instances: boards and catalog instances, their edits, interfaces, checks and port overrides (§8.1, CONTRACTS_P2 §5)."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from app.services.systems import child_drift, exposure, hierarchy, redaction, sources
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.service_base import _FULL_SHA, Caller, Result, logger
from app.services.systems.store import Conflict, Forbidden, Invalid, NotFound, SystemStore


class InstancesMixin:
    # ------------------------------------------------------------------
    # Adding instances

    def add_instance(
        self, caller: Caller, system_id: str, version: int, *, project_id: str, label: str,
        baseline_commit: Optional[str], tracked_ref: Optional[str], pinned: bool,
    ) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            project = self._require_project(store, project_id, caller)
        commit = self._resolve_baseline(project, baseline_commit, tracked_ref)
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                row = store.add_instance(
                    change, project_id=project_id, label=label, baseline_commit=commit,
                    tracked_ref=tracked_ref, pinned=pinned,
                )
        self._enqueue_quietly(project_id, commit, caller)
        if tracked_ref:  # SB2-124: check the branch now, not at the next fetch, so the board is never "Not checked"
            try:
                self._enqueue_check(row["id"], project_id, requested_by=caller.email)
            except Exception:
                logger.exception("Could not enqueue a source check for instance %s", row["id"])
        return Result(self._instance_row(row), system_id, change.version)

    def _resolve_baseline(
        self, project: Any, baseline_commit: Optional[str], tracked_ref: Optional[str]
    ) -> str:
        try:
            if tracked_ref is not None:
                tip = sources.resolve_tracked_ref(project, tracked_ref)
                if tip is None:
                    raise Invalid("trackedRef does not exist in the project repository")
            else:
                tip = None
            if baseline_commit is None:
                if tip is None:
                    raise Invalid("baselineCommit or trackedRef is required")
                return tip  # resolved once (§8.1)
            commit = sources.resolve_commit(project, baseline_commit)
        except sources.SourceError as error:
            raise Invalid(str(error)) from None
        if commit is None:
            raise Invalid("baselineCommit does not exist in the project repository")
        return commit

    def add_catalog_instance(
        self, caller: Caller, system_id: str, version: int, *, kind: str, label: str, component_id: str,
        revision_id: Optional[str], follow: str,
    ) -> Result:
        """Add an assembly (or, M6, module) instance pinning one catalog revision (§5.1)."""

        from app.core.roles import CATALOG_BROWSE_ROLES

        if caller.role not in CATALOG_BROWSE_ROLES:
            raise Forbidden("adding a catalog item needs catalog read access")
        catalog = self._catalog()
        revision = (catalog.system_revision(revision_id) if revision_id
                    else catalog.released_system_revision(component_id))
        if revision is None:
            raise Conflict("no_released_revision: the component has no released revision; pick one explicitly")
        if revision["componentId"] != component_id:
            raise Invalid("revisionId does not belong to componentId")
        if revision["kind"] != kind:
            raise Invalid(f"component is a {revision['kind']}, not a {kind}")
        if not revision["active"]:
            raise Conflict("the component has been retired")
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                row = store.add_catalog_instance(change, kind=kind, label=label, component_id=component_id,
                                                 revision_id=revision["revisionId"], follow=follow)
                self._tree(store, system_id)  # refuses a cycle or a limit before anything commits
        return Result(self._instance_row(row), system_id, change.version)

    # ------------------------------------------------------------------
    # Edits

    def update_instance(
        self, caller: Caller, system_id: str, version: int, instance_id: str,
        fields: Mapping[str, Any],
    ) -> Result:
        with self._tx() as store:
            kind = self._open_instance(store, system_id, instance_id, caller).get("kind", "board")
        if kind != "board":
            if {"trackedRef", "pinned"} & set(fields):
                raise Invalid("assembly and module instances follow catalog revisions; use follow")
            with self._tx() as store:
                self._system(store, system_id, caller)
                with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                    row = store.update_instance(change, instance_id, label=fields.get("label"))
                    if fields.get("follow") is not None:
                        store.set_follow(change, instance_id, fields["follow"])
                        row = store.get_instance(system_id, instance_id)
            return Result(self._instance_row(row), system_id, change.version)
        if fields.get("follow") is not None:
            raise Invalid("a board follows its tracked branch, not catalog revisions")
        tracked_ref = fields.get("trackedRef", ...)
        if tracked_ref not in (..., None):
            with self._tx() as store:
                self._system(store, system_id, caller)
                instance = self._open_instance(store, system_id, instance_id, caller)
                project = self._require_project(store, instance["project_id"], caller)
            try:
                if sources.resolve_tracked_ref(project, tracked_ref) is None:
                    raise Invalid("trackedRef does not exist in the project repository")
            except sources.SourceError as error:
                raise Invalid(str(error)) from None
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                before = self._open_instance(store, system_id, instance_id, caller)
                row = store.update_instance(
                    change, instance_id, label=fields.get("label"), pinned=fields.get("pinned"),
                    tracked_ref=tracked_ref,
                )
        resumed = before["pinned"] and not row["pinned"]
        if row["tracked_ref"] and (resumed or row["tracked_ref"] != before["tracked_ref"]):
            # Evaluate the branch now rather than at the next fetch.
            try:
                self._enqueue_check(instance_id, row["project_id"], requested_by=caller.email)
            except Exception:
                logger.exception("Could not enqueue a source check for instance %s", instance_id)
        return Result(self._instance_row(row), system_id, change.version)

    def remove_instance(
        self, caller: Caller, system_id: str, version: int, instance_id: str, *, cascade: bool
    ) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._open_instance(store, system_id, instance_id, caller, allow_deleted=True)
                if cascade:
                    self._require_open_links(store, system_id, caller, instance_id=instance_id)
                store.remove_instance(change, instance_id, cascade_links=cascade)
        return Result(None, system_id, change.version)

    def _require_open_links(
        self, store: SystemStore, system_id: str, caller: Caller, *, instance_id: str
    ) -> None:
        """Cascading must not delete a link whose other end the caller cannot see."""

        instances = {i["id"]: i for i in store.list_instances(system_id, kinds=SystemStore.ALL_KINDS)}
        access = self._access(store, list(instances.values()), caller)
        for link in store.list_links(system_id):
            if instance_id not in (link["a_instance_id"], link["b_instance_id"]):
                continue
            for other in (link["a_instance_id"], link["b_instance_id"]):
                if other == instance_id or instances[other]["kind"] != "board":
                    continue
                if not access[instances[other]["project_id"]]["visible"]:
                    raise NotFound("Link not found")

    def set_override(
        self, caller: Caller, system_id: str, version: int, instance_id: str, port_key: str,
        state: Optional[str],
    ) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                instance = self._open_instance(store, system_id, instance_id, caller)
                if instance.get("kind", "board") != "board":
                    raise Invalid("a subsystem's exports are always ports; hide or promote them in the child system")
                interface = self._interface(store, instance)
                component = next(
                    (c for c in interface.get("components") or [] if c["portKey"] == port_key), None
                )
                if component is None:
                    raise Invalid("portKey is not a component of this board at its baseline")
                if state == "promoted" and not exposure.is_annotated(component["reference"]):
                    raise Invalid("an unannotated component cannot be promoted")
                store.set_override(change, instance_id, port_key, state)
                summary = exposure.port_summary(component, state)
        return Result(summary, system_id, change.version)

    # ------------------------------------------------------------------
    # Interfaces and checks

    def interface(
        self, caller: Caller, system_id: str, instance_id: str, commit: Optional[str]
    ) -> tuple[str, dict]:
        """``("ready", body)`` or ``("queued", job)`` (§8.1 ``202``)."""

        with self._tx() as store:
            self._system(store, system_id, caller)
            instance = self._open_instance(store, system_id, instance_id, caller)
            if instance.get("kind", "board") != "board":
                if commit is not None:
                    raise Invalid("a subsystem has no commits; it pins a catalog revision")
                body = dict(self._interface(store, instance))
                # An export whose board inside the child is hidden keeps its pads, not their nets (P2 §5.4).
                hidden = redaction.hidden_ports(self._restricted_instances(store, system_id, caller))
                body["components"] = [
                    {**c, "override": None, "exposed": True,
                     **({"pins": [{**pin, "nets": None, "powerNet": None} for pin in c.get("pins") or []],
                         "export": None, "redacted": True} if (instance_id, c["portKey"]) in hidden else {})}
                    for c in body["components"]
                ]
                return "ready", {**body, "instanceId": instance_id, "atBaseline": True}
            target = instance["baseline_commit"]
            if commit is not None:
                target = commit.strip().lower()
                if not _FULL_SHA.match(target):
                    raise Invalid("commit must be a full 40-character SHA")
            found = store.get_interface(instance["project_id"], target, EXTRACTOR_VERSION)
            overrides = store.list_overrides(instance_id)
        if found is not None:
            ports = {p["portKey"]: p for p in exposure.resolve_ports(found, overrides)}
            body = dict(found)
            body["components"] = [
                {**component, "override": ports[component["portKey"]]["override"],
                 "exposed": ports[component["portKey"]]["exposed"]}
                for component in found.get("components") or []
            ]
            body["instanceId"] = instance_id
            body["atBaseline"] = target == instance["baseline_commit"]
            return "ready", body
        if target != instance["baseline_commit"]:
            project = self._load_project(instance["project_id"])
            try:
                exists = project is not None and sources.resolve_commit(project, target) == target
            except sources.SourceError:
                exists = False
            if not exists:
                raise NotFound("Commit not found")
        job = self._enqueue(instance["project_id"], target, requested_by=caller.email)
        return "queued", {"job_id": str(job["job_id"]), "status": job["status"]}

    def check_now(self, caller: Caller, system_id: str, instance_id: str) -> dict:
        """``POST …/check`` (§8.1): queue detection for one instance now."""

        with self._tx() as store:
            self._system(store, system_id, caller)
            instance = self._open_instance(store, system_id, instance_id, caller)
        if not instance["tracked_ref"]:
            raise Conflict("instance does not track a branch")
        job = self._enqueue_check(instance_id, instance["project_id"], requested_by=caller.email)
        return {"job_id": str(job["job_id"]), "status": job["status"]}

    # ------------------------------------------------------------------
    # Catalog children (P2 §5.3)

    def advance_child(
        self, actor: str, system_id: str, instance_id: str, revision_id: str, *, auto_kind: str,
        expected_version: Optional[int] = None,
    ) -> dict:
        """Evaluate one catalog revision for one assembly instance and apply §7.2.

        Shared by the release trigger (``child_auto_advanced``) and a manual
        rebase (``child_rebased``). Outcomes: ``at_revision``, ``auto_advanced``,
        ``review_opened``, ``review_current`` or ``advance_blocked`` (§5.3
        limits; reported as SYS-V15); for the release trigger also
        ``not_following`` and ``superseded`` (a newer release exists: nothing changes).
        """

        revision = self._catalog_revision(revision_id)
        if revision is None:
            raise NotFound("Catalog revision not found")
        with self._tx() as store:
            instance = store.get_instance(system_id, instance_id)
            if instance.get("kind") not in ("assembly", "module", "part"):
                raise Invalid("only assembly, module and part instances take catalog revisions")
            if revision["componentId"] != instance["catalog_component_id"]:
                raise Invalid("the revision belongs to another component")
            if instance["catalog_revision_id"] == revision_id:
                return {"outcome": "at_revision", "reviewId": None}
            open_review = store.open_source_review(instance_id)
            if open_review and open_review["to_commit"] == revision_id:
                return {"outcome": "review_current", "reviewId": open_review["id"]}
            # A revision that would break the hierarchy limits is never advanced to (§5.3).
            blocked = self._advance_blocked(store, system_id, instance, revision_id)
            if blocked is not None:
                return blocked
        with self._tx() as store:
            # Under the lock (held to commit): the checks above may be stale by now.
            with store.mutation(system_id, expected_version=expected_version, actor=actor, bump=False):
                current = store.get_instance(system_id, instance_id)
                if auto_kind == "child_auto_advanced":
                    # A release job runs after its listing and may arrive late: apply it only while the
                    # instance still follows and this is still the newest release. A manual rebase
                    # ("child_rebased") may choose any revision.
                    fresh = self._catalog_revision(revision_id) or revision
                    if current.get("follow") != "latest_released":
                        return {"outcome": "not_following", "reviewId": None}
                    if fresh.get("latestReleasedRevisionId") != revision_id:
                        return {"outcome": "superseded", "reviewId": None}
                # SB2-97: another editor may have added boards since the check above.
                blocked = self._advance_blocked(store, system_id, current, revision_id)
            if blocked is not None:
                return blocked
            with store.mutation(system_id, expected_version=expected_version, actor=actor) as change:
                current = store.get_instance(system_id, instance_id)
                # A module's revision compares as its connectors (§5.6), an assembly's as its exports (§7).
                candidate = (self._module_interface(revision_id) if current.get("kind") == "module"
                             else self._part_interface(revision_id) if current.get("kind") == "part" else None)
                outcome, review_id = child_drift.apply_child_evaluation(store, change, current, revision,
                                                                        auto_kind=auto_kind, candidate=candidate)
            store.record_source_check(instance_id, tip_commit=None, checked_commit=None, outcome=outcome)
        return {"outcome": outcome, "reviewId": review_id, "version": change.version}

    def _advance_blocked(self, store: SystemStore, system_id: str, instance: Mapping[str, Any],
                         revision_id: str) -> Optional[dict]:
        """``advance_blocked`` (recorded) when moving ``instance`` to ``revision_id`` would break the
        hierarchy limits (§5.3), else None."""
        candidate = {**instance, "catalog_revision_id": revision_id}
        others = [i for i in store.list_instances(system_id, kinds=SystemStore.ALL_KINDS) if i["id"] != instance["id"]]
        try:
            hierarchy.resolve(system_id, others + [candidate], self._child_loader(store))
        except hierarchy.HierarchyError as error:
            store.record_source_check(instance["id"], tip_commit=None, checked_commit=None, outcome="advance_blocked")
            logger.info("Not advancing %s to %s: %s", instance["id"], revision_id, error)
            return {"outcome": "advance_blocked", "reviewId": None, "reason": error.code}
        return None

    def rebase_child(self, caller: Caller, system_id: str, version: int, instance_id: str,
                     revision_id: str) -> Result:
        """``POST …/rebase`` with ``revisionId`` for an assembly instance (§7.1)."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            self._open_instance(store, system_id, instance_id, caller)
        body = self.advance_child(caller.actor, system_id, instance_id, revision_id, auto_kind="child_rebased",
                                  expected_version=version)
        if body["outcome"] == "at_revision":
            raise Conflict("the instance already pins this revision")
        if body["outcome"] == "advance_blocked":
            raise Invalid(f"{body.get('reason')}: the revision would break the hierarchy limits")
        with self._tx() as store:
            row = store.get_instance(system_id, instance_id)
            now = store.get_system(system_id)["version"]
        return Result({"outcome": body["outcome"], "reviewId": body["reviewId"], "instance": self._instance_row(row)},
                      system_id, int(now))
