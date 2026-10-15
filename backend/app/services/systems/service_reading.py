"""The loaded view and reader visibility: the shared read layer under every concept mixin.

``_load`` builds the transaction's ``loaded.LoadedSystem``; the resolver methods it calls back
(``_child_loader``, ``_catalog_instance_doc``, ``_occurrence_lookups``, ``_harness_checks``,
``_visibility``) live here. Reader visibility (§8.2, P2 §5.4) is here too: what a caller may not
see (``_restricted_instances``, ``_restricted_in``), the reader exits (``_for_reader``,
``_report_for_reader``) and the 404 lookups of one link, export or harness.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from app.services.systems import (
    harnesses as harnesses_module, hierarchy, interface_cache, modules, redaction, system_nets, visibility,
    scene as scene_module,
)
from app.services.systems.bundles import BundleUnreadable
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.loaded import LoadedSystem
from app.services.systems.placement import harness_checks, harness_route
from app.services.systems.placement import poses as poses_module
from app.services.systems.service_base import _ACTIVE_JOB_STATES, _BUNDLE_BUILDERS, Caller, logger
from app.services.systems.store import Conflict, Invalid, NotFound, SystemStore


class ReadingCore:
    # ------------------------------------------------------------------
    # The loaded view

    def _load(self, store: SystemStore, system_id: str, caller: Caller) -> LoadedSystem:
        """The system as this transaction reads it, after checking the caller may see it."""
        return LoadedSystem(store, self._system(store, system_id, caller), self)

    def _tree(self, store: SystemStore, system_id: str, extra: Sequence[Mapping[str, Any]] = ()) -> hierarchy.Tree:
        instances = list(store.list_instances(system_id, kinds=SystemStore.ALL_KINDS)) + list(extra)
        try:
            return hierarchy.resolve(system_id, instances, self._child_loader(store))
        except hierarchy.HierarchyError as error:
            raise Invalid(str(error)) from None

    def _child_loader(self, store: SystemStore):
        """hierarchy.Loader: catalog revision -> the snapshot it was published from."""

        def load(revision_id: str) -> Optional[hierarchy.ChildSystem]:
            # SB2-95: which snapshot a revision was published from never changes; keep it.
            key = (revision_id, "", "source")
            source = interface_cache.revision_sources.get(key)
            if source is None:
                revision = self._catalog_revision(revision_id)
                source = (revision or {}).get("sourceRef") or {}
                if revision is not None:
                    source = interface_cache.revision_sources.put(
                        key, {k: source.get(k) for k in ("kind", "systemId", "snapshotId")}, 1)
            if source.get("kind") != "system_snapshot":
                return None
            try:
                manifest = store.get_snapshot_manifest(source["systemId"], source["snapshotId"])
            except (NotFound, KeyError):
                return None
            if not manifest:
                return None
            return hierarchy.ChildSystem(source["systemId"], source["snapshotId"], manifest["system"]["name"],
                                         manifest["instances"], manifest.get("exports") or [],
                                         manifest.get("links") or [], manifest.get("harnesses") or [],
                                         (manifest.get("placement") or {}).get("poses") or [],
                                         manifest.get("mating") or [],
                                         (manifest.get("placement") or {}).get("drivingMates") or [])

        return load

    def _catalog_refs(self, store: SystemStore, system_id: str) -> dict[str, dict]:
        """Pinned catalog revision per assembly/module instance, for the manifest."""
        refs = {}
        for instance in store.list_instances(system_id, kinds=("assembly", "module", "part")):
            revision = self._catalog_revision(instance["catalog_revision_id"])
            if revision is None:
                raise Conflict(f"the catalog revision of {instance['label']} cannot be read; try again")
            refs[instance["id"]] = revision
        return refs

    def _catalog_instance_doc(self, instance: Mapping[str, Any], store: Optional[SystemStore] = None) -> dict:
        """An assembly/module instance as the document shows it: an assembly's exports, a module's
        connectors (§5.6), are its ports. An assembly carries its snapshot's open finding counts (SB2-117)."""
        revision = self._catalog_revision(instance["catalog_revision_id"])
        if instance["kind"] == "part":
            exports = []  # a mechanical part has no ports (P2 §24.1)
        elif instance["kind"] == "module":
            units = (self._module_interface(instance["catalog_revision_id"]) or {}).get("components") or [] \
                if revision else []
            exports = [{"id": c["portKey"], "name": c["reference"], "libId": None, "footprint": c.get("footprint"),
                        "reference": c.get("mpn"), "pinCount": len(c["pins"])} for c in units]
        else:
            exports = ((revision or {}).get("interface") or {}).get("exports") or []
        latest = (revision or {}).get("latestReleasedRevisionId")
        return {
            "id": instance["id"], "label": instance["label"], "kind": instance["kind"], "restricted": False,
            "projectId": None, "projectName": (revision or {}).get("name"), "projectDeleted": False,
            "baselineCommit": None, "trackedRef": None, "pinned": instance["follow"] == "pinned",
            "resolution": "resolved" if revision else "unresolved", "tipCommit": None, "tipCheckedAt": None,
            "updateAvailable": bool(latest) and latest != instance["catalog_revision_id"],
            "interface": {"status": "ready" if revision else "failed", "digest": None, "hasPcb": None,
                          "jobId": None, "errorCode": None if revision else "catalog_revision_unavailable"},
            "ports": [{
                "portKey": entry.get("id"), "memberKeys": [entry.get("id")], "reference": entry.get("name"),
                "libId": entry.get("libId"), "footprint": entry.get("footprint"), "value": entry.get("reference"),
                "dnp": False, "candidate": True, "candidateReason": "module" if instance["kind"] == "module" else "export",
                "override": None, "exposed": True,
                "pinCount": int(entry.get("pinCount") or 0),
            } for entry in exports],
            "catalog": {
                "componentId": instance["catalog_component_id"], "revisionId": instance["catalog_revision_id"],
                "follow": instance["follow"], "version": (revision or {}).get("version"),
                "releaseStatus": (revision or {}).get("releaseStatus"), "identity": (revision or {}).get("identity"),
                "latestReleasedRevisionId": latest,
                "latestReleasedVersion": (revision or {}).get("latestReleasedVersion"),
                "newestVersion": (revision or {}).get("newestVersion"),
                "newestReleaseStatus": (revision or {}).get("newestReleaseStatus"),
                "systemId": ((revision or {}).get("sourceRef") or {}).get("systemId"),
                "snapshotName": ((revision or {}).get("sourceRef") or {}).get("snapshotName"),
                "openReviewCount": int(((revision or {}).get("sourceRef") or {}).get("openReviewCount") or 0),
                "findingCounts": self._snapshot_counts(store, (revision or {}).get("sourceRef") or {})
                if instance["kind"] == "assembly" else None,
            },
        }

    _SNAPSHOT_COUNTS: dict[str, Optional[dict]] = {}

    def _snapshot_counts(self, store: Optional[SystemStore], source: Mapping[str, Any]) -> Optional[dict]:
        """SB2-117: a subsystem's open errors and warnings, as frozen in the snapshot its revision was
        published from. A snapshot never changes, so the answer is kept."""
        snapshot_id, system_id = source.get("snapshotId"), source.get("systemId")
        if not snapshot_id or not system_id:
            return None
        if snapshot_id not in self._SNAPSHOT_COUNTS:
            if store is None:
                return None
            self._SNAPSHOT_COUNTS[snapshot_id] = store.snapshot_counts(system_id, snapshot_id)
        return self._SNAPSHOT_COUNTS[snapshot_id]

    def _hierarchy_view(self, store: SystemStore, caller: Caller, system_id: str, tree: hierarchy.Tree) -> dict:
        """``hierarchy()``'s body for a tree the caller already resolved (SB2-95: once per request)."""
        projects = {o.project_id for o in tree.boards if o.project_id}
        access = visibility.project_access(store.conn, projects, caller.role)
        hidden_systems = visibility.hidden_systems(store.conn, caller.role,
                                                   {o.child_system_id for o in tree.occurrences if o.child_system_id})
        out = []
        hidden_prefixes: list[str] = []
        for occurrence in tree.occurrences:
            if any(occurrence.path.startswith(prefix + "/") for prefix in hidden_prefixes):
                continue  # inside a child system the reader cannot see (S7)
            entry = occurrence.as_dict()
            entry["restricted"] = False
            if occurrence.kind == "board" and not access.get(occurrence.project_id, {}).get("visible", False):
                entry.update(restricted=True, projectId=None, baselineCommit=None)
            if occurrence.child_system_id in hidden_systems:
                entry.update(restricted=True, childSystemId=None, childSnapshotId=None)
                hidden_prefixes.append(occurrence.path)
            out.append(entry)
        return {"systemId": system_id, "occurrences": out,
                "boardCount": sum(1 for o in tree.occurrences if o.kind == "board")}

    # ------------------------------------------------------------------
    # Placement lookups and harness routes

    def _occurrence_lookups(self, store: SystemStore, extents: Mapping[tuple, Optional[dict]]):
        """``(interface_of, component_of)`` for an occurrence: a board's extent and one connector read from
        its artifact (never the whole artifact), a module's interface (§5.6), cached per call."""
        modules_read: dict[str, Optional[dict]] = {}
        components: dict[tuple[str, str, str], Optional[dict]] = {}

        def module(occurrence: hierarchy.Occurrence) -> Optional[dict]:
            if occurrence.revision_id not in modules_read:
                read = self._part_interface if occurrence.kind == "part" else self._module_interface
                modules_read[occurrence.revision_id] = read(occurrence.revision_id)
            return modules_read[occurrence.revision_id]

        def interface_of(occurrence: hierarchy.Occurrence) -> Optional[dict]:
            if occurrence.kind in ("module", "part"):
                return module(occurrence) if occurrence.revision_id else None
            return extents.get((occurrence.project_id, occurrence.baseline_commit))

        def component_of(occurrence: hierarchy.Occurrence, port_key: str) -> Optional[dict]:
            if occurrence.kind == "part":
                return None
            if occurrence.kind == "module":
                return modules.component(module(occurrence), port_key) if occurrence.revision_id else None
            if not occurrence.project_id or not occurrence.baseline_commit:
                return None
            key = (occurrence.project_id, occurrence.baseline_commit, port_key)
            if key not in components:
                components[key] = store.get_interface_component(*key[:2], EXTRACTOR_VERSION, port_key)
            return components[key]

        return interface_of, component_of

    def _scene_asset(self, caller: Caller, project_id: str, commit: str) -> dict:
        entry = {"assetId": scene_module.asset_id(project_id, commit), "projectId": project_id, "commit": commit,
                 "status": "missing", "bundleUrl": None, "sourceRevisionKey": None, "generatorBuild": None,
                 "jobId": None, "error": None, "bundleToBoard": None}
        project = self._load_project(project_id)
        if project is None:
            return {**entry, "status": "failed"}
        try:
            status = self._bundles.status(project, commit)
        except Exception:
            logger.exception("Could not read the 3D bundle status of %s@%s", project_id, commit)
            return {**entry, "status": "failed"}
        if status.get("available"):
            try:
                mid_plane = self._bundles.mid_plane_mm(project_id, status)
            except BundleUnreadable:
                # SB2-91: a status that says ready over files that are gone would show "generating" forever.
                return {**entry, "status": "failed", "generatorBuild": status.get("build_fingerprint"),
                        "error": "The 3D files of this revision are missing or unreadable on this server. "
                                 "Regenerate it from the board's 3D tab."}
            entry.update(status="ready" if status.get("status") == "ready" else "building",
                         bundleUrl=status.get("bundle_url"), sourceRevisionKey=status.get("sourceRevisionKey"),
                         generatorBuild=status.get("build_fingerprint"),
                         bundleToBoard=scene_module.bundle_to_board(mid_plane))
            return entry
        try:
            last = self._bundles.last_build(project_id, commit)
        except Exception:
            logger.exception("Could not read the 3D bundle jobs of %s@%s", project_id, commit)
            last = None
        if last and last["status"] in _ACTIVE_JOB_STATES:
            return {**entry, "status": "building", "jobId": last["jobId"]}
        if last and last["status"] in ("failed", "cancelled"):
            # Never re-queued by a read: a retry is a deliberate Regenerate on the board's 3D tab.
            return {**entry, "status": "failed", "jobId": last["jobId"], "error": last["error"]}
        if last and last["status"] == "completed":
            # The job finished but its bundle is not readable here: pruned, invalidated, or built
            # by a different generator build than this server's. Asking again would return the
            # same completed job, and the board would read as "building" forever.
            logger.warning("3D bundle job %s for %s@%s completed but no bundle is available",
                           last["jobId"], project_id, commit)
            return {**entry, "status": "failed", "jobId": last["jobId"],
                    "error": "The 3D build finished but its bundle is not available on this server. "
                             "Regenerate it from the board's 3D tab."}
        if caller.role in _BUNDLE_BUILDERS:
            try:
                entry.update(status="building", jobId=self._bundles.build(project_id, commit, requested_by=caller.email))
            except Exception:
                logger.exception("Could not queue a 3D bundle for %s@%s", project_id, commit)
        return entry

    def _end_components(self, store: SystemStore, harness: Mapping[str, Any],
                        interfaces: Optional[Mapping[str, dict]] = None) -> dict[str, Optional[dict]]:
        """``end ID -> mated component`` (None when it no longer resolves). Ends whose board
        interface is not extracted yet, and unmated ends, are left out."""
        if interfaces is None:
            interfaces = {end["mates_instance_id"]: self._instance_interface(
                store, store.get_instance(harness["system_id"], end["mates_instance_id"]))
                for end in harness["ends"] if end["mates_instance_id"] and end["mates_port"]}
        return harnesses_module.end_components(harness, interfaces)

    def _attach_housings(self, harnesses: Sequence[dict]) -> None:
        """Give each harness end with a part its model (§18.2, SB2-47): ``housing {glbKey, boundsMm,
        alignment}`` from the first STEP model with a converted GLB among the assets of the part revision
        the end pins (§17.3), else null. A catalog that can't be read leaves every end without one:
        housings then draw as proxy boxes."""
        models: dict[tuple[str, Optional[str]], Optional[dict]] = {}
        for harness in harnesses:
            for end in harness["ends"]:
                part = end.get("part")
                if not part:
                    end["housing"] = None
                    continue
                key = (part, end.get("partRevisionId"))
                if key not in models:
                    models[key] = self._catalog_model(*key)
                end["housing"] = models[key]

    def _harness_checks(self, loaded: LoadedSystem) -> dict:
        """The root level's harnesses routed where the System 3D view draws them (§17.10), by harness
        ID: ``{lengths, collisions, tightBends}``; a harness with fewer than two posed ends is left out.
        Collisions are checked against every board of the tree that has an outline."""
        if not loaded.harnesses:
            return {}
        tree, placement = loaded.tree, loaded.placement
        routes, matrices = self._harness_routes(loaded, root_only=True)
        boards = [{"id": o.path, "matrix": matrices[o.path], **placement["local"][o.path]}
                  for o in tree.occurrences if o.kind == "board" and placement["local"].get(o.path)]
        allowance = {row["id"]: row["service_allowance_pct"] for row in loaded.harnesses}
        out = {}
        for harness, routed in routes:
            out[harness["id"]] = {
                "lengths": {**harness_checks.lengths(routed, allowance.get(harness["id"])),
                            # §26.1: the routed segments a covering names.
                            "segments": [{"id": c["segmentId"], "from": c["from"], "to": c["to"],
                                          "lengthMm": c["lengthMm"], "wires": list(c["wires"])}
                                         for c in routed["curves"]]},
                "collisions": harness_checks.collisions(routed, boards),
                "tightBends": [{"segmentId": c["segmentId"], "radiusMm": c["tightBend"]["radiusMm"],
                                "minRadiusMm": c["minRadiusAllowedMm"], "atMm": c["tightBend"]["atMm"]}
                               for c in routed["curves"] if c["tightBend"] and c["diameterMm"] > 0],
            }
        return out

    def _harness_routes(self, loaded: LoadedSystem, root_only: bool) -> tuple[list[tuple[dict, dict]], dict]:
        """``([(scene harness, route)], world matrix by occurrence path)`` for the loaded placement: the
        root level's harnesses, or every level's (a child system's copies each routed through their own
        frame). Harnesses with no route are left out."""
        tree, level, placement = loaded.tree, loaded.level, loaded.placement
        harnesses = [h for h in system_nets.harness_layout(level) if not (root_only and h["level"])]
        scene_module.harness_connectors(harnesses, tree.occurrences, level,
                                        self._occurrence_lookups(loaded.rows, loaded.extents)[1])
        self._attach_housings(harnesses)
        matrices = {path: poses_module.matrix(pose)
                    for path, pose in scene_module.world_poses(tree.occurrences, placement["placed"]).items()}
        routes = [(harness, routed) for harness in harnesses
                  if (routed := harness_route.route(harness, matrices.get)) is not None]
        return routes, matrices

    # ------------------------------------------------------------------
    # Reader visibility (§8.2, P2 §5.4)

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

    def _restricted_in(self, store: SystemStore, document: Mapping[str, Any], caller: Caller) -> redaction.Restricted:
        """Restricted boards and hidden export ends of a frozen document, by today's access (§8.2).

        A snapshot can hold instances that have since been removed, so this
        reads the identities the document itself recorded: a board's project,
        an assembly's catalog revision (P2 §5.4).
        """

        return self._visibility(store, document["system"]["id"], caller, document["instances"])

    @staticmethod
    def _for_reader(loaded: LoadedSystem, caller: Caller, document: Mapping[str, Any]) -> dict:
        return redaction.redact_document(document, loaded.restricted(caller))

    @staticmethod
    def _report_for_reader(loaded: LoadedSystem, caller: Caller, report: Mapping[str, Any]) -> dict:
        return redaction.redact_findings(report, loaded.restricted(caller))

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

    def _visible_export(self, store: SystemStore, system_id: str, export_id: str, caller: Caller) -> dict:
        export = store.get_export(system_id, export_id)
        try:
            self._open_instance(store, system_id, export["target_instance_id"], caller)
        except NotFound:
            raise NotFound("Export not found") from None
        return export

    def _visible_harness(self, store: SystemStore, system_id: str, harness_id: str, caller: Caller) -> dict:
        harness = store.get_harness(system_id, harness_id)
        restricted = self._restricted_instances(store, system_id, caller)
        if any(end["mates_instance_id"] in restricted for end in harness["ends"]):
            raise NotFound("Harness not found")  # edits would touch a board the caller cannot see
        return harness
