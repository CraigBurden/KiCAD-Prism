"""The system document and the bodies writes answer with (§8.1).

``_build`` renders the unredacted document from a loaded system and runs ``validation.report``.
Reads never write; the systems list's finding counts (SB2-101) are refreshed after the writes that
change them (``refresh_finding_counts``, D12). The per-row renderers (instance, link, export, harness,
review) and the bodies a write returns (``_link_body``, ``_harness_body``) are shared by the concept
mixins; none of them redacts (the reader exits in ``service_reading`` do).
"""

from __future__ import annotations

from typing import Any, Collection, Iterable, Mapping, Optional

from app.services.systems import (
    drift, exposure, redaction, validation, exports as exports_module, harnesses as harnesses_module,
    renames as renames_module,
)
from app.services.systems.jobs import artifact_key
from app.services.systems.loaded import LoadedSystem
from app.services.systems.service_base import Caller, _iso, _mating_summary, logger
from app.services.systems.store import Invalid, NotFound, SystemStore

COUNTER = Caller(role="admin", email="system:finding-counts")


class RenderingCore:
    # ------------------------------------------------------------------
    # The document

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

    # ------------------------------------------------------------------
    # The systems list's finding counts (SB2-101, D12): written by write paths, read by the list

    def refresh_finding_counts(self, system_ids: Iterable[str]) -> None:
        """Build each system from one consistent read and store its counts at that version.

        Runs after the write committed, so outside the system lock; best effort: a failure is logged
        and the list shows no counts for that version until the next write."""
        for system_id in dict.fromkeys(system_ids):
            try:
                with self._tx(consistent=True) as store:
                    loaded = self._load(store, system_id, COUNTER)
                    store.record_finding_counts(system_id, loaded.version, self._build(loaded)["findingCounts"])
            except NotFound:
                continue  # deleted meanwhile
            except Exception:
                logger.exception("Could not refresh the finding counts of system %s", system_id)

    def refresh_stale_counts(self, *, system_ids: Iterable[str] = (), instance_ids: Iterable[str] = ()) -> None:
        """For writers outside this service (source checks, git sync): refresh the systems they may have
        changed whose counts are not of their current version."""
        try:
            with self._tx() as store:
                stale = store.stale_counts(list(system_ids), list(instance_ids))
        except Exception:
            logger.exception("Could not read which finding counts are stale")
            return
        self.refresh_finding_counts(stale)

    def refresh_counts_for_interface(self, project_id: str, commit: str) -> None:
        """A board interface was stored: the findings of every system with a board at that baseline
        change at the same version."""
        try:
            with self._tx() as store:
                system_ids = store.systems_at_baseline(project_id, commit)
        except Exception:
            logger.exception("Could not read the systems at %s@%s", project_id, commit)
            return
        self.refresh_finding_counts(system_ids)

    def _loaded_board_total(self, loaded: LoadedSystem) -> Optional[int]:
        """``_board_total`` from the loaded tree."""
        if not loaded.system.get("subsystemCount"):
            return int(loaded.system.get("instanceCount") or 0)
        try:
            return len(loaded.tree.boards)
        except Invalid:
            return None

    # ------------------------------------------------------------------
    # Rows as the document shows them

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
    def _instance_row(row: Mapping[str, Any]) -> dict:
        return {
            "id": row["id"], "label": row["label"], "kind": row.get("kind", "board"), "projectId": row["project_id"],
            "baselineCommit": row["baseline_commit"], "trackedRef": row["tracked_ref"],
            "pinned": row["pinned"], "resolution": row["resolution"],
            "tipCommit": row["tip_commit"], "tipCheckedAt": _iso(row["tip_checked_at"]),
            "catalogComponentId": row.get("catalog_component_id"), "catalogRevisionId": row.get("catalog_revision_id"),
            "follow": row.get("follow"),
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

    @staticmethod
    def _harness_doc(harness: Mapping[str, Any], components: Mapping[str, Optional[dict]]) -> dict:
        ends = []
        for end in harness["ends"]:
            component = components.get(end["id"])
            mates = None
            if end["mates_instance_id"] and end["mates_port"]:
                mates = {"instanceId": end["mates_instance_id"], "portKey": end["mates_port"]["portKey"],
                         "port": dict(end["mates_port"]), "redacted": False,
                         "resolved": None if end["id"] not in components else component is not None}
            ends.append({
                "id": end["id"], "ordinal": end["ordinal"], "mates": mates,
                "part": harnesses_module.part_ref(end),
                "contact": harnesses_module.contact_ref(end),
                "pinCount": end["pin_count"], "pinMap": end["pin_map"], "bootMm": end["boot_mm"],
                "pins": harnesses_module.end_pins(end, component),
                # The mated connector's pads, for the pin map (SB2-18).
                "matePads": sorted(exposure.pins_by_pad(component), key=drift.pad_sort_key) if component else [],
            })
        wires = [{
            "id": wire["id"], "from": {"end": wire["from_end"], "pin": wire["from_pin"]},
            "to": {"end": wire["to_end"], "pin": wire["to_pin"]}, "signal": wire["signal"],
            "gaugeAwg": wire["gauge_awg"], "colour": wire["colour"], "label": wire["label"],
            "netFrom": list(wire["net_from"]), "netTo": list(wire["net_to"]), "redactedEnds": [],
        } for wire in harness["wires"]]
        return {"id": harness["id"], "name": harness["name"], "label": harness["label"],
                "cutLengthMm": harness["cut_length_mm"], "serviceAllowancePct": harness["service_allowance_pct"],
                "linkable": harnesses_module.is_linkable(harness), "ends": ends, "wires": wires,
                "nodes": [dict(node) for node in harness.get("nodes", [])],
                "coverings": harnesses_module.covering_docs(harness),
                "updatedAt": _iso(harness["updated_at"])}

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

    # ------------------------------------------------------------------
    # Write bodies

    def _link_body(self, store: SystemStore, system_id: str, link_id: str) -> dict:
        instances = store.list_instances(system_id, kinds=SystemStore.ALL_KINDS)
        link = store.get_link(system_id, link_id)
        interfaces: dict[str, dict] = {}
        overrides: dict[str, dict] = {}
        for instance in instances:
            if instance["id"] in (link["a_instance_id"], link["b_instance_id"]):
                found = self._instance_interface(store, instance)
                if found is not None:
                    interfaces[instance["id"]] = found
                    overrides[instance["id"]] = store.list_overrides(instance["id"])
        return self._link_doc(link, interfaces, overrides, {
            iid: store.list_mating(iid) for iid in {link["a_instance_id"], link["b_instance_id"]}},
            {row["id"]: row for row in store.list_subports(system_id)})

    def _harness_body(self, store: SystemStore, system_id: str, harness_id: str, caller: Caller) -> dict:
        harness = store.get_harness(system_id, harness_id)
        body = self._harness_doc(harness, self._end_components(store, harness))
        return redaction.redact_harness(body, self._restricted_instances(store, system_id, caller))


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

