"""Mating frames, poses, harnesses, links and rows (CONTRACTS_P2 §14, §15, §17)."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from app.services.systems import (
    drift, exposure, generators, harnesses as harnesses_module, mating as mating_module, modules, redaction,
    subports as subports_module,
)
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.placement import poses as placement_poses
from app.services.systems.store import Conflict, Invalid, NotFound, SystemStore
from app.services.systems.service_base import Caller, Result, _iso

MAX_COVERINGS = 64  # per harness (§26.1)


class HarnessesMixin:
    # ------------------------------------------------------------------
    # Mating frames (CONTRACTS_P2 §15)

    def _mating_board(self, store: SystemStore, system_id: str, instance_id: str, caller: Caller) -> tuple[dict, dict]:
        instance = self._open_instance(store, system_id, instance_id, caller)
        if instance.get("kind") == "module":
            raise Invalid("a module's connector frames come from its connector placement in the catalog (§3.6)")
        if instance.get("kind", "board") != "board":
            raise Invalid("a subsystem's connector frames are frozen in its snapshot; change them in the child system")
        return instance, self._interface(store, instance)

    def mating(self, caller: Caller, system_id: str, instance_id: str) -> dict:
        """``GET …/instances/{iid}/mating``: every exposed port's inference and stored frame."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            _instance, interface = self._mating_board(store, system_id, instance_id, caller)
            stored = store.list_mating(instance_id)
            overrides = store.list_overrides(instance_id)
        exposed = {p["portKey"] for p in exposure.resolve_ports(interface, overrides) if p["exposed"]}
        ports = [mating_module.port_state(component, stored.get(component["portKey"]))
                 for component in interface.get("components") or [] if component["portKey"] in exposed]
        return {"instanceId": instance_id, "boardThicknessMm": interface.get("boardThicknessMm"), "ports": ports}

    def link_mate(self, caller: Caller, system_id: str, link_id: str) -> dict:
        """``GET …/links/{lid}/mate`` (SB2-39): both connectors of a B2B link with their v6 geometry and
        frames, so the browser can preview the mated pair with the placement library while a frame is picked."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            link = store.get_link(system_id, link_id)
            if link.get("type") != "b2b":
                raise Invalid("only a board-to-board link has a mate")
            ends = {}
            for end in ("a", "b"):
                instance_id, port = link[f"{end}_instance_id"], link[f"{end}_port"]
                instance = self._open_instance(store, system_id, instance_id, caller)
                entry = {"instanceId": instance_id, "kind": instance.get("kind", "board"),
                         "portKey": port["portKey"], "reference": port.get("reference") or "",
                         "geometry": None, "thicknessMm": None, "inferred": None, "stored": None}
                if entry["kind"] == "board" and instance.get("project_id") and instance.get("baseline_commit"):
                    component = store.get_interface_component(instance["project_id"], instance["baseline_commit"],
                                                              EXTRACTOR_VERSION, port["portKey"])
                    if component is not None:
                        record = store.list_mating(instance_id).get(port["portKey"])
                        state = mating_module.port_state(component, record)
                        entry.update(geometry=component.get("geometry"), thicknessMm=component.get("boardThicknessMm"),
                                     inferred=state["inferred"], stored=state["stored"])
                elif entry["kind"] == "module":
                    component = modules.component(self._interface(store, instance), port["portKey"])
                    if component is not None and component.get("geometry"):
                        entry.update(geometry=component["geometry"], thicknessMm=0.0, stored=component["matingFrame"])
                ends[end] = entry
        return {"linkId": link_id, "stackHeightMm": link.get("stack_height_mm"), **ends}

    def placement(self, caller: Caller, system_id: str) -> dict:
        """``GET …/placement`` (SB2-39): the root level's solve (§14.9), by instance ID, without the scene's
        bundle reads (which can queue builds)."""
        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            version = int(loaded.version)
            solved = loaded.placement["results"].get("")
            chosen = loaded.driving

        def iid(path: str) -> str:
            return path.rsplit("/", 1)[-1]

        out = {"systemId": system_id, "version": version, "roots": [], "driving": {}, "mismatches": [],
               "unusable": [], "ignoredOverrides": [], "drivingMates": chosen}
        if solved:
            out.update(
                roots=[iid(p) for p in solved["roots"]],
                driving={iid(p): {"linkId": e["linkId"], "from": iid(e["from"]), "overridden": e["overridden"]}
                         for p, e in solved["driving"].items()},
                mismatches=solved["mismatches"], unusable=solved["unusable"],
                ignoredOverrides=[{**o, "member": iid(o["member"])} for o in solved["ignoredOverrides"]])
        return out

    def set_mating(
        self, caller: Caller, system_id: str, version: int, instance_id: str, port_key: str,
        fields: Optional[Mapping[str, Any]],
    ) -> Result:
        """``PUT`` (``fields``) or ``DELETE`` (``None``) one port's stored frame."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                _instance, interface = self._mating_board(store, system_id, instance_id, caller)
                component = exposure.component_by_key(interface, port_key)
                if component is None or component["portKey"] != port_key:
                    raise Invalid("portKey is not a component of this board at its baseline")
                record = None if fields is None else mating_module.record_for(
                    component, fields.get("mode"), fields.get("axis"), fields.get("quarterTurns"))
                store.set_mating(change, instance_id, port_key, record)
                body = mating_module.port_state(component, store.list_mating(instance_id).get(port_key))
        return Result(body, system_id, change.version)

    # ------------------------------------------------------------------
    # Poses (CONTRACTS_P2 §14.3)

    def poses(self, caller: Caller, system_id: str) -> dict:
        """``GET …/poses``: the stored poses of this system's own instances. An instance
        not listed takes its default pose (the scene shows where that is)."""
        with self._tx() as store:
            version = int(self._system(store, system_id, caller)["version"])
            stored = store.list_poses(system_id)
        return {"systemId": system_id, "version": version,
                "poses": [{"instanceId": key, **value} for key, value in stored.items()]}

    def set_pose(
        self, caller: Caller, system_id: str, version: int, instance_id: str,
        fields: Optional[Mapping[str, Any]],
    ) -> Result:
        """``PUT`` (``fields``: ``translationMm``, ``rotation``) or ``DELETE`` (``None``) one
        instance's pose. Users store ``manual`` poses; the solve (M4) stores ``auto`` ones."""
        if fields is None:
            pose = None
        else:
            try:
                pose = {**placement_poses.pose_from(fields["translationMm"], fields["rotation"]), "source": "manual"}
            except ValueError as error:
                raise Invalid(str(error)) from error
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                store.set_pose(change, instance_id, pose)
                stored = store.list_poses(system_id).get(instance_id)
        body = {"instanceId": instance_id, **stored} if stored else {"instanceId": instance_id, "source": "default"}
        return Result(body, system_id, change.version)

    def driving_mates(self, caller: Caller, system_id: str) -> dict:
        """``GET …/driving-mates``: the user's driving mate choices (§14.9); the scene shows the ones in use."""
        with self._tx() as store:
            version = int(self._system(store, system_id, caller)["version"])
            chosen = store.list_driving_mates(system_id)
        return {"systemId": system_id, "version": version,
                "drivingMates": [{"instanceId": key, "linkId": value} for key, value in chosen.items()]}

    def set_driving_mate(self, caller: Caller, system_id: str, version: int, instance_id: str,
                         link_id: Optional[str]) -> Result:
        """``PUT`` (a B2B link of the instance) or ``DELETE`` (``None``, back to the solve's pick)."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                store.set_driving_mate(change, instance_id, link_id)
                chosen = store.list_driving_mates(system_id).get(instance_id)
        return Result({"instanceId": instance_id, "linkId": chosen}, system_id, change.version)

    def set_poses(self, caller: Caller, system_id: str, version: int, poses: Sequence[Mapping[str, Any]],
                  clear: Sequence[str] = ()) -> Result:
        """``PATCH …/poses`` (SB2-38): store several manual poses and clear others in one change, so a
        stack moved together (or put back) is one version and never half saved."""
        if not poses and not clear:
            raise Invalid("nothing to change: give poses or clear")
        ids = [p["instanceId"] for p in poses] + list(clear)
        if len(set(ids)) != len(ids):
            raise Invalid("each instance may appear once")
        try:
            stored = [(p["instanceId"], {**placement_poses.pose_from(p["translationMm"], p["rotation"]), "source": "manual"})
                      for p in poses]
        except ValueError as error:
            raise Invalid(str(error)) from error
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                for instance_id, pose in stored:
                    store.set_pose(change, instance_id, pose)
                for instance_id in clear:
                    store.set_pose(change, instance_id, None)
                now = store.list_poses(system_id)
        body = {"poses": [{"instanceId": i, **now[i]} if i in now else {"instanceId": i, "source": "default"} for i in ids]}
        return Result(body, system_id, change.version)

    def reset_poses(self, caller: Caller, system_id: str, version: int) -> Result:
        """``DELETE …/poses``: every manual pose goes back to its default (D-P2-14)."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                reset = store.reset_poses(change)
        return Result({"reset": reset}, system_id, change.version)

    # ------------------------------------------------------------------
    # Harnesses (CONTRACTS_P2 §17)

    def _end_components(self, store: SystemStore, harness: Mapping[str, Any],
                        interfaces: Optional[Mapping[str, dict]] = None) -> dict[str, Optional[dict]]:
        """``end ID -> mated component`` (None when it no longer resolves). Ends whose board
        interface is not extracted yet, and unmated ends, are left out."""
        if interfaces is None:
            interfaces = {end["mates_instance_id"]: self._instance_interface(
                store, store.get_instance(harness["system_id"], end["mates_instance_id"]))
                for end in harness["ends"] if end["mates_instance_id"] and end["mates_port"]}
        return harnesses_module.end_components(harness, interfaces)

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

    def _harness_body(self, store: SystemStore, system_id: str, harness_id: str, caller: Caller) -> dict:
        harness = store.get_harness(system_id, harness_id)
        body = self._harness_doc(harness, self._end_components(store, harness))
        return redaction.redact_harness(body, self._restricted_instances(store, system_id, caller))

    def _visible_harness(self, store: SystemStore, system_id: str, harness_id: str, caller: Caller) -> dict:
        harness = store.get_harness(system_id, harness_id)
        restricted = self._restricted_instances(store, system_id, caller)
        if any(end["mates_instance_id"] in restricted for end in harness["ends"]):
            raise NotFound("Harness not found")  # edits would touch a board the caller cannot see
        return harness

    def _mate(self, store: SystemStore, system_id: str, caller: Caller, mates: Mapping[str, str]) -> tuple[dict, dict]:
        """An exposed port for a harness end: ``(mates for the store, component)``."""
        instance = self._open_instance(store, system_id, mates["instanceId"], caller)
        interface = self._interface(store, instance)
        component = exposure.component_by_key(interface, mates["portKey"])
        if component is None:
            raise Invalid("portKey is not a component of this board at its baseline")
        override = store.list_overrides(instance["id"]).get(component["portKey"])
        if instance.get("kind", "board") == "board" and not exposure.is_exposed(component, override):
            raise Conflict("port is not exposed on this board")
        return {"instanceId": instance["id"], "port": exposure.port_baseline(component)}, component

    def list_harnesses(self, caller: Caller, system_id: str) -> list[dict]:
        with self._tx() as store:
            self._system(store, system_id, caller)
            return [self._harness_body(store, system_id, h["id"], caller) for h in store.list_harnesses(system_id)]

    def create_harness(self, caller: Caller, system_id: str, version: int, fields: Mapping[str, Any]) -> Result:
        """``POST …/harnesses``: ends mate ports or nothing; ``identity`` fills wires between two mated ends."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                harness = store.create_harness(change, name=fields.get("name") or "Harness", label=fields.get("label"))
                components = []
                for spec in fields.get("ends") or [{}]:
                    if spec and spec.get("instanceId"):
                        mates, component = self._mate(store, system_id, caller, spec)
                        harness = store.add_harness_end(change, harness["id"], mates_instance_id=mates["instanceId"],
                                                        mates_port=mates["port"], pin_count=max(1, len(component.get("pins") or [])))
                    else:
                        component = None
                        harness = store.add_harness_end(change, harness["id"], pin_count=int((spec or {}).get("pinCount") or 1))
                    components.append(component)
                if fields.get("identity"):
                    if len(harness["ends"]) != 2 or None in components:
                        raise Invalid("identity wires need exactly two mated ends")
                    self._write_wires(store, change, harness["id"], generators.generate(
                        "identity", harnesses_module.pin_facts(harness["ends"][0], components[0]),
                        harnesses_module.pin_facts(harness["ends"][1], components[1]), [], {})["rows"],
                        harness["ends"][0]["id"], harness["ends"][1]["id"])
                body = self._harness_body(store, system_id, harness["id"], caller)
        return Result(body, system_id, change.version)

    def _write_wires(self, store: SystemStore, change: Any, harness_id: str, rows: Sequence[Mapping[str, Any]],
                     end_a: str, end_b: str, *, keep: Sequence[Mapping[str, Any]] = ()) -> None:
        """Append generated row-shaped pairs as wires from ``end_a`` to ``end_b``."""
        wires = list(keep) + [{"from": {"end": end_a, "pin": row["pinA"]}, "to": {"end": end_b, "pin": row["pinB"]},
                               "signal": row.get("signal") or ""} for row in rows]
        self._replace_wires_in(store, change, harness_id, wires)

    def _replace_wires_in(self, store: SystemStore, change: Any, harness_id: str,
                          wires: Sequence[Mapping[str, Any]], *, keep_new_ids: bool = False) -> None:
        harness = store.get_harness(change.system_id, harness_id)
        ends = {end["id"]: end for end in harness["ends"]}
        components = self._end_components(store, harness)
        for end in harness["ends"]:
            if end["mates_instance_id"] and end["id"] not in components:
                raise Conflict("interface_not_ready: a mated board's interface is still being extracted")
        store.replace_wires(change, harness_id, harnesses_module.capture(wires, ends, components),
                            keep_new_ids=keep_new_ids)

    def update_harness(self, caller: Caller, system_id: str, version: int, harness_id: str,
                       fields: Mapping[str, Any]) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._visible_harness(store, system_id, harness_id, caller)
                store.update_harness(change, harness_id, fields)
                body = self._harness_body(store, system_id, harness_id, caller)
        return Result(body, system_id, change.version)

    def delete_harness(self, caller: Caller, system_id: str, version: int, harness_id: str) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._visible_harness(store, system_id, harness_id, caller)
                store.delete_harness(change, harness_id)
        return Result(None, system_id, change.version)

    def add_harness_end(self, caller: Caller, system_id: str, version: int, harness_id: str,
                        fields: Mapping[str, Any]) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._visible_harness(store, system_id, harness_id, caller)
                if fields.get("instanceId"):
                    mates, component = self._mate(store, system_id, caller, fields)
                    store.add_harness_end(change, harness_id, mates_instance_id=mates["instanceId"], mates_port=mates["port"],
                                          pin_count=max(1, len(component.get("pins") or [])))
                else:
                    store.add_harness_end(change, harness_id, pin_count=int(fields.get("pinCount") or 1))
                body = self._harness_body(store, system_id, harness_id, caller)
        return Result(body, system_id, change.version)

    def update_harness_end(self, caller: Caller, system_id: str, version: int, harness_id: str, end_id: str,
                           fields: Mapping[str, Any]) -> Result:
        """Re-mate (``mates``: {instanceId, portKey} or null), ``pinMap``, ``bootMm``. Wire nets are recaptured."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                harness = self._visible_harness(store, system_id, harness_id, caller)
                update = {k: fields[k] for k in ("pinMap", "bootMm") if k in fields}
                if "part" in fields:
                    update.update(self._block_part(harness, end_id, fields["part"]))
                if "contact" in fields:
                    if not any(e["id"] == end_id for e in harness["ends"]):
                        raise NotFound("Harness end not found")
                    found = self._catalog_part(fields["contact"]) if fields["contact"] else None
                    update.update({"contactComponentId": found and found["componentId"],
                                   "contactRevisionId": found and found["revisionId"],
                                   "contactSummary": found and {k: found.get(k) or "" for k in harnesses_module.PART_SUMMARY}})
                if "mates" in fields:
                    if fields["mates"]:
                        mates, component = self._mate(store, system_id, caller, fields["mates"])
                        update["mates"] = mates
                        update["pinCount"] = max(1, len(component.get("pins") or []))
                    else:
                        update["mates"] = None
                store.update_harness_end(change, harness_id, end_id, update)
                wires = [self._wire_input(w) for w in store.get_harness(system_id, harness_id)["wires"]]
                if wires and ("mates" in update or "pinMap" in update or "partPins" in update):
                    self._replace_wires_in(store, change, harness_id, wires)
                body = self._harness_body(store, system_id, harness_id, caller)
        return Result(body, system_id, change.version)

    def _catalog_part(self, part: Mapping[str, Any]) -> dict:
        """An active catalog part by ``componentId``: summary and current revision (404/422 otherwise)."""
        try:
            return self._catalog().part_for_block(str(part.get("componentId") or ""))
        except LookupError:
            raise NotFound("Catalog part not found") from None
        except ValueError as error:
            raise Invalid(str(error)) from None

    def set_coverings(self, caller: Caller, system_id: str, version: int, harness_id: str,
                      coverings: Sequence[Mapping[str, Any]]) -> Result:
        """§26.1: replace the coverings ``[{segmentId, componentId?, description}]``."""
        if len(coverings) > MAX_COVERINGS:
            raise Invalid(f"limit coverings_per_harness ({MAX_COVERINGS})")
        rows = []
        for covering in coverings:
            segment = str(covering.get("segmentId") or "").strip()
            description = str(covering.get("description") or "").strip()
            if not segment:
                raise Invalid("a covering needs a segmentId")
            part = None
            if covering.get("componentId"):
                found = self._catalog_part({"componentId": covering["componentId"]})
                part = {"componentId": found["componentId"], "revisionId": found["revisionId"],
                        **{k: found.get(k) or "" for k in harnesses_module.PART_SUMMARY}}
            if part is None and not description:
                raise Invalid("a covering needs a part or a description")
            rows.append({"segmentId": segment, "part": part, "description": description[:200]})
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._visible_harness(store, system_id, harness_id, caller)
                store.set_coverings(change, harness_id, rows)
                body = self._harness_body(store, system_id, harness_id, caller)
        return Result(body, system_id, change.version)

    def _block_part(self, harness: Mapping[str, Any], end_id: str, part: Optional[Mapping[str, Any]]) -> dict:
        """§17.2 (SB2-18): a catalog part for the end's mating block, or ``None`` for Generic again.

        The part's pins replace the block's; pin-map entries for pins the part lacks are dropped, and
        wires on such pins refuse the change.
        """
        end = next((e for e in harness["ends"] if e["id"] == end_id), None)
        if end is None:
            raise NotFound("Harness end not found")
        if part is None:
            return {"catalogComponentId": None, "catalogRevisionId": None, "partPins": None, "partSummary": None,
                    "pinCount": max(1, int((end["mates_port"] or {}).get("pinCount") or end["pin_count"]))}
        try:
            found = self._catalog().part_for_block(str(part.get("componentId") or ""))
        except LookupError:
            raise NotFound("Catalog part not found") from None
        except ValueError as error:
            raise Invalid(str(error)) from None
        pins = found.get("pins")
        if not pins:
            raise Invalid("the part has no symbol or footprint pins to wire")
        wired = sorted({w[f"{side}_pin"] for w in harness["wires"] for side in ("from", "to")
                        if w[f"{side}_end"] == end_id} - set(pins), key=drift.pad_sort_key)
        if wired:
            raise Conflict(f"wires use pins {', '.join(wired)} that {found['mpn'] or found['name']} does not have; "
                           "remove or move those wires first")
        pin_map = {k: v for k, v in (end["pin_map"] or {}).items() if k in pins} or None
        return {"catalogComponentId": found["componentId"], "catalogRevisionId": found["revisionId"],
                "partPins": list(pins), "partSummary": {k: found.get(k) or "" for k in harnesses_module.PART_SUMMARY},
                "pinCount": len(pins), "pinMap": pin_map}

    def delete_harness_end(self, caller: Caller, system_id: str, version: int, harness_id: str, end_id: str) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._visible_harness(store, system_id, harness_id, caller)
                store.delete_harness_end(change, harness_id, end_id)
                body = self._harness_body(store, system_id, harness_id, caller)
        return Result(body, system_id, change.version)

    @staticmethod
    def _wire_input(wire: Mapping[str, Any]) -> dict:
        return {"id": wire["id"], "from": {"end": wire["from_end"], "pin": wire["from_pin"]},
                "to": {"end": wire["to_end"], "pin": wire["to_pin"]}, "signal": wire["signal"],
                "gaugeAwg": wire["gauge_awg"], "colour": wire["colour"], "label": wire["label"]}

    def replace_wires(self, caller: Caller, system_id: str, version: int, harness_id: str,
                      wires: Sequence[Mapping[str, Any]]) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._visible_harness(store, system_id, harness_id, caller)
                self._replace_wires_in(store, change, harness_id, wires)
                body = self._harness_body(store, system_id, harness_id, caller)
        return Result(body, system_id, change.version)

    def replace_nodes(self, caller: Caller, system_id: str, version: int, harness_id: str,
                      nodes: Sequence[Mapping[str, Any]]) -> Result:
        """``PUT …/harnesses/{hid}/nodes``: the harness's breakouts and waypoints (§17.9)."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._visible_harness(store, system_id, harness_id, caller)
                store.replace_nodes(change, harness_id, nodes)
                body = self._harness_body(store, system_id, harness_id, caller)
        return Result(body, system_id, change.version)

    def generate_wires(self, caller: Caller, system_id: str, harness_id: str, from_end: str, to_end: str,
                       generator: str, options: Mapping[str, Any]) -> dict:
        """``POST …/harnesses/{hid}/generate``: proposed wires between one end pair, nothing written."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            harness = self._visible_harness(store, system_id, harness_id, caller)
            ends = {end["id"]: end for end in harness["ends"]}
            if from_end not in ends or to_end not in ends or from_end == to_end:
                raise Invalid("fromEnd and toEnd must be two ends of this harness")
            components = self._end_components(store, harness)
        facts = [harnesses_module.pin_facts(ends[e], components.get(e)) for e in (from_end, to_end)]
        existing = [{"pin_a": w["from_pin"] if w["from_end"] == from_end else w["to_pin"],
                     "pin_b": w["to_pin"] if w["to_end"] == to_end else w["from_pin"]}
                    for w in harness["wires"] if {w["from_end"], w["to_end"]} == {from_end, to_end}]
        body = generators.generate(generator, facts[0], facts[1], existing, options)
        wires = [{"from": {"end": from_end, "pin": row["pinA"]}, "to": {"end": to_end, "pin": row["pinB"]},
                  "signal": row["signal"], "netFrom": row["netA"], "netTo": row["netB"], "flags": row["flags"]}
                 for row in body["rows"]]
        skipped = [{"fromPin": s["pinA"], "toPin": s["pinB"], "reason": s["reason"]} for s in body["skipped"]]
        return {"harnessId": harness_id, "generator": generator, "wires": wires, "skipped": skipped}

    def link_to_harness(self, caller: Caller, system_id: str, version: int, link_id: str) -> Result:
        """§16.1: a 2-end harness mating the link's ends, one wire per row; the link is deleted."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                link = self._visible_link(store, system_id, link_id, caller)
                harness_id = self._harness_from_links(store, change, [link], name=link["name"] or "Harness",
                                                      label=link["harness"], audit={"fromLink": link_id})
                body = self._harness_body(store, system_id, harness_id, caller)
        return Result(body, system_id, change.version)

    def harness_from_label(self, caller: Caller, system_id: str, version: int, label: str) -> Result:
        """§17.2 P1 label migration: every link with this harness label becomes one harness."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                links = [link for link in store.list_links(system_id) if link["harness"] == label]
                if not links:
                    raise NotFound("No link carries that harness label")
                for link in links:
                    self._visible_link(store, system_id, link["id"], caller)
                harness_id = self._harness_from_links(store, change, links, name=label, label=label,
                                                      audit={"fromLabel": label, "links": [l["id"] for l in links]})
                body = self._harness_body(store, system_id, harness_id, caller)
        return Result(body, system_id, change.version)

    def _harness_from_links(self, store: SystemStore, change: Any, links: Sequence[Mapping[str, Any]], *,
                            name: str, label: Optional[str], audit: Mapping[str, Any]) -> str:
        """One harness whose ends are the links' distinct ports (first appearance order); rows become wires."""
        for link in links:
            if link.get("type") == "b2b":
                raise Conflict("a board-to-board link is a mate, not a cable; change its type first")
        ports: list[tuple[str, dict]] = []
        for link in links:
            for end in ("a", "b"):
                key = (link[f"{end}_instance_id"], link[f"{end}_port"]["portKey"])
                if key not in [(i, p["portKey"]) for i, p in ports]:
                    ports.append((link[f"{end}_instance_id"], dict(link[f"{end}_port"])))
        for link in links:
            store.delete_link(change, link["id"])
        harness = store.create_harness(change, name=name, label=label, audit=audit)
        end_ids = {}
        for instance_id, port in ports:
            harness = store.add_harness_end(change, harness["id"], mates_instance_id=instance_id, mates_port=port,
                                            pin_count=max(1, int(port.get("pinCount") or 1)))
            end_ids[(instance_id, port["portKey"])] = harness["ends"][-1]["id"]
        wires = []
        for link in links:
            wires += harnesses_module.wires_from_rows(link, end_ids[(link["a_instance_id"], link["a_port"]["portKey"])],
                                                      end_ids[(link["b_instance_id"], link["b_port"]["portKey"])])
        # Row net baselines carry over as accepted baselines: converting is not an acceptance of drift.
        store.replace_wires(change, harness["id"], wires)
        return harness["id"]

    def harness_to_link(self, caller: Caller, system_id: str, version: int, harness_id: str) -> Result:
        """§16.1: only a 2-end harness with identity maps and no splices becomes an ``unspecified`` link."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                harness = self._visible_harness(store, system_id, harness_id, caller)
                if not harnesses_module.is_linkable(harness) or not all(e["mates_instance_id"] for e in harness["ends"]):
                    raise Conflict("harness_not_linkable: only a harness with two mated ends, no splices and no pin "
                                   "map becomes a link")
                a, b = harness["ends"]
                store.delete_harness(change, harness_id)
                link = store.create_link(change, a_instance_id=a["mates_instance_id"], a_port=a["mates_port"],
                                         b_instance_id=b["mates_instance_id"], b_port=b["mates_port"],
                                         name=harness["name"], harness=harness["label"])
                rows = [{"pinA": w["from_pin"] if w["from_end"] == a["id"] else w["to_pin"],
                         "pinB": w["to_pin"] if w["from_end"] == a["id"] else w["from_pin"],
                         "signal": w["signal"], "source": "manual",
                         "netA": w["net_from"] if w["from_end"] == a["id"] else w["net_to"],
                         "netB": w["net_to"] if w["from_end"] == a["id"] else w["net_from"]} for w in harness["wires"]]
                store.replace_rows(change, link["id"], rows)
                body = self._link_body(store, system_id, link["id"])
        return Result(body, system_id, change.version)

    # ------------------------------------------------------------------
    # Links and rows

    def _visible_link(self, store: SystemStore, system_id: str, link_id: str, caller: Caller) -> dict:
        try:
            link = store.get_link(system_id, link_id)
        except NotFound:
            raise NotFound("Link not found") from None
        for end in ("a", "b"):
            try:
                self._open_instance(store, system_id, link[f"{end}_instance_id"], caller)
            except NotFound:
                raise NotFound("Link not found") from None
        return link

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

    def create_link(
        self, caller: Caller, system_id: str, version: int, *, a: Mapping[str, str],
        b: Mapping[str, str], name: str, harness: Optional[str], link_type: str = "unspecified",
        stack_height_mm: Optional[float] = None,
    ) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                baselines, subport_ids = [], []
                all_subports = store.list_subports(system_id)
                for end in (a, b):
                    instance = self._open_instance(store, system_id, end["instanceId"], caller)
                    interface = self._interface(store, instance)
                    component = exposure.component_by_key(interface, end["portKey"])
                    if component is None:
                        raise Invalid("portKey is not a component of this board at its baseline")
                    override = store.list_overrides(instance["id"]).get(component["portKey"])
                    if not exposure.is_exposed(component, override):
                        raise Conflict("port is not exposed on this board")
                    if link_type == "b2b" and (component.get("export") or {}).get("subport"):
                        raise Conflict("port_split: this export is part of a connector in its subsystem; a "
                                       "board-to-board link mates a whole connector")
                    baseline = exposure.port_baseline(component)
                    subport_id = end.get("subportId")
                    if subport_id is not None and subport_id not in {
                            s["id"] for s in subports_module.on_connector(all_subports, instance["id"], baseline)}:
                        raise Invalid("subportId is not a sub-port of this connector")
                    baselines.append(baseline)
                    subport_ids.append(subport_id)
                link = store.create_link(
                    change, a_instance_id=a["instanceId"], a_port=baselines[0],
                    b_instance_id=b["instanceId"], b_port=baselines[1], name=name, harness=harness,
                    link_type=link_type, stack_height_mm=stack_height_mm,
                    a_subport_id=subport_ids[0], b_subport_id=subport_ids[1],
                )
                body = self._link_body(store, system_id, link["id"])
        return Result(body, system_id, change.version)

    def update_link(
        self, caller: Caller, system_id: str, version: int, link_id: str, fields: Mapping[str, Any]
    ) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                link = self._visible_link(store, system_id, link_id, caller)
                if fields.get("type") == "b2b":
                    for end in ("a", "b"):
                        found = self._instance_interface(store, store.get_instance(system_id, link[f"{end}_instance_id"]))
                        component = exposure.component_by_key(found, link[f"{end}_port"]["portKey"]) if found else None
                        if component and (component.get("export") or {}).get("subport"):
                            raise Conflict("port_split: this export is part of a connector in its subsystem; a "
                                           "board-to-board link mates a whole connector")
                store.update_link(
                    change, link_id, name=fields.get("name"), harness=fields.get("harness", ...),
                    link_type=fields.get("type"), stack_height_mm=fields.get("stackHeightMm", ...),
                )
                body = self._link_body(store, system_id, link_id)
        return Result(body, system_id, change.version)

    def delete_link(self, caller: Caller, system_id: str, version: int, link_id: str) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._visible_link(store, system_id, link_id, caller)
                store.delete_link(change, link_id)
        return Result(None, system_id, change.version)

    def replace_rows(
        self, caller: Caller, system_id: str, version: int, link_id: str,
        rows: Sequence[Mapping[str, Any]],
    ) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                link = self._visible_link(store, system_id, link_id, caller)
                pins: dict[str, dict[str, dict]] = {}
                references: dict[str, str] = {}
                for end in ("a", "b"):
                    instance = store.get_instance(system_id, link[f"{end}_instance_id"])
                    interface = self._interface(store, instance)
                    component = exposure.component_by_key(interface, link[f"{end}_port"]["portKey"])
                    if component is None:
                        raise Conflict("a link end no longer resolves at its baseline; resolve its review first")
                    pins[end] = exposure.pins_by_pad(component)
                    references[end] = component["reference"]
                all_subports = store.list_subports(system_id)
                allowed = {end: self._end_pads(store, system_id, link, end, pins[end], all_subports) for end in ("a", "b")}
                captured = []
                for row in rows:
                    item = dict(row)
                    for end, column in (("a", "A"), ("b", "B")):
                        pad = str(item.get(f"pin{column}") or "")
                        if pad and pad not in pins[end]:
                            raise Invalid(f"pin {pad} does not exist on {references[end]}")
                        if pad and pad not in allowed[end]:
                            raise Invalid(f"pin_not_on_subport: pin {pad} is not on this end of the link (P2 §22.2)")
                        item[f"net{column}"] = pins[end][pad]["nets"] if pad else []
                    captured.append(item)
                store.replace_rows(change, link_id, captured)
                body = self._link_body(store, system_id, link_id)
        return Result(body, system_id, change.version)

    def generate_rows(
        self, caller: Caller, system_id: str, link_id: str, generator: str, options: Mapping[str, Any],
    ) -> Result:
        """``POST …/links/{lid}/generate`` (§8.5): proposed rows, nothing written."""

        with self._tx() as store:
            system = self._system(store, system_id, caller)
            link = self._visible_link(store, system_id, link_id, caller)
            pins = {}
            for end in ("a", "b"):
                instance = store.get_instance(system_id, link[f"{end}_instance_id"])
                component = exposure.component_by_key(self._interface(store, instance), link[f"{end}_port"]["portKey"])
                if component is None:
                    raise Conflict("a link end no longer resolves at its baseline; resolve its review first")
                pins[end] = exposure.pins_by_pad(component)
            all_subports = store.list_subports(system_id)
            for end in ("a", "b"):
                allowed = self._end_pads(store, system_id, link, end, pins[end], all_subports)
                pins[end] = {pad: facts for pad, facts in pins[end].items() if pad in allowed}
        body = generators.generate(generator, pins["a"], pins["b"], link["rows"], options)
        return Result({"linkId": link_id, **body}, system_id, system["version"])
