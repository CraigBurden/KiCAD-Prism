"""Exports (CONTRACTS_P2 §4): the ports a system offers its parents, and its export interface."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from app.services.systems import exports as exports_module, exposure, redaction, links as link_rules
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.service_base import Caller, Result
from app.services.systems.store import Conflict, Invalid, NotFound, SystemStore
from app.services.systems.store_base import MAX_EXPORTS


class ExportsMixin:
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
        if subport_id is not None:
            link_rules.check_subport(store.list_subports(system_id), instance_id, port, subport_id)

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
