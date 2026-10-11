"""One system as one transaction reads it (AC-16).

A ``LoadedSystem`` wraps a system's summary row and a row source (a ``SystemStore``, or in tests an
in-memory stand-in with the same read methods). Every fact a read needs is computed once, on first
use, and kept for the rest of the transaction: the instance, link, export, harness and sub-port rows;
each instance's interface at its baseline; the latest extraction jobs; the hierarchy tree; the root
net level; the placement and board extents; the routed harness checks; and what each caller may
not see. The document, the validation report, the scene, the system nets, the collision check and
the STEP export all read through it, so one request resolves the hierarchy and lists the instances
once.

Catalog-backed facts (a subsystem's or module's interface, a child system's snapshot, a catalog
instance's document, housing models, visibility) come from a ``resolver``: the service, whose
methods take the row source as their first argument.

A loaded system only reads; it never changes a row. Build one per transaction and drop it with the
transaction: rows read after a mutation in the same transaction are not refreshed.
"""

from __future__ import annotations

from functools import cached_property
from typing import Any, Mapping, Optional, Protocol, Sequence

from app.services.systems import hierarchy, system_nets
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.jobs import EXTRACT_JOB_KIND, artifact_key
from app.services.systems.store_base import Invalid

ALL_KINDS = ("board", "assembly", "module", "part")
CATALOG_KINDS = ("assembly", "module", "part")


class Resolver(Protocol):
    """What a loaded system asks the service for (each call gets the row source first)."""

    def _instance_interface(self, rows: Any, instance: Mapping[str, Any]) -> Optional[dict]: ...

    def _child_loader(self, rows: Any) -> Any: ...

    def _occurrence_lookups(self, rows: Any, extents: Mapping[tuple, Optional[dict]]) -> tuple: ...

    def _catalog_instance_doc(self, instance: Mapping[str, Any], rows: Any = None) -> dict: ...

    def _visibility(self, rows: Any, system_id: str, caller: Any, instances: Sequence[Mapping[str, Any]],
                    tree: Any = ...) -> Any: ...

    def _harness_checks(self, loaded: "LoadedSystem") -> dict: ...


