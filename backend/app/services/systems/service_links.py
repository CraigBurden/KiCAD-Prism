"""Links and rows (§8.1, CONTRACTS_P2 §16.2, §22.2). The end rules are ``links.py``'s."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from app.services.systems import exposure, generators, links as link_rules
from app.services.systems.service_base import Caller, Result
from app.services.systems.store import Conflict, Invalid


class LinksMixin:
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
                    if link_type == "b2b":
                        link_rules.check_whole_connector(component)
                    baseline = exposure.port_baseline(component)
                    subport_id = end.get("subportId")
                    link_rules.check_subport(all_subports, instance["id"], baseline, subport_id)
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
                        link_rules.check_whole_connector(
                            exposure.component_by_key(found, link[f"{end}_port"]["portKey"]) if found else None)
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
                allowed = {end: link_rules.end_pads(link, end, pins[end], all_subports) for end in ("a", "b")}
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
                allowed = link_rules.end_pads(link, end, pins[end], all_subports)
                pins[end] = {pad: facts for pad, facts in pins[end].items() if pad in allowed}
        body = generators.generate(generator, pins["a"], pins["b"], link["rows"], options)
        return Result({"linkId": link_id, **body}, system_id, system["version"])
