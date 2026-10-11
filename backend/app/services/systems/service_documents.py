"""Systems, the system document, exports and instances (§8.1, CONTRACTS_P2 §4)."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from app.services.systems import (
    exports as exports_module, exposure, redaction, sources,
    renames as renames_module, subports as subports_module, validation, visibility,
)
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.jobs import (
    artifact_key,
)
from app.services.systems.loaded import LoadedSystem
from app.services.systems.store import Conflict, Invalid, NotFound, StaleVersion, SystemStore
from app.services.systems.store_base import MAX_EXPORTS
from app.services.systems.service_base import Caller, Result, _mating_summary, _iso, logger

MAX_BATCH_WAIVERS = 1000  # SB2-113: one group waive; the C&DH stack's largest group is 401


class DocumentsMixin:
    # ------------------------------------------------------------------
    # Systems

    def list_systems(self, caller: Caller) -> list[dict]:
        """SB2-101: each summary also says how many boards it holds counted through every subsystem,
        its last snapshot, its git branch, and its last finding counts when they are of this version."""
        with self._tx() as store:
            systems = visibility.visible_systems(store.conn, caller.role)
            extras = store.list_extras([summary["id"] for summary in systems])
            for summary in systems:
                summary["boardTotal"] = self._board_total(store, summary)
                extra = extras.get(summary["id"]) or {}
                snapshot = extra.get("last_snapshot")
                summary["lastSnapshot"] = ({"id": snapshot["id"], "name": snapshot["name"], "createdAt": snapshot["createdAt"]}
                                           if snapshot else None)
                summary["git"] = ({"branch": extra["git_branch"], "outsideChange": bool(extra["git_outside"]),
                                   "error": bool(extra["git_error"])} if extra.get("git_branch") else None)
                current = extra.get("counted_version") == summary["version"]
                summary["findingCounts"] = extra.get("counts") if current else None
        return systems

    def _board_total(self, store: SystemStore, summary: Mapping[str, Any]) -> Optional[int]:
        """Boards counted through every subsystem (child manifests are cached, SB2-95); None if the
        hierarchy can't be resolved."""
        if not summary.get("subsystemCount"):
            return int(summary.get("instanceCount") or 0)
        try:
            return len(self._tree(store, summary["id"]).boards)
        except Invalid:
            return None

    def create_system(
        self, caller: Caller, *, name: str, description: str, folder_id: Optional[str]
    ) -> Result:
        with self._tx() as store:
            if folder_id is not None and not visibility.folder_visible(store.conn, folder_id, caller.role):
                raise Invalid("folderId does not name a folder")
            row = store.create_system(
                name=name, description=description, folder_id=folder_id, actor=caller.actor
            )
            body = self._system(store, row["id"], caller)
        return Result(body, row["id"], body["version"])

    def update_system(
        self, caller: Caller, system_id: str, version: int, fields: Mapping[str, Any]
    ) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            folder_id = fields.get("folderId", ...)
            if folder_id not in (..., None) and not visibility.folder_visible(
                store.conn, folder_id, caller.role
            ):
                raise Invalid("folderId does not name a folder")
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                rules = fields.get("optionalRules")
                if rules is not None and not set(rules) <= validation.OPTIONAL_RULES:
                    raise Invalid(f"optionalRules may only name {', '.join(sorted(validation.OPTIONAL_RULES))}")
                store.update_system(
                    change, name=fields.get("name"), description=fields.get("description"),
                    folder_id=folder_id, optional_rules=rules,
                )
            body = self._system(store, system_id, caller)
        return Result(body, system_id, change.version)

    def delete_system(self, caller: Caller, system_id: str, version: int) -> dict:
        """D-P2-31: delete, or archive a system something still references.

        Catalog revisions resolve through the snapshots they were published from, and a parent
        snapshot freezes the revisions it used. While the catalog component is active, or any
        parent instance or parent snapshot pins one of those revisions, the system is archived:
        hidden from lists and read-only, its snapshots kept. Otherwise it is deleted. Deleting an
        archived system again deletes it once nothing references it any more.
        """
        with self._tx() as store:
            self._system(store, system_id, caller)
            references = self._references(store, system_id)
            if any(references.values()):
                with store.mutation(system_id, expected_version=version, actor=caller.actor, archived_ok=True) as change:
                    store.archive_system(change)
                return {"deleted": False, "archived": True, "references": references}
            access = self._access(store, store.list_instances(system_id), caller)
            if any(not seen["visible"] for seen in access.values()):
                # Deleting would destroy rows of a board the caller cannot see.
                raise Conflict("system contains restricted boards")
            with store.mutation(system_id, expected_version=version, actor=caller.actor, archived_ok=True):
                pass
            store.delete_system(system_id)
        return {"deleted": True, "archived": False, "references": references}

    def _references(self, store: SystemStore, system_id: str) -> dict:
        """What still needs this system's snapshots: its active catalog component, and the parent
        instances and parent snapshots that pin a revision published from it (D-P2-29, D-P2-31)."""

        references = {"activeCatalogComponent": False, "parentInstances": 0, "parentSnapshots": 0}
        component_id = store.get_system(system_id).get("catalog_component_id") or \
            self._catalog().find_system_component(system_id)
        if not component_id:
            return references
        revisions = [r["revisionId"] for r in self._catalog().system_revisions(component_id)
                     if (r.get("sourceRef") or {}).get("systemId") == system_id]
        if not revisions:
            return references
        references["activeCatalogComponent"] = self._catalog().find_system_component(system_id) == component_id
        references["parentInstances"] = store.count_instances_of_revisions(revisions)
        references["parentSnapshots"] = store.count_snapshots_of_revisions(revisions)
        return references

    # ------------------------------------------------------------------
    # The system document (§8.1)

    def _load(self, store: SystemStore, system_id: str, caller: Caller) -> LoadedSystem:
        """The system as this transaction reads it, after checking the caller may see it."""
        return LoadedSystem(store, self._system(store, system_id, caller), self)

    def _build(self, loaded: LoadedSystem) -> dict:
        """The unredacted system document with its full validation report (``validation.report``).

        Snapshots freeze exactly this; every read returns it through ``_for_reader``.
        """

        interfaces = loaded.interfaces
        overrides = {iid: found for iid, found in loaded.overrides.items() if iid in interfaces}
        subports_by_id = {row["id"]: row for row in loaded.subports}
        harness_docs = []
        for harness in loaded.harnesses:
            doc = self._harness_doc(harness, loaded.end_components[harness["id"]])
            # SB2-46 (§17.10): routed where the System 3D view draws them.
            found = loaded.harness_checks.get(harness["id"])
            doc["lengths"] = _rounded_lengths(found["lengths"]) if found else None
            harness_docs.append(doc)
        link_docs = [self._link_doc(link, interfaces, overrides, loaded.mating, subports_by_id) for link in loaded.links]
        export_docs = [self._export_doc(export, interfaces, overrides, subports_by_id) for export in loaded.exports]
        instance_docs = [
            self._instance_doc(i, loaded.project_names.get(i["project_id"]), interfaces.get(i["id"]),
                               overrides.get(i["id"], {}),
                               loaded.job_state.get(artifact_key(i["project_id"], i["baseline_commit"])))
            for i in loaded.boards
        ] + [dict(doc) for doc in loaded.catalog_docs]
        for doc in instance_docs:
            doc["subports"] = [_subport_entry(row) for row in loaded.subports if row["instance_id"] == doc["id"]]
        all_instances = loaded.all_instances
        # SB2-98: what the 3D scene and the system nets depend on, so readers re-read them only when
        # these change rather than on every version (a signal label moves neither).
        scene_key = _digest({
            "instances": [[i["id"], i.get("kind"), i.get("label"), i.get("project_id"), i.get("baseline_commit"),
                           i.get("catalog_revision_id")] for i in all_instances],
            "links": [[link["id"], link.get("type"), _end_key(link["a"]), _end_key(link["b"]),
                       link.get("stackHeightMm")] for link in link_docs],
            "harnesses": harness_docs, "mating": loaded.mating, "poses": loaded.poses,
            "driving": loaded.driving,
        })
        report = validation.report(loaded, mates=self._mate_catalog(loaded), scene_key=scene_key)
        open_renames = loaded.open_renames
        drift_rows = loaded.rows.drift_links(loaded.id) if open_renames else loaded.links  # rows and harness wires
        review_rows = sorted({rid for review in loaded.open_reviews for item in review["items"]
                              for rid in item["row_ids"]})
        system = loaded.system
        return {
            "system": dict(system),
            "instances": instance_docs,
            "links": link_docs,
            "exports": export_docs,
            "harnesses": harness_docs,
            # P2 §23: open net rename proposals, with the rows each covers.
            "renames": [rename_doc(r, len(renames_module.covered(drift_rows, r["instance_id"], r["net"])))
                        for r in open_renames],
            "sceneKey": scene_key,
            "netsKey": _digest({
                "instances": [[i["id"], i.get("baseline_commit"), i.get("catalog_revision_id")] for i in all_instances],
                "links": [[link["id"], _end_key(link["a"]), _end_key(link["b"]),
                           sorted(([r.get("pinA"), r.get("pinB"), r.get("netA"), r.get("netB"),
                                    (r.get("observedA") or {}).get("nets"), (r.get("observedB") or {}).get("nets")]
                                   for r in link.get("rows") or ()), key=lambda row: (str(row[0]), str(row[1])))]
                          for link in link_docs],
                "exports": [[e["id"], e.get("instanceId"), e.get("portKey"), e.get("childExportId")] for e in export_docs],
                "harnesses": harness_docs,
            }),
            "openReviewCount": system["openReviewCount"],
            "findingCounts": report["counts"],
            "validation": report,
            "reviewRowIds": review_rows,
        }

    def _mate_catalog(self, loaded: LoadedSystem) -> Optional[validation.MateCatalog]:
        """The catalog's parts and mates-with pairs for SYS-V18; None with nothing to look up or when
        the catalog (a separate service) cannot be read: the findings then wait for it."""
        mpns = validation.mate_mpns(loaded.links, loaded.harnesses, loaded.interfaces)
        if not mpns:
            return None
        try:
            catalog = self._catalog()
            parts = catalog.parts_by_mpn(mpns)
            pairs = catalog.mate_pairs(validation.mate_parts(loaded.links, loaded.harnesses, loaded.interfaces, parts))
        except Exception:
            logger.exception("Could not read catalog mates for SYS-V18")
            return None
        return validation.MateCatalog(parts, pairs)

    @staticmethod
    def _record_counts(loaded: LoadedSystem, built: Mapping[str, Any]) -> None:
        """SB2-101: the counts of this version for the systems list. Kept on every path that builds
        the document, as before AC-16 (DECISIONS.md: whether reads should write this is open)."""
        loaded.rows.record_finding_counts(loaded.id, loaded.version, built["findingCounts"])

    def _built(self, loaded: LoadedSystem) -> dict:
        built = self._build(loaded)
        self._record_counts(loaded, built)
        return built

    # The reader exit: every read returns the document or its report through these, redacted for the
    # caller by today's access (§8.2, P2 §5.4). The unredacted ``_build`` output is only frozen into
    # snapshots (and compared, redacted with both sides' restrictions, in diffs).

    @staticmethod
    def _for_reader(loaded: LoadedSystem, caller: Caller, document: Mapping[str, Any]) -> dict:
        return redaction.redact_document(document, loaded.restricted(caller))

    @staticmethod
    def _report_for_reader(loaded: LoadedSystem, caller: Caller, report: Mapping[str, Any]) -> dict:
        return redaction.redact_findings(report, loaded.restricted(caller))

    def _loaded_board_total(self, loaded: LoadedSystem) -> Optional[int]:
        """``_board_total`` from the loaded tree."""
        if not loaded.system.get("subsystemCount"):
            return int(loaded.system.get("instanceCount") or 0)
        try:
            return len(loaded.tree.boards)
        except Invalid:
            return None

    def document(self, caller: Caller, system_id: str, *, include_validation: bool = False) -> Result:
        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            built = self._built(loaded)
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
            report = self._report_for_reader(loaded, caller, self._built(loaded)["validation"])
        return Result(report, system_id, loaded.version)

    def _reader_report(self, caller: Caller, system_id: str, version: int) -> dict:
        """The reader's report at ``version`` from one consistent read without the lock (SB2-94)."""
        with self._tx(consistent=True) as store:
            loaded = self._load(store, system_id, caller)
            if int(loaded.version) != int(version):
                raise StaleVersion(int(loaded.version), system_id)
            return self._report_for_reader(loaded, caller, self._built(loaded)["validation"])

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

    @staticmethod
    def _interface_state(interface: Optional[dict], job: Optional[dict]) -> dict:
        if interface is not None:
            return {"status": "ready", "digest": interface["digest"], "hasPcb": interface["hasPcb"],
                    "jobId": None, "errorCode": None}
        if job is not None and job["status"] in ("failed", "cancelled"):
            return {"status": "failed", "digest": None, "hasPcb": None,
                    "jobId": str(job["id"]), "errorCode": job["error_code"] or "extraction_failed"}
        return {"status": "pending", "digest": None, "hasPcb": None,
                "jobId": str(job["id"]) if job else None, "errorCode": None}

    def _instance_doc(
        self, instance: dict, access: Optional[dict], interface: Optional[dict],
        overrides: Mapping[str, str], job: Optional[dict],
    ) -> dict:
        tip = instance["tip_commit"]
        return {
            "id": instance["id"],
            "label": instance["label"],
            "restricted": False,
            "projectId": instance["project_id"],
            "projectName": access["name"] if access else None,
            # Not sensitive, and survives redaction: tells a designer the board can be removed.
            "projectDeleted": bool(access and access["deleted"]),
            "baselineCommit": instance["baseline_commit"],
            "trackedRef": instance["tracked_ref"],
            "pinned": instance["pinned"],
            "resolution": instance["resolution"],
            "tipCommit": tip,
            "tipCheckedAt": _iso(instance["tip_checked_at"]),
            "updateAvailable": bool(tip) and tip != instance["baseline_commit"],
            "interface": self._interface_state(interface, job),
            # Exposed ports plus any the user overrode; the full list is GET …/interface.
            "ports": None if interface is None else [
                port for port in exposure.resolve_ports(interface, overrides)
                if port["exposed"] or port["override"] is not None
            ],
        }

    @staticmethod
    def _observed(pin: Optional[dict]) -> Optional[dict]:
        if pin is None:
            return {"present": False, "nets": None, "pcbNets": None, "pinNames": None, "pinTypes": None}
        return {"present": True, "nets": pin["nets"], "pcbNets": pin.get("pcbNets"),
                "pinNames": pin.get("pinNames"), "pinTypes": pin.get("pinTypes")}

    def _link_doc(
        self, link: dict, interfaces: Mapping[str, dict], overrides: Mapping[str, Mapping[str, str]],
        mating: Optional[Mapping[str, Mapping[str, dict]]] = None,
        subports: Optional[Mapping[str, Mapping[str, Any]]] = None,
    ) -> dict:
        ends: dict[str, dict] = {}
        pins: dict[str, Optional[dict]] = {}
        for end in ("a", "b"):
            instance_id = link[f"{end}_instance_id"]
            port = dict(link[f"{end}_port"])
            interface = interfaces.get(instance_id)
            component = exposure.component_by_key(interface, port["portKey"]) if interface else None
            ends[end] = {
                "instanceId": instance_id,
                "redacted": False,
                "port": port,
                # An end on a subsystem's export: where it lands inside the child (P2 §6.1).
                "export": dict(component["export"]) if component and component.get("export") else None,
                "resolved": None if interface is None else component is not None,
                "exposed": None if component is None else exposure.is_exposed(
                    component, overrides.get(instance_id, {}).get(component["portKey"])
                ),
                # The port's stored mating frame (CONTRACTS_P2 §15.2), for the ICD's board-to-board table.
                "mating": _mating_summary(((mating or {}).get(instance_id) or {}).get(port["portKey"])),
                # P2 §22: the sub-port this end lands on; null for a whole connector or its remainder.
                "subport": _end_subport(link.get(f"{end}_subport_id"), subports),
            }
            pins[end] = exposure.pins_by_pad(component) if component is not None else None

        rows = []
        for row in link["rows"]:
            doc: dict[str, Any] = {"id": row["id"], "signal": row["signal"], "source": row["source"]}
            for end, column in (("a", "A"), ("b", "B")):
                pad = row[f"pin_{end}"]
                doc[f"pin{column}"] = pad
                doc[f"net{column}"] = list(row[f"net_{end}"])
                doc[f"observed{column}"] = (
                    None if pins[end] is None else self._observed(pins[end].get(pad))
                )
            doc["redacted"] = False
            doc["redactedEnds"] = []
            rows.append(doc)
        return {
            "id": link["id"],
            "name": link["name"],
            "harness": link["harness"],
            "type": link.get("type") or "unspecified",
            "stackHeightMm": link.get("stack_height_mm"),
            "a": ends["a"],
            "b": ends["b"],
            "rows": rows,
            "updatedAt": _iso(link["updated_at"]),
        }

    @staticmethod
    def _export_doc(export: Mapping[str, Any], interfaces: Mapping[str, dict],
                    overrides: Mapping[str, Mapping[str, str]],
                    subports: Optional[Mapping[str, Mapping[str, Any]]] = None) -> dict:
        port = export["target_port"]
        iid = export["target_instance_id"]
        if port:
            component = exports_module.resolve(interfaces.get(iid), port)
            exposed = None if component is None else exposure.is_exposed(
                component, overrides.get(iid, {}).get(component["portKey"]))
        else:  # a re-export resolves when the pinned revision still exports it
            component = exposure.component_by_key(interfaces[iid], export["target_export_id"] or "") \
                if interfaces.get(iid) else None
            exposed = component is not None
        return {
            "id": export["id"], "name": export["name"], "description": export["description"],
            "instanceId": iid, "portKey": port["portKey"] if port else None,
            "port": dict(port) if port else None, "childExportId": export["target_export_id"],
            "resolved": None if iid not in interfaces else (component is not None and bool(exposed)),
            "redacted": False, "updatedAt": _iso(export["updated_at"]),
            # P2 §22.2: the sub-port it publishes; null for a whole connector or a remainder.
            "subportId": export.get("target_subport_id"),
            "subport": _end_subport(export.get("target_subport_id"), subports),
        }

    # ------------------------------------------------------------------
    # Exports (CONTRACTS_P2 §4)

    def _export_port(self, store: SystemStore, system_id: str, instance_id: str, port_key: str,
                     caller: Caller) -> dict:
        """The port baseline of an exposed board port at its baseline."""
        instance = self._open_instance(store, system_id, instance_id, caller)
        interface = self._interface(store, instance)
        component = exposure.component_by_key(interface, port_key)
        if component is None:
            raise Invalid("portKey is not a component of this board at its baseline")
        override = store.list_overrides(instance_id).get(component["portKey"])
        if not exposure.is_exposed(component, override):
            raise Conflict("port_not_exposed: this port is not exposed on its board")
        return exposure.port_baseline(component)

    def list_exports(self, caller: Caller, system_id: str) -> list[dict]:
        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            return self._for_reader(loaded, caller, self._built(loaded))["exports"]

    def create_export(
        self, caller: Caller, system_id: str, version: int, *, name: str, description: str,
        instance_id: str, port_key: Optional[str], child_export_id: Optional[str],
        subport_id: Optional[str] = None,
    ) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                if port_key is not None:
                    port = self._export_port(store, system_id, instance_id, port_key, caller)
                    self._require_subport(store, system_id, instance_id, port, subport_id)
                    row = store.create_export(change, name=name, description=description,
                                              instance_id=instance_id, port=port, subport_id=subport_id)
                else:
                    instance = self._open_instance(store, system_id, instance_id, caller)
                    if instance.get("kind") != "assembly":
                        raise Invalid("a re-export needs an assembly instance")
                    component = exposure.component_by_key(self._interface(store, instance), child_export_id or "")
                    if component is None:
                        raise Invalid("childExportId is not an export of this subsystem's revision")
                    self._require_subport(store, system_id, instance_id, exposure.port_baseline(component), subport_id)
                    row = store.create_export(change, name=name, description=description,
                                              instance_id=instance_id, child_export_id=child_export_id,
                                              subport_id=subport_id)
        return Result(self._export_body(caller, system_id, row["id"]), system_id, change.version)

    def create_exports(self, caller: Caller, system_id: str, version: int, items: Sequence[Mapping[str, Any]]) -> Result:
        """SB2-121: export several ports in one version. Each item is ``{name, description, instanceId, portKey,
        subportId?}``; the first refusal names its item and rolls the whole batch back."""
        if not items or len(items) > MAX_EXPORTS:
            raise Invalid(f"export 1 to {MAX_EXPORTS} ports at once")
        ids: list[str] = []
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                for item in items:
                    try:
                        port = self._export_port(store, system_id, item["instanceId"], item["portKey"], caller)
                        self._require_subport(store, system_id, item["instanceId"], port, item.get("subportId"))
                        ids.append(store.create_export(change, name=item["name"], description=item.get("description") or "",
                                                       instance_id=item["instanceId"], port=port,
                                                       subport_id=item.get("subportId"))["id"])
                    except (Invalid, Conflict, NotFound) as problem:
                        raise type(problem)(f"{item['name']}: {problem}") from problem
        return Result({"exports": self._export_entries(caller, system_id, ids)}, system_id, change.version)

    @staticmethod
    def _require_subport(store: SystemStore, system_id: str, instance_id: str, port: Mapping[str, Any],
                         subport_id: Optional[str]) -> None:
        if subport_id is not None and subport_id not in {
                s["id"] for s in subports_module.on_connector(store.list_subports(system_id), instance_id, port)}:
            raise Invalid("subportId is not a sub-port of this connector")

    def update_export(
        self, caller: Caller, system_id: str, version: int, export_id: str, fields: Mapping[str, Any],
    ) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                export = self._visible_export(store, system_id, export_id, caller)
                if "name" in fields or "description" in fields:
                    store.update_export(change, export_id, name=fields.get("name"),
                                        description=fields.get("description"))
                if fields.get("portKey") is not None:
                    instance_id = fields.get("instanceId") or export["target_instance_id"]
                    port = self._export_port(store, system_id, instance_id, fields["portKey"], caller)
                    store.retarget_export(change, export_id, instance_id=instance_id, port=port)
        return Result(self._export_body(caller, system_id, export_id), system_id, change.version)

    def delete_export(self, caller: Caller, system_id: str, version: int, export_id: str) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._visible_export(store, system_id, export_id, caller)
                store.delete_export(change, export_id)
        return Result(None, system_id, change.version)

    def _visible_export(self, store: SystemStore, system_id: str, export_id: str, caller: Caller) -> dict:
        export = store.get_export(system_id, export_id)
        try:
            self._open_instance(store, system_id, export["target_instance_id"], caller)
        except NotFound:
            raise NotFound("Export not found") from None
        return export

    def _export_body(self, caller: Caller, system_id: str, export_id: str) -> dict:
        """The export as the document shows it, read after the change commits (SB2-94: a document
        build under the system lock queued every other editor behind it)."""
        found = self._export_entries(caller, system_id, [export_id])
        if not found:  # deleted by another editor in between
            raise NotFound("Export not found")
        return found[0]

    def _export_entries(self, caller: Caller, system_id: str, export_ids: Sequence[str]) -> list[dict]:
        """The document's entries for ``export_ids``, redacted for the reader, without building the whole
        document. IDs deleted in between are left out."""
        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            restricted = loaded.restricted(caller)
            subports_by_id = {row["id"]: row for row in loaded.subports}
            out = []
            for export_id in export_ids:
                try:
                    export = store.get_export(system_id, export_id)
                except NotFound:
                    continue
                iid = export["target_instance_id"]
                interface = loaded.interface(iid)
                interfaces = {} if interface is None else {iid: interface}
                overrides = {iid: loaded.overrides[iid]} if interface is not None and iid in loaded.overrides else {}
                out.append(redaction.redact_export(self._export_doc(export, interfaces, overrides, subports_by_id),
                                                   restricted))
        return out

    def export_interface(self, caller: Caller, system_id: str, snapshot_id: Optional[str] = None) -> dict:
        """``GET …/export-interface`` (P2 §4.3), live or at a snapshot, redacted for the reader."""

        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            if snapshot_id is None:
                instances = {i["id"]: i for i in loaded.boards}
                children = {i["id"]: i for i in loaded.children}
                exports = loaded.exports
                restricted = loaded.restricted(caller)
                subport_rows = loaded.subports
            else:
                row = store.get_snapshot(system_id, snapshot_id)
                if row["manifest"] is None:
                    raise NotFound("This snapshot predates manifests")
                manifest = row["manifest"]
                instances = {i["id"]: {"id": i["id"], "project_id": i["projectId"],
                                       "baseline_commit": i["baselineCommit"]}
                             for i in manifest["instances"] if i["kind"] == "board"}
                children = {i["id"]: {"id": i["id"], "kind": i["kind"], "catalog_revision_id": i["catalog"]["revisionId"]}
                            for i in manifest["instances"] if i["kind"] != "board"}
                exports = [{"id": e["id"], "name": e["name"], "description": e["description"],
                            "target_instance_id": e["target"]["instanceId"],
                            "target_port": e["target"].get("port"),
                            "target_export_id": e["target"].get("exportId"),
                            "target_subport_id": e["target"].get("subportId")} for e in manifest["exports"]]
                restricted = self._restricted_in(store, row["document"], caller)
                subport_rows = [{"id": sp["id"], "instance_id": i["id"], "port_key": sp["portKey"],
                                 "port": {"portKey": sp["portKey"], "memberKeys": [sp["portKey"]]},
                                 "name": sp["name"], "pads": sp["pads"]}
                                for i in manifest["instances"] for sp in i.get("subports") or []]
            interfaces = {iid: store.get_interface(i["project_id"], i["baseline_commit"], EXTRACTOR_VERSION)
                          for iid, i in instances.items()}
            for iid, child in children.items():
                interfaces[iid] = self._instance_interface(store, child)
            overrides = ({iid: store.list_overrides(iid) for iid in instances} if snapshot_id is None else
                         {i["id"]: {o["portKey"]: o["state"] for o in i.get("portOverrides", [])}
                          for i in manifest["instances"] if i["kind"] == "board"})
        missing = [iid for e in exports for iid in [e["target_instance_id"]]
                   if iid in instances and interfaces.get(iid) is None]
        if missing:
            for iid in set(missing):
                self._enqueue_quietly(instances[iid]["project_id"], instances[iid]["baseline_commit"], caller)
            raise Conflict("interface_not_ready: a board behind an export is still being extracted")
        body = exports_module.interface(exports, instances, interfaces, overrides, subport_rows)
        # A re-export resolves through the child's export to a board inside it; when that board is
        # hidden from the reader (or the export no longer resolves), so are its pins' nets (P2 §5.4).
        ports = redaction.hidden_ports(restricted)
        hidden_reexports = {e["id"] for e in exports if not e["target_port"]
                            and (e["target_instance_id"], e["target_export_id"]) in ports}
        for entry in body["exports"]:
            if entry["occurrence"].lstrip("/") in restricted or entry["id"] in hidden_reexports:
                entry.update({"reference": None, "libId": None, "footprint": None, "redacted": True,
                              "pins": [{"pad": p["pad"], "nets": None, "powerNet": None, "pinNames": None,
                                        "pinTypes": None} for p in entry["pins"]]})
        return body

    # ------------------------------------------------------------------
    # Instances

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

    @staticmethod
    def _instance_row(row: Mapping[str, Any]) -> dict:
        return {
            "id": row["id"], "label": row["label"], "kind": row.get("kind", "board"), "projectId": row["project_id"],
            "baselineCommit": row["baseline_commit"], "trackedRef": row["tracked_ref"],
            "pinned": row["pinned"], "resolution": row["resolution"],
            "tipCommit": row["tip_commit"], "tipCheckedAt": _iso(row["tip_checked_at"]),
            "catalogComponentId": row.get("catalog_component_id"), "catalogRevisionId": row.get("catalog_revision_id"),
            "follow": row.get("follow"),
        }


