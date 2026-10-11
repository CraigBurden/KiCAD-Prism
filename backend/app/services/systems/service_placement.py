"""Placement (CONTRACTS_P2 §14, §20): mating frames, poses, driving mates, placement and the scene."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from app.services.systems import (
    exposure, hierarchy, modules, system_nets, mating as mating_module, scene as scene_module,
)
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.placement import poses as placement_poses
from app.services.systems.service_base import Caller, Result
from app.services.systems.store import Invalid, SystemStore


class PlacementMixin:
    # ------------------------------------------------------------------
    # Mating frames

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
    # Poses and driving mates

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

    # ------------------------------------------------------------------
    # Placement and scene

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

    def scene(self, caller: Caller, system_id: str) -> dict:
        """``GET …/scene`` (§20): every occurrence placed, with the board bundles to draw them.

        A visible board whose bundle is missing gets a build queued when the reader
        may generate bundles (designer or admin, as on the board's 3D tab).
        """

        with self._tx(consistent=True) as store:
            loaded = self._load(store, system_id, caller)  # SB2-95: one resolve, one read of the system
            version = int(loaded.version)
            tree = loaded.tree
            shown = {o["path"]: o for o in self._hierarchy_view(store, caller, system_id, tree)["occurrences"]}
            level = loaded.level
            harnesses = system_nets.harness_layout(level)
            placement, interfaces = loaded.placement, loaded.extents
            interface_of, component_of = self._occurrence_lookups(store, interfaces)
            scene_module.harness_connectors(harnesses, tree.occurrences, level, component_of)
            self._attach_housings(harnesses)
        for (project_id, commit), found in interfaces.items():
            if found is None:  # not extracted yet, or by an older extractor: the bounds come with it
                self._enqueue_quietly(project_id, commit, caller)
        assets: dict[tuple[str, str], dict] = {}

        def asset(occurrence: hierarchy.Occurrence) -> dict:
            key = (occurrence.project_id, occurrence.baseline_commit)
            if key not in assets:
                assets[key] = self._scene_asset(caller, *key)
            return assets[key]

        built = scene_module.build(system_id, version, tree.occurrences, shown, interface_of, asset,
                                   placement=placement)
        built["harnesses"] = scene_module.redact_harnesses(harnesses, shown)
        root = placement["results"].get("")
        built["placement"] = {k: root[k] for k in ("roots", "mismatches", "unusable", "ignoredOverrides")} \
            if root else None
        return built
