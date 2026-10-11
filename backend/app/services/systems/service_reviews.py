"""Reviews, rebase, snapshots, publishing, ICD, diff, imports, history and layout (§7, §9)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Collection, Mapping, Optional, Sequence

from app.services.systems import (
    child_drift, csv_import, drift, hierarchy, icd,
    manifest as manifest_io, reconcile, redaction, renames as renames_module, report as report_io, sources,
    system_nets, visibility,
)
from app.services.systems.manifest_schema import digests as manifest_digests
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.loaded import LoadedSystem
from app.services.systems.store import Conflict, Forbidden, Invalid, NotFound, StaleVersion, SystemStore, new_id
from app.services.systems.service_base import Caller, Result, logger, _iso, MAX_LAYOUT_ENTRIES
from app.services.systems.service_documents import rename_doc


class ReviewsMixin:
    # ------------------------------------------------------------------
    # Reviews and rebase (§7.1, §8.1)

    def _review_doc(self, store: SystemStore, review: Mapping[str, Any], restricted: bool,
                    hidden: Collection[str] = ()) -> dict:
        base = {"id": review["id"], "kind": review["kind"], "status": review["status"],
                "instanceId": review["instance_id"], "createdAt": _iso(review["created_at"]),
                "decidedBy": review["decided_by"], "decidedAt": _iso(review["decided_at"])}
        if restricted:
            return {**base, "redacted": True, "fromCommit": None, "toCommit": None,
                    "pendingChanges": None, "items": None}
        links = store.drift_links(review["system_id"])
        rows = {row["id"]: row for link in links for row in link["rows"]}
        # P2 §5.4: an item on a link end whose export's source board is hidden says nothing of its
        # nets, exactly as the link row itself does; nor does a candidate export with a hidden source.
        ports = redaction.hidden_ports(hidden)
        ends = {(link["id"], side): (link[f"{side}_instance_id"], (link[f"{side}_port"] or {}).get("portKey"))
                for link in links for side in ("a", "b")} if ports else {}
        withheld = False
        items = []
        for item in review["items"]:
            end = item["link_end"]
            if ports and ends.get((item["link_id"], end)) in ports:
                withheld = True
                items.append({"id": item["id"], "ordinal": item["ordinal"], "kind": item["kind"],
                              "linkId": item["link_id"], "end": end, "rowIds": list(item["row_ids"]),
                              "pins": [], "expected": None, "observed": None, "candidates": None,
                              "decision": item["decision"], "decisionPayload": None, "redacted": True})
                continue
            pins = sorted({rows[rid][f"pin_{end}"] for rid in item["row_ids"] if rid in rows},
                          key=drift.pad_sort_key) if end else []
            if review["kind"] == "import" and hidden and {
                ((item["observed"] or {}).get(side) or {}).get("instanceId") for side in ("from", "to")
            } & set(hidden):
                items.append({"id": item["id"], "ordinal": item["ordinal"], "kind": item["kind"],
                              "linkId": None, "end": None, "rowIds": [], "pins": [], "expected": None,
                              "observed": None, "candidates": None, "decision": item["decision"],
                              "decisionPayload": None, "redacted": True})
                continue
            items.append({
                "id": item["id"], "ordinal": item["ordinal"], "kind": item["kind"],
                "linkId": item["link_id"], "end": end, "rowIds": list(item["row_ids"]), "pins": pins,
                "expected": item["expected"], "observed": item["observed"],
                "candidates": _visible_candidates(item["candidates"], review["instance_id"], ports),
                "decision": item["decision"],
                "decisionPayload": item["decision_payload"], "redacted": False,
            })
        return {**base, "redacted": False, "fromCommit": review["from_commit"],
                "toCommit": review["to_commit"],
                # Port updates and silent changes name the same ends' nets.
                "pendingChanges": None if withheld else review["pending_changes"],
                "items": items}

    def _restricted_instances(self, store: SystemStore, system_id: str, caller: Caller) -> redaction.Restricted:
        """The live system's restricted boards and hidden export ends for ``caller`` (§8.2, P2 §5.4)."""
        return self._visibility(store, system_id, caller, store.list_instances(system_id, kinds=SystemStore.ALL_KINDS))

    def _visibility(self, store: SystemStore, system_id: str, caller: Caller,
                    instances: Sequence[Mapping[str, Any]], tree: Any = ...) -> redaction.Restricted:
        """Restricted boards (by today's access to their project) and the assembly export ends
        whose source board inside the child is hidden from ``caller``, for live instance rows or
        a frozen document's instances. An export that does not resolve hides its nets too.
        ``tree`` is the instances' resolved tree (None when it breaks a limit) when already known."""

        members = [{"id": i["id"], "kind": i.get("kind") or "board",
                    "project_id": i.get("project_id") or i.get("projectId")} for i in instances]
        if tree is ...:
            try:
                tree = hierarchy.resolve(system_id, instances, self._child_loader(store))
            except hierarchy.HierarchyError:
                tree = None
        projects = {m["project_id"] for m in members if m["kind"] == "board" and m["project_id"]}
        projects |= {o.project_id for o in (tree.boards if tree else ()) if o.project_id}
        access = visibility.project_access(store.conn, projects, caller.role)
        restricted = {m["id"] for m in members if m["kind"] == "board"
                      and not access.get(str(m["project_id"]), {}).get("visible", False)}
        assemblies = [m for m in members if m["kind"] == "assembly"]
        if not assemblies:
            return redaction.Restricted(restricted)
        visible = self._visible_board_paths(store, tree, caller, access) if tree else set()
        root = system_nets.Level(prefix="", kinds={m["id"]: m["kind"] for m in members},
                                 labels={}, links=[])
        if tree:
            system_nets.attach_children(root, tree)
        hidden: set[tuple[str, str]] = set()
        for member, raw in zip(members, instances):
            if member["kind"] != "assembly":
                continue
            child = root.children.get(member["id"])
            export_ids = {e["id"] for e in (child.exports if child else ())}
            export_ids |= set(self._catalog_export_ids(raw))
            for export_id in export_ids:
                if system_nets.export_source(child, export_id) not in visible:
                    hidden.add((member["id"], export_id))
        return redaction.Restricted(restricted, hidden)

    def _catalog_export_ids(self, instance: Mapping[str, Any]) -> list[str]:
        """The export IDs of an assembly instance's catalog revision (its ports in the document)."""
        revision_id = instance.get("catalog_revision_id") or (instance.get("catalog") or {}).get("revisionId")
        revision = self._catalog_revision(revision_id) if revision_id else None
        return [e.get("id") for e in ((revision or {}).get("interface") or {}).get("exports") or [] if e.get("id")]

    @staticmethod
    def _visible_board_paths(store: SystemStore, tree: hierarchy.Tree, caller: Caller,
                             access: Mapping[str, Mapping[str, Any]]) -> set[str]:
        """Board occurrence paths ``caller`` may see: a readable project, not inside a child system
        whose folder the reader cannot see (P2 §5.4, S7). ``access`` covers every board's project."""
        hidden_ids = visibility.hidden_systems(store.conn, caller.role,
                                               {o.child_system_id for o in tree.occurrences if o.child_system_id})
        hidden_systems = [o.path for o in tree.occurrences if o.child_system_id in hidden_ids]
        return {o.path for o in tree.boards
                if access.get(str(o.project_id), {}).get("visible", False)
                and not any(o.path.startswith(prefix + "/") for prefix in hidden_systems)}

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
    # Snapshots, ICD and diff (§9)

    @staticmethod
    def _snapshot_meta(row: Mapping[str, Any]) -> dict:
        return {"id": row["id"], "name": row["name"], "note": row["note"], "createdBy": row["created_by"],
                "createdAt": _iso(row["created_at"]), "digest": row["digest"],
                "connectivityDigest": row.get("connectivity_digest"),
                "manifestSchema": row.get("manifest_schema"),
                "openReviewCount": int(row["open_review_count"]), "rendererVersion": row["renderer_version"],
                "findingCounts": {"error": row.get("error_count") or 0, "warning": row.get("warning_count") or 0},
                "exportCount": row.get("export_count") or 0,
                "git": _git_status(row.get("git"))}

    def _restricted_in(self, store: SystemStore, document: Mapping[str, Any], caller: Caller) -> redaction.Restricted:
        """Restricted boards and hidden export ends of a frozen document, by today's access (§8.2).

        A snapshot can hold instances that have since been removed, so this
        reads the identities the document itself recorded: a board's project,
        an assembly's catalog revision (P2 §5.4).
        """

        return self._visibility(store, document["system"]["id"], caller, document["instances"])

    def create_snapshot(self, caller: Caller, system_id: str, version: int, name: str, note: str) -> Result:
        """Freeze the unredacted document and manifest at ``version`` (§9.1, P2 §9.4).

        The version is not bumped. ``digest`` is the manifest's full digest;
        the rendered ``document`` stays beside it as the evidence the ICD and
        diffs read.
        """

        # SB2-94: build from one consistent read of ``version`` without the system lock, so editors
        # are not queued behind the build; then lock only to check nothing changed and store it.
        with self._tx(consistent=True) as store:
            loaded = self._load(store, system_id, caller)
            if int(loaded.version) != int(version):
                raise StaleVersion(int(loaded.version), system_id)
            built = self._built(loaded)
            # The read keys (SB2-98) describe the live system, not what a snapshot freezes.
            document = json.loads(json.dumps({k: v for k, v in built.items() if k not in ("sceneKey", "netsKey")},
                                             default=_iso))
            snapshot_id = new_id("ssn_")
            manifest = manifest_io.build(
                store, system_id, created_by=caller.actor,
                created_at=datetime.now(timezone.utc).replace(microsecond=0),
                snapshot={"id": snapshot_id, "name": name.strip(), "note": note},
                catalog_refs=self._catalog_refs(store, system_id),
            )
            digests = manifest_digests(manifest)
            git = self._snapshot_git(store, system_id, caller)
        with self._tx() as store:
            with store.mutation(system_id, expected_version=version, actor=caller.actor, bump=False) as change:
                row = store.create_snapshot(
                    change, name=name, note=note, document=document, digest=digests["full"],
                    open_review_count=document["openReviewCount"], renderer_version=icd.RENDERER_VERSION,
                    snapshot_id=snapshot_id, manifest=manifest.model_dump(mode="json", by_alias=True),
                    connectivity_digest=digests["connectivity"], git=git,
                )
        if git is not None:
            self._git_quietly(self._git_enqueue_commit, system_id, row["id"], requested_by=caller.email)
        return Result(self._snapshot_meta(row), system_id, change.version)

    def list_snapshots(self, caller: Caller, system_id: str) -> list[dict]:
        with self._tx() as store:
            system = self._system(store, system_id, caller)
            rows = store.list_snapshots(system_id)
        publications = self._publications(system.get("catalogComponentId"))
        return [{**self._snapshot_meta(row), "publication": publications.get(row["id"])} for row in rows]

    def _publications(self, component_id: Optional[str]) -> dict[str, dict]:
        """snapshotId -> the catalog revision it was published as. Best effort: never breaks a read."""
        if not component_id:
            return {}
        try:
            revisions = self._catalog().system_revisions(component_id)
        except Exception:  # the catalog is a separate service; a listing must not fail on it
            logger.exception("Could not read catalog revisions of %s", component_id)
            return {}
        return {
            str(r["sourceRef"].get("snapshotId")): {"componentId": component_id, "revisionId": r["revisionId"],
                                                   "version": r["version"], "releaseStatus": r["releaseStatus"],
                                                   "commit": (r["sourceRef"].get("git") or {}).get("commit")}
            for r in revisions if r["sourceRef"].get("snapshotId")
        }

    # ------------------------------------------------------------------
    # Publishing (CONTRACTS_P2 §3.3)

    def _hierarchy_facts(self, system_id: str, manifest: Mapping[str, Any]) -> dict:
        """``hierarchyValid`` and ``children`` for an assembly's release gates, from its snapshot."""
        children = [{"componentId": i["catalog"]["componentId"], "revisionId": i["catalog"]["revisionId"]}
                    for i in manifest["instances"] if i["kind"] != "board"]
        with self._tx() as store:
            try:
                hierarchy.resolve(system_id, manifest["instances"], self._child_loader(store))
                valid = True
            except hierarchy.HierarchyError:
                valid = False
        return {"hierarchyValid": valid, "children": children}

    def publish_snapshot(
        self, caller: Caller, system_id: str, snapshot_id: str, *, ipn: Optional[str], name: Optional[str],
        description: Optional[str], manufacturer: Optional[str],
    ) -> tuple[bool, dict]:
        """Publish a snapshot as a catalog ``assembly`` revision. Returns ``(created, publication)``.

        Idempotent per snapshot. The catalog revision is written before the
        system binding, both under the system lock; a crash in between is
        repaired by the next publish, which finds the orphan by system ID.
        """

        from app.core.roles import CATALOG_WRITE_ROLES

        if caller.role not in CATALOG_WRITE_ROLES:
            raise Forbidden("publishing needs catalog write access")
        with self._tx() as store:
            self._system(store, system_id, caller)
            row = store.get_snapshot(system_id, snapshot_id)
            if row["manifest"] is None:
                raise Invalid("this snapshot predates manifests; take a new snapshot to publish")
            if self._restricted_in(store, row["document"], caller):
                raise Forbidden("the snapshot contains boards you cannot see")
            git = self._publication_git(store, system_id, row.get("git"))
        interface = self.export_interface(caller, system_id, snapshot_id)
        if not interface["exports"]:
            raise Invalid("publishing needs at least one export")
        unresolved = [e["name"] for e in interface["exports"] if not e["resolved"]]
        if unresolved:
            raise Invalid(f"these exports do not resolve at the snapshot: {', '.join(unresolved)}")
        source_ref = {
            "kind": "system_snapshot", "systemId": system_id, "snapshotId": snapshot_id,
            "snapshotName": row["name"], "fullDigest": row["digest"],
            "connectivityDigest": row["connectivity_digest"], "openReviewCount": int(row["open_review_count"]),
            **self._hierarchy_facts(system_id, row["manifest"]),
            **({"git": git} if git else {}),
        }
        catalog = self._catalog()
        with self._tx() as store:
            system = self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=None, actor=caller.actor, bump=False) as change:
                bound = store.get_system(system_id).get("catalog_component_id") or catalog.find_system_component(system_id)
                created = False
                if bound:
                    existing = next((r for r in catalog.system_revisions(bound)
                                     if r["sourceRef"].get("snapshotId") == snapshot_id), None)
                    if existing is None:
                        out = catalog.add_system_revision(bound, interface=interface, source_ref=source_ref,
                                                          actor=caller.email, change_summary=f"Publish {row['name']}")
                        revision_id, created = out["revisionId"], True
                    else:
                        revision_id = existing["revisionId"]
                    component_id = bound
                else:
                    if not (ipn or "").strip():
                        raise Invalid("the first publish needs an IPN")
                    try:
                        out = catalog.create_system_item(
                            kind="assembly", ipn=ipn or "", name=(name or system["name"]).strip(),
                            description=(description or system["description"] or system["name"]).strip(),
                            manufacturer=(manufacturer or "In-house").strip(), datasheet_url=f"/systems/{system_id}",
                            interface=interface, source_ref=source_ref, actor=caller.email,
                            change_summary=f"Publish {row['name']}",
                        )
                    except ValueError as error:
                        raise Conflict(str(error)) from None
                    component_id, revision_id, created = out["componentId"], out["revisionId"], True
                store.bind_catalog_component(change, component_id)
                if created:
                    change.audit("snapshot_published", {"snapshotId": snapshot_id, "name": row["name"],
                                                        "componentId": component_id, "revisionId": revision_id})
        publication = self._publications(component_id).get(snapshot_id) or {
            "componentId": component_id, "revisionId": revision_id, "version": None, "releaseStatus": None,
            "commit": (git or {}).get("commit")}
        return created, publication

    def _snapshot(self, store: SystemStore, system_id: str, snapshot_id: str, caller: Caller) -> tuple[dict, dict]:
        """A snapshot's metadata and its document, redacted for ``caller``."""

        row = store.get_snapshot(system_id, snapshot_id)
        restricted = self._restricted_in(store, row["document"], caller)
        return self._snapshot_meta(row), redaction.redact_document(row["document"], restricted)

    def snapshot_manifest(self, caller: Caller, system_id: str, snapshot_id: str) -> dict:
        """``GET …/snapshots/{sid}/manifest`` (P2 §11).

        A manifest is an exchange artifact, so it is served whole or not at
        all: a reader who cannot see every board in it gets 403.
        """

        with self._tx() as store:
            self._system(store, system_id, caller)
            row = store.get_snapshot(system_id, snapshot_id)
            if row["manifest"] is None:
                raise NotFound("This snapshot predates manifests")
            if self._restricted_in(store, row["document"], caller):
                raise Forbidden("the manifest contains boards you cannot see")
            return row["manifest"]

    def get_snapshot(self, caller: Caller, system_id: str, snapshot_id: str) -> dict:
        with self._tx() as store:
            self._system(store, system_id, caller)
            meta, document = self._snapshot(store, system_id, snapshot_id, caller)
        return {**meta, "document": document}

    def _icd_source(
        self, caller: Caller, system_id: str, snapshot_id: Optional[str]
    ) -> tuple[dict, str, Optional[int], dict]:
        """``(redacted document, source label, live version or None, canvas positions)`` for an ICD."""

        with self._tx() as store:
            system = self._system(store, system_id, caller)
            if snapshot_id is not None:
                meta, document = self._snapshot(store, system_id, snapshot_id, caller)
                # The canvas as frozen in the snapshot's manifest; older snapshots have none (default layout).
                manifest = store.get_snapshot(system_id, snapshot_id).get("manifest") or {}
                return document, meta["name"], None, (manifest.get("layout") or {}).get("positions") or {}
            loaded = LoadedSystem(store, system, self)
            document = self._for_reader(loaded, caller, self._built(loaded))
            positions = store.get_layout(system_id)
        return document, "live", system["version"], positions

    def icd(
        self, caller: Caller, system_id: str, fmt: str, snapshot_id: Optional[str] = None, depth: str = "own",
    ) -> tuple[str, str, Optional[int]]:
        """``(content, system name, live version or None)``; ``fmt`` is ``csv`` or ``html`` (§9.4, §9.5).

        ``depth="all"`` (P2 §10) adds every subsystem level's own links, from its pinned snapshot.
        """

        document, source, version, positions = self._icd_source(caller, system_id, snapshot_id)
        levels = self._icd_levels(caller, system_id, snapshot_id) if depth == "all" else None
        if fmt == "csv":
            content = icd.render_csv(document, levels)
        else:
            generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
            content = icd.render_html(document, source=source, generated_at=generated, levels=levels, positions=positions)
        return content, document["system"]["name"], version

    def report(self, caller: Caller, system_id: str, fmt: str) -> tuple[Any, str, int]:
        """SB2-107 (P2 §8.6): ``(content, system name, version)``; the live open reviews and
        findings as ``xlsx`` bytes or ``csv`` text, redacted for the reader like the trays."""

        with self._tx(consistent=True) as store:
            loaded = self._load(store, system_id, caller)
            system = loaded.system
            built = self._built(loaded)
            restricted = loaded.restricted(caller)
            reviews = [self._review_doc(store, review, review["instance_id"] in restricted, restricted)
                       for review in store.list_reviews(system_id, status="open")]
            links = store.drift_links(system_id)
            renames = [rename_doc(r, len(renames_module.covered(links, r["instance_id"], r["net"])))
                       for r in store.list_renames(system_id, ("open", "applied"))]
            document = self._for_reader(loaded, caller, {**built, "renames": renames})
        generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        parts = report_io.sections(document, reviews, version=system["version"], generated_at=generated,
                                   renames=document["renames"])
        content = report_io.render_xlsx(parts) if fmt == "xlsx" else report_io.render_csv(parts)
        return content, document["system"]["name"], system["version"]

    def _icd_levels(self, caller: Caller, system_id: str, snapshot_id: Optional[str]) -> list[dict]:
        """Each visible subsystem level, redacted for the reader (§5.4), in tree order."""
        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            if snapshot_id is None:
                tree = loaded.tree
            else:
                manifest = store.get_snapshot_manifest(system_id, snapshot_id)
                if not manifest:
                    return []
                try:
                    tree = hierarchy.resolve(system_id, manifest["instances"], self._child_loader(store))
                except hierarchy.HierarchyError as error:
                    raise Invalid(str(error)) from None
            projects = {o.project_id for o in tree.boards if o.project_id}
            access = visibility.project_access(store.conn, projects, caller.role)
            hidden_systems = visibility.hidden_systems(store.conn, caller.role,
                                                       {o.child_system_id for o in tree.occurrences if o.child_system_id})
        restricted_paths = {o.path for o in tree.boards if not access.get(o.project_id, {}).get("visible", False)}
        levels, hidden_prefixes = [], []
        for occurrence in sorted(tree.occurrences, key=lambda o: (o.depth, o.path)):
            if occurrence.child is None or any(occurrence.path.startswith(p + "/") for p in hidden_prefixes):
                continue
            if occurrence.child_system_id in hidden_systems:
                hidden_prefixes.append(occurrence.path)
                continue
            child = occurrence.child
            levels.append({
                "displayPath": occurrence.display_path, "snapshotName": child.name,
                "links": child.links, "labels": {i["id"]: i["label"] for i in child.instances},
                "restricted": {i["id"] for i in child.instances if f"{occurrence.path}/{i['id']}" in restricted_paths},
            })
        return levels

    def diff_snapshot(self, caller: Caller, system_id: str, snapshot_id: str, against: str) -> dict:
        """``GET …/snapshots/{sid}/diff?against=live|<sid>``: what changed since the snapshot.

        Both sides are redacted with the union of their restricted boards, so a
        comparison cannot reveal a restricted side by difference.
        """

        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            before = store.get_snapshot(system_id, snapshot_id)["document"]
            if against == "live":
                after = json.loads(json.dumps(self._built(loaded), default=_iso))
                restricted = loaded.restricted(caller)
            else:
                try:
                    after = store.get_snapshot(system_id, against)["document"]
                except NotFound:
                    raise NotFound("Snapshot not found") from None
                restricted = self._restricted_in(store, after, caller)
            restricted |= self._restricted_in(store, before, caller)
        return {"snapshotId": snapshot_id, "against": against,
                **icd.diff(redaction.redact_document(before, restricted),
                           redaction.redact_document(after, restricted))}

    # ------------------------------------------------------------------
    # CSV import (§9.3)

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

    # ------------------------------------------------------------------
    # History and layout

    def history(
        self, caller: Caller, system_id: str, *, cursor: Optional[int], limit: int
    ) -> dict:
        with self._tx() as store:
            self._system(store, system_id, caller)
            events = store.history(system_id, before_seq=cursor, limit=limit)
            # Removed instances too: their older events still name them.
            owners = store.instance_projects(system_id)
            project_ids = set(owners.values())
            for event in events:
                project = (event["payload"] or {}).get("projectId")
                if isinstance(project, str):
                    project_ids.add(project)
            access = visibility.project_access(store.conn, project_ids, caller.role)
            # Export ends whose source board inside a child is hidden (P2 §5.4); an event naming one
            # (a decided child-update item, a port update) can carry that board's nets.
            ports = redaction.hidden_ports(self._restricted_instances(store, system_id, caller))
            # Row edits are logged by link, not by end: a link with such an end withholds them too.
            hidden_links = {link["id"] for link in store.drift_links(system_id) for side in ("a", "b")
                            if (link[f"{side}_instance_id"], (link[f"{side}_port"] or {}).get("portKey")) in ports}
        hidden_projects = {pid for pid, seen in access.items() if not seen["visible"]}
        hidden_instances = {iid for iid, pid in owners.items() if pid in hidden_projects}
        out = []
        for event in events:
            text = json.dumps(event["payload"], sort_keys=True)
            redacted = (any(token in text for token in hidden_instances | hidden_projects)
                        or any(instance in text and export in text for instance, export in ports)
                        or any(link_id in text for link_id in hidden_links))
            out.append({
                "seq": int(event["seq"]), "id": event["id"], "at": _iso(event["at"]),
                "actor": event["actor"], "kind": event["kind"],
                "payload": None if redacted else event["payload"], "redacted": redacted,
            })
        next_cursor = out[-1]["seq"] if len(out) == limit and out else None
        return {"events": out, "nextCursor": next_cursor}

    def get_layout(self, caller: Caller, system_id: str) -> dict:
        with self._tx() as store:
            self._system(store, system_id, caller)
            return {"positions": store.get_layout(system_id)}

    def put_layout(self, caller: Caller, system_id: str, positions: Mapping[str, Any]) -> dict:
        if len(positions) > MAX_LAYOUT_ENTRIES:
            raise Invalid(f"limit layout_entries ({MAX_LAYOUT_ENTRIES})")
        if any(not key or len(key) > 200 for key in positions):
            raise Invalid("layout keys must be 1 to 200 characters")
        with self._tx() as store:
            self._system(store, system_id, caller)
            store.put_layout(system_id, positions)
            return {"positions": store.get_layout(system_id)}


def _visible_candidates(candidates: Any, instance_id: str, ports: Collection[tuple[str, str]]) -> Any:
    """Candidate ports of a review item, without the nets of those whose source is hidden (P2 §5.4)."""
    if not candidates or not ports:
        return candidates
    out = []
    for candidate in candidates:
        key = candidate.get("portKey") if isinstance(candidate, Mapping) else None
        if key is not None and (instance_id, key) in ports:
            # As for the export itself: its name and pin count stay; the hidden board's connector
            # facts and the overlap computed from its nets do not.
            candidate = {**{k: v for k, v in candidate.items()
                            if k in ("portKey", "memberKeys", "reference", "pinCount", "referenceEqual", "pinCountEqual")},
                         "libId": None, "footprint": None, "libIdEqual": None, "netOverlap": None, "redacted": True}
        out.append(candidate)
    return out


def _git_status(git: Optional[Mapping[str, Any]]) -> Optional[dict]:
    """A snapshot's commit status (§21.2), without the author it was queued with."""
    return None if git is None else {k: v for k, v in git.items() if k != "author"}
