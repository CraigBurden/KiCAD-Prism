"""Harnesses (CONTRACTS_P2 §17): ends, wires, nodes, coverings, and conversions to and from links."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from app.services.systems import drift, exposure, generators, harnesses as harnesses_module
from app.services.systems.service_base import Caller, Result, logger
from app.services.systems.store import Conflict, Invalid, NotFound, SystemStore

MAX_COVERINGS = 64  # per harness (§26.1)


class HarnessesMixin:
    def list_harnesses(self, caller: Caller, system_id: str) -> list[dict]:
        with self._tx() as store:
            self._system(store, system_id, caller)
            return [self._harness_body(store, system_id, h["id"], caller) for h in store.list_harnesses(system_id)]

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
                raise Conflict("A mated board's interface is still being extracted", code="interface_not_ready")
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

    # ------------------------------------------------------------------
    # Ends

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

    def delete_harness_end(self, caller: Caller, system_id: str, version: int, harness_id: str, end_id: str) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                self._visible_harness(store, system_id, harness_id, caller)
                store.delete_harness_end(change, harness_id, end_id)
                body = self._harness_body(store, system_id, harness_id, caller)
        return Result(body, system_id, change.version)

    def end_suggestions(self, caller: Caller, system_id: str, harness_id: str, end_id: str) -> dict:
        """``GET …/harnesses/{hid}/ends/{eid}/suggestions`` (§18): the mated connector's part and its known
        partners. Nothing is assigned."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            harness = self._visible_harness(store, system_id, harness_id, caller)
            end = next((e for e in harness["ends"] if e["id"] == end_id), None)
            if end is None:
                raise NotFound("Harness end not found")
            component = self._end_components(store, harness).get(end_id)
        mpn = (component or {}).get("mpn")
        if not mpn:
            return {"endId": end_id, "connectorMpn": None, "connectorPart": None, "suggestions": []}
        try:
            catalog = self._catalog()
            board_part = catalog.parts_by_mpn([mpn]).get(mpn.strip().lower())
            suggestions = catalog.list_mates_with(board_part["componentId"]) if board_part else []
        except Exception:
            logger.exception("Could not read catalog mates for a harness end")
            board_part, suggestions = None, []
        return {"endId": end_id, "connectorMpn": mpn, "connectorPart": board_part, "suggestions": suggestions}

    # ------------------------------------------------------------------
    # Coverings (§26)

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

    # ------------------------------------------------------------------
    # Wires and nodes

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

    # ------------------------------------------------------------------
    # Links and harnesses (§17.6)

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
