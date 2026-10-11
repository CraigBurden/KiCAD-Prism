"""Sub-ports (SB2-105, CONTRACTS_P2 §22): carve, edit and remove, re-homing rows in one change."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from app.services.systems import exposure, subports as subports_module
from app.services.systems.drift import pad_sort_key
from app.services.systems.service_base import Caller, Result
from app.services.systems.store import Conflict, Invalid, NotFound, SystemStore, new_id


class SubportsMixin:
    def create_subport(self, caller: Caller, system_id: str, version: int, instance_id: str, *,
                       port_key: str, name: str, pads: Sequence[str], preview: bool = False) -> Result:
        def plan(store: SystemStore, instance: dict, component: dict, existing: list[dict]) -> dict:
            pads_sorted = _sorted(pads)
            self._check_subport(component, name, pads_sorted, existing)
            draft = {"id": new_id("spt_"), "name": name, "pads": pads_sorted}
            return {"draft": draft, "after": existing + [draft], "kind": "subport_created"}

        return self._change_subports(caller, system_id, version, instance_id, port_key, None, plan, preview)

    def update_subport(self, caller: Caller, system_id: str, version: int, instance_id: str, subport_id: str, *,
                       name: Optional[str] = None, pads: Optional[Sequence[str]] = None,
                       preview: bool = False) -> Result:
        def plan(store: SystemStore, instance: dict, component: dict, existing: list[dict]) -> dict:
            current = next(s for s in existing if s["id"] == subport_id)
            others = [s for s in existing if s["id"] != subport_id]
            draft = {"id": subport_id, "name": current["name"] if name is None else name,
                     "pads": list(current["pads"]) if pads is None else _sorted(pads)}
            self._check_subport(component, draft["name"], draft["pads"], others)
            return {"draft": draft, "after": others + [draft], "kind": "subport_updated"}

        return self._change_subports(caller, system_id, version, instance_id, None, subport_id, plan, preview)

    def delete_subport(self, caller: Caller, system_id: str, version: int, instance_id: str, subport_id: str, *,
                       preview: bool = False) -> Result:
        def plan(store: SystemStore, instance: dict, component: dict, existing: list[dict]) -> dict:
            current = next(s for s in existing if s["id"] == subport_id)
            if any(e.get("target_subport_id") == subport_id for e in store.list_exports(system_id)):
                raise Conflict("subport_exported: an export uses this sub-port; delete or retarget it first")
            return {"draft": current, "after": [s for s in existing if s["id"] != subport_id],
                    "kind": "subport_deleted"}

        return self._change_subports(caller, system_id, version, instance_id, None, subport_id, plan, preview)

    # ------------------------------------------------------------------

    @staticmethod
    def _check_subport(component: Mapping[str, Any], name: str, pads: Sequence[str],
                       others: Sequence[Mapping[str, Any]]) -> None:
        problems = subports_module.check_definition(name, pads, exposure.pins_by_pad(component), others)
        if problems:
            raise Invalid(problems[0])
        if len(others) + 1 > subports_module.MAX_PER_CONNECTOR:
            raise Invalid(f"subport_limit: at most {subports_module.MAX_PER_CONNECTOR} sub-ports per connector")

    def _change_subports(self, caller: Caller, system_id: str, version: int, instance_id: str,
                         port_key: Optional[str], subport_id: Optional[str], plan: Any, preview: bool) -> Result:
        with self._tx() as store:
            system = self._system(store, system_id, caller)
            if preview:
                body, _ = self._subport_plan(store, system_id, instance_id, caller, port_key, subport_id, plan)
                return Result(body, system_id, system["version"])
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                body, work = self._subport_plan(store, system_id, instance_id, caller, port_key, subport_id, plan)
                self._apply_subports(store, change, instance_id, work, body["moves"])
                if work["kind"] != "subport_deleted":
                    body["subport"] = _subport_doc(store.get_subport(system_id, work["draft"]["id"]),
                                                   work["component"]["reference"])
        return Result(body, system_id, change.version)

    def _subport_plan(self, store: SystemStore, system_id: str, instance_id: str, caller: Caller,
                      port_key: Optional[str], subport_id: Optional[str], plan: Any) -> tuple[dict, dict]:
        instance = self._open_instance(store, system_id, instance_id, caller)
        all_subports = store.list_subports(system_id)
        if subport_id is not None:
            found = next((s for s in all_subports if s["id"] == subport_id and s["instance_id"] == instance_id), None)
            if found is None:
                raise NotFound("Sub-port not found")
            port_key = found["port_key"]
        interface = self._interface(store, instance)
        component = exposure.component_by_key(interface, port_key)
        if component is None:
            raise Invalid("portKey is not a component of this instance at its baseline")
        override = store.list_overrides(instance_id).get(component["portKey"])
        if not exposure.is_exposed(component, override):
            raise Conflict("port_not_exposed: only an exposed connector can be split")
        port = exposure.port_baseline(component)
        links = store.list_links(system_id)
        for link in links:
            if link.get("type") == "b2b" and any(
                    link[f"{e}_instance_id"] == instance_id and subports_module.same_connector(link[f"{e}_port"], port)
                    for e in ("a", "b")):
                raise Conflict("port_b2b_mated: a board-to-board link mates this connector; its rows all go to "
                               "the partner, so it cannot be split")
        existing = subports_module.on_connector(all_subports, instance_id, port)
        for export in [] if existing else store.list_exports(system_id):
            # Splitting would shrink a whole-connector export under its parents; once split, an export of
            # the remainder or a sub-port may change with it (child drift in the parents, §22.3).
            whole = (subports_module.same_connector(export["target_port"], port) if export.get("target_port")
                     else export.get("target_export_id") == port["portKey"])
            if export["target_instance_id"] == instance_id and whole:
                raise Conflict("port_exported: this whole connector is exported; delete the export, split it, "
                               "then export a sub-port")
        work = plan(store, instance, component, existing)
        if work["kind"] == "subport_created" and len(all_subports) >= subports_module.MAX_PER_SYSTEM:
            raise Invalid(f"subport_limit: at most {subports_module.MAX_PER_SYSTEM} sub-ports per system")
        unspecified = [link for link in links if link.get("type") != "b2b"]
        moves = subports_module.plan_moves(unspecified, instance_id, port, work["after"])
        work.update(component=component, port=port, links={link["id"]: link for link in links})
        draft = work["draft"]
        return {"subport": _subport_doc({**draft, "instance_id": instance_id, "port_key": port["portKey"]},
                                        component["reference"]),
                "moves": moves}, work

    def _apply_subports(self, store: SystemStore, change: Any, instance_id: str, work: dict,
                        moves: Sequence[Mapping[str, Any]]) -> None:
        draft, kind = work["draft"], work["kind"]
        if kind == "subport_created":
            store.create_subport(change, instance_id=instance_id, port=work["port"], name=draft["name"],
                                 pads=draft["pads"], subport_id=draft["id"])
        elif kind == "subport_updated":
            store.update_subport(change, draft["id"], name=draft["name"], pads=draft["pads"])
        for move in moves:
            link = work["links"][move["linkId"]]
            end, other = move["end"], "b" if move["end"] == "a" else "a"
            if move["action"] == "retarget":
                store.set_link_subport(change, link["id"], end, move["toSubportId"])
                continue
            ends = {end: (link[f"{end}_instance_id"], link[f"{end}_port"], move["toSubportId"]),
                    other: (link[f"{other}_instance_id"], link[f"{other}_port"], link.get(f"{other}_subport_id"))}
            created = store.create_link(
                change, a_instance_id=ends["a"][0], a_port=ends["a"][1], a_subport_id=ends["a"][2],
                b_instance_id=ends["b"][0], b_port=ends["b"][1], b_subport_id=ends["b"][2],
                name=move["newLinkName"] or "", harness=link["harness"], link_type=link.get("type") or "unspecified",
            )
            store.move_rows(change, move["rowIds"], created["id"])
            move["newLinkId"] = created["id"]
        if kind == "subport_deleted":
            store.delete_subport(change, draft["id"])
        change.audit(kind, {"instanceId": instance_id, "portKey": work["port"]["portKey"], "subportId": draft["id"],
                            "name": draft["name"], "pads": list(draft["pads"]), "moves": list(moves)})

def _sorted(pads: Sequence[Any]) -> list[str]:
    return sorted({str(pad) for pad in pads}, key=pad_sort_key) if len(set(pads)) == len(pads) else [str(p) for p in pads]


def _subport_doc(subport: Mapping[str, Any], reference: Optional[str]) -> dict:
    return {"id": subport["id"], "instanceId": subport["instance_id"], "portKey": subport["port_key"],
            "name": subport["name"], "label": subports_module.label(reference or "", subport["name"]),
            "pads": list(subport["pads"])}