class LoadedSystem:
    def __init__(self, rows: Any, system: Mapping[str, Any], resolver: Resolver) -> None:
        self.rows = rows
        self.system = system
        self.id: str = system["id"]
        self._resolver = resolver
        self._restricted: dict[Any, Any] = {}
        self._interface_of: dict[str, Optional[dict]] = {}

    @property
    def version(self) -> int:
        return self.system["version"]

    @property
    def optional_rules(self) -> Sequence[str]:
        return self.system.get("optionalRules") or ()

    # ------------------------------------------------------------------
    # Rows

    @cached_property
    def boards(self) -> list[dict]:
        return self.rows.list_instances(self.id)

    @cached_property
    def children(self) -> list[dict]:
        """Assembly, module and part instances: the parent's own, pinning catalog revisions."""
        return self.rows.list_instances(self.id, kinds=CATALOG_KINDS)

    @cached_property
    def all_instances(self) -> list[dict]:
        return self.rows.list_instances(self.id, kinds=ALL_KINDS)

    @cached_property
    def links(self) -> list[dict]:
        return self.rows.list_links(self.id)

    @cached_property
    def exports(self) -> list[dict]:
        return self.rows.list_exports(self.id)

    @cached_property
    def harnesses(self) -> list[dict]:
        return self.rows.list_harnesses(self.id)

    @cached_property
    def subports(self) -> list[dict]:
        return self.rows.list_subports(self.id)

    @cached_property
    def open_reviews(self) -> list[dict]:
        return self.rows.list_reviews(self.id, status="open")

    @cached_property
    def open_renames(self) -> list[dict]:
        return self.rows.list_renames(self.id)

    @cached_property
    def waivers(self) -> list[dict]:
        return self.rows.list_waivers(self.id)

    @cached_property
    def poses(self) -> dict:
        return self.rows.list_poses(self.id)

    @cached_property
    def driving(self) -> dict:
        return self.rows.list_driving_mates(self.id)

    @cached_property
    def collision_check(self) -> Optional[dict]:
        return self.rows.get_collision_check(self.id)

    @cached_property
    def overrides(self) -> dict[str, dict[str, str]]:
        """Port overrides of every board, by instance (every board gets a map)."""
        return self.rows.overrides_of([i["id"] for i in self.boards])

    @cached_property
    def mating(self) -> dict[str, dict[str, dict]]:
        """Stored mating frames of every board, by instance and port (SYS-V17, the ICD)."""
        return self.rows.mating_of([i["id"] for i in self.boards])

    @cached_property
    def project_names(self) -> dict[str, dict]:
        """Each board project's name and deleted flag, role-blind (the document is redacted later)."""
        from app.services.systems import visibility

        return visibility.project_access(self.rows.conn, [i["project_id"] for i in self.boards], "admin")

    # ------------------------------------------------------------------
    # Interfaces and extraction

    @cached_property
    def board_interfaces(self) -> dict[str, dict]:
        """Each board's extracted interface at its baseline; boards not extracted yet are left out."""
        out = {}
        for instance in self.boards:
            found = self.rows.get_interface(instance["project_id"], instance["baseline_commit"], EXTRACTOR_VERSION)
            if found is not None:
                out[instance["id"]] = found
        return out

    @cached_property
    def interfaces(self) -> dict[str, dict]:
        """Every instance's interface: a board's artifact, an assembly's exports, a module's connectors
        or a part's model (P2 §5.6, §6.1). Missing ones are left out."""
        out = dict(self.board_interfaces)
        for child in self.children:
            synthetic = self._resolver._instance_interface(self.rows, child)
            if synthetic is not None:
                out[child["id"]] = synthetic
        return out

    def interface(self, instance_id: str) -> Optional[dict]:
        """One instance's interface, without reading the others' when they were not read yet."""
        if "interfaces" in self.__dict__:
            return self.interfaces.get(instance_id)
        if instance_id not in self._interface_of:
            instance = next((i for i in self.all_instances if i["id"] == instance_id), None)
            self._interface_of[instance_id] = (None if instance is None
                                               else self._resolver._instance_interface(self.rows, instance))
        return self._interface_of[instance_id]

    @cached_property
    def job_state(self) -> dict[str, dict]:
        """The latest extraction job of each board not extracted yet, by artifact key."""
        pending = [i for i in self.boards if i["id"] not in self.board_interfaces]
        return self.rows.latest_jobs(EXTRACT_JOB_KIND,
                                     [artifact_key(i["project_id"], i["baseline_commit"]) for i in pending])

    @cached_property
    def unavailable(self) -> dict[str, str]:
        """Boards whose extraction failed or was cancelled: their source is unavailable (SYS-V05)."""
        out = {}
        for instance in self.boards:
            job = self.job_state.get(artifact_key(instance["project_id"], instance["baseline_commit"]))
            if instance["id"] not in self.interfaces and job and job["status"] in ("failed", "cancelled"):
                out[instance["id"]] = job["error_code"] or "extraction_failed"
        return out

    # ------------------------------------------------------------------
    # Catalog instances

    @cached_property
    def catalog_docs(self) -> list[dict]:
        """Each assembly, module and part instance as the document shows it (catalog-backed)."""
        return [self._resolver._catalog_instance_doc(i, self.rows) for i in self.children]

    @cached_property
    def child_states(self) -> list[dict]:
        """``{instanceId, releaseStatus, openReviewCount, blocked}`` per catalog instance (SYS-V14/V15)."""
        return [{"instanceId": doc["id"], "releaseStatus": doc["catalog"]["releaseStatus"],
                 "openReviewCount": doc["catalog"]["openReviewCount"],
                 "blocked": (self.rows.get_source_check(doc["id"]) or {}).get("last_outcome") == "advance_blocked"}
                for doc in self.catalog_docs]

    @cached_property
    def end_components(self) -> dict[str, dict]:
        """Each harness's ``end ID -> mated component`` (see ``harnesses.end_components``)."""
        from app.services.systems import harnesses as harnesses_module

        return {h["id"]: harnesses_module.end_components(h, self.interfaces) for h in self.harnesses}

    # ------------------------------------------------------------------
    # Hierarchy, nets and placement

    @cached_property
    def _resolution(self) -> tuple[Optional[hierarchy.Tree], Optional[hierarchy.HierarchyError]]:
        try:
            return hierarchy.resolve(self.id, self.all_instances, self._resolver._child_loader(self.rows)), None
        except hierarchy.HierarchyError as error:
            return None, error

    @property
    def tree(self) -> hierarchy.Tree:
        """Every occurrence of the system (P2 §5); ``Invalid`` when the hierarchy breaks a limit."""
        tree, error = self._resolution
        if tree is None:
            raise Invalid(str(error))
        return tree

    @property
    def tree_or_none(self) -> Optional[hierarchy.Tree]:
        return self._resolution[0]

    @cached_property
    def level(self) -> system_nets.Level:
        """The root level of the connectivity walk: links, exports and harnesses, every resolved child
        attached, and the stored mating frames (boards and modules, §5.6) and driving mates."""
        instances = self.all_instances
        root = system_nets.Level(
            prefix="", kinds={i["id"]: i["kind"] for i in instances}, labels={i["id"]: i["label"] for i in instances},
            links=self.links, harnesses=self.harnesses,
            exports=[{"id": e["id"], "target": ({"instanceId": e["target_instance_id"], "portKey": e["target_port"]["portKey"],
                                                 "port": e["target_port"]} if e["target_port"]
                                                else {"instanceId": e["target_instance_id"], "exportId": e["target_export_id"]})}
                     for e in self.exports],
        )
        system_nets.attach_children(root, self.tree)
        root.mating = self.rows.mating_of([i["id"] for i in instances if i["kind"] in ("board", "module")])
        root.driving = self.driving
        return root

    @cached_property
    def extents(self) -> dict[tuple[str, str], Optional[dict]]:
        """Each board occurrence's outline and thickness by ``(project, commit)``; None when not extracted."""
        return {(o.project_id, o.baseline_commit): self.rows.get_interface_extent(o.project_id, o.baseline_commit,
                                                                                 EXTRACTOR_VERSION)
                for o in self.tree.boards if o.project_id and o.baseline_commit}

    @cached_property
    def placement(self) -> dict:
        """Every occurrence placed with its mates solved (§14.9). Reads only each board's outline and
        thickness and the mated connectors, never a whole artifact."""
        from app.services.systems import scene as scene_module

        interface_of, component_of = self._resolver._occurrence_lookups(self.rows, self.extents)
        return scene_module.place_tree(self.tree.occurrences, interface_of, self.poses, self.level, component_of)

    @property
    def has_b2b(self) -> bool:
        return any(link.get("type") == "b2b" for link in self.links)

    @cached_property
    def mate_mismatches(self) -> Optional[list[dict]]:
        """The root level's B2B mates that do not line up (SYS-V11); None without B2B links or a root solve."""
        if not self.has_b2b:
            return None
        solved = self.placement["results"].get("")
        return solved["mismatches"] if solved else None

    @cached_property
    def harness_checks(self) -> dict[str, dict]:
        """The root level's routed harnesses by ID: ``{lengths, collisions, tightBends}`` (§17.10)."""
        return self._resolver._harness_checks(self) if self.harnesses else {}

    # ------------------------------------------------------------------
    # Readers

    def restricted(self, caller: Any) -> Any:
        """What ``caller`` may not see (``redaction.Restricted``), by today's access (§8.2, P2 §5.4)."""
        key = getattr(caller, "role", caller)
        if key not in self._restricted:
            self._restricted[key] = self._resolver._visibility(self.rows, self.id, caller, self.all_instances,
                                                               tree=self.tree_or_none)
        return self._restricted[key]