def _rounded_lengths(lengths: Mapping[str, Any]) -> dict:
    """§17.10 lengths for documents and the ICD, to 0.1 mm."""
    return {"bundleMm": round(lengths["bundleMm"], 1), "estimatedMm": round(lengths["estimatedMm"], 1),
            "allowancePct": round(lengths["allowancePct"], 2), "complete": lengths["complete"],
            "wires": {wire: {"lengthMm": round(v["lengthMm"], 1), "estimatedMm": round(v["estimatedMm"], 1)}
                      for wire, v in sorted(lengths["wires"].items())},
            "segments": [{**segment, "lengthMm": round(segment["lengthMm"], 1)} for segment in lengths.get("segments") or []]}


def _digest(value: Any) -> str:
    """A short, stable digest of JSON-able ``value`` (SB2-98 read keys)."""
    import hashlib
    import json

    return hashlib.sha1(json.dumps(value, sort_keys=True, default=_iso).encode()).hexdigest()[:16]


def _end_key(end: Mapping[str, Any]) -> list:
    """A link end's identity for the read keys: its instance and the port, export or sub-port it lands on."""
    key = [end.get("instanceId"), (end.get("port") or {}).get("portKey"), (end.get("export") or {}).get("id")]
    return key + [end["subport"]["id"]] if end.get("subport") else key


def _subport_entry(row: Mapping[str, Any]) -> dict:
    return {"id": row["id"], "portKey": row["port_key"], "name": row["name"], "pads": list(row["pads"])}


def _end_subport(subport_id: Optional[str], subports: Optional[Mapping[str, Mapping[str, Any]]]) -> Optional[dict]:
    if not subport_id:
        return None
    found = (subports or {}).get(subport_id)
    return {"id": subport_id, "name": found["name"] if found else None}


def rename_doc(rename: Mapping[str, Any], rows: Optional[int] = None) -> dict:
    """A net rename proposal as documents and the board page show it (P2 §23.1)."""
    return {"id": rename["id"], "instanceId": rename["instance_id"], "net": rename["net"], "name": rename["name"],
            "note": rename["note"], "state": rename["state"], "rows": rows, "createdBy": rename["created_by"],
            "createdAt": _iso(rename["created_at"]), "closedBy": rename.get("closed_by"),
            "closedAt": _iso(rename.get("closed_at")), "closedCommit": rename.get("closed_commit")}
