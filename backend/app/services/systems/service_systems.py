"""Systems: list, create, update and delete (§8.1, D-P2-31), audit history and layout."""

from __future__ import annotations

import json
from typing import Any, Mapping, Optional

from app.services.systems import redaction, validation, visibility
from app.services.systems.service_base import MAX_LAYOUT_ENTRIES, Caller, Result, _iso
from app.services.systems.store import Conflict, Invalid, SystemStore


class SystemsMixin:
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
    # History and layout (§1 invariant 6)

    def history(
        self, caller: Caller, system_id: str, *, cursor: Optional[int], limit: int
    ) -> dict:
        with self._tx() as store:
            self._system(store, system_id, caller)
            events = store.history(system_id, before_seq=cursor, limit=limit)
            # Removed instances too: their older events still name them.
            owners = store.instance_projects(system_id)
            project_ids = set(owners.values())
            for event in events:
                project = (event["payload"] or {}).get("projectId")
                if isinstance(project, str):
                    project_ids.add(project)
            access = visibility.project_access(store.conn, project_ids, caller.role)
            # Export ends whose source board inside a child is hidden (P2 §5.4); an event naming one
            # (a decided child-update item, a port update) can carry that board's nets.
            ports = redaction.hidden_ports(self._restricted_instances(store, system_id, caller))
            # Row edits are logged by link, not by end: a link with such an end withholds them too.
            hidden_links = {link["id"] for link in store.drift_links(system_id) for side in ("a", "b")
                            if (link[f"{side}_instance_id"], (link[f"{side}_port"] or {}).get("portKey")) in ports}
        hidden_projects = {pid for pid, seen in access.items() if not seen["visible"]}
        hidden_instances = {iid for iid, pid in owners.items() if pid in hidden_projects}
        out = []
        for event in events:
            text = json.dumps(event["payload"], sort_keys=True)
            redacted = (any(token in text for token in hidden_instances | hidden_projects)
                        or any(instance in text and export in text for instance, export in ports)
                        or any(link_id in text for link_id in hidden_links))
            out.append({
                "seq": int(event["seq"]), "id": event["id"], "at": _iso(event["at"]),
                "actor": event["actor"], "kind": event["kind"],
                "payload": None if redacted else event["payload"], "redacted": redacted,
            })
        next_cursor = out[-1]["seq"] if len(out) == limit and out else None
        return {"events": out, "nextCursor": next_cursor}

    def get_layout(self, caller: Caller, system_id: str) -> dict:
        with self._tx() as store:
            self._system(store, system_id, caller)
            return {"positions": store.get_layout(system_id)}

    def put_layout(self, caller: Caller, system_id: str, positions: Mapping[str, Any]) -> dict:
        if len(positions) > MAX_LAYOUT_ENTRIES:
            raise Invalid(f"limit layout_entries ({MAX_LAYOUT_ENTRIES})")
        if any(not key or len(key) > 200 for key in positions):
            raise Invalid("layout keys must be 1 to 200 characters")
        with self._tx() as store:
            self._system(store, system_id, caller)
            store.put_layout(system_id, positions)
            return {"positions": store.get_layout(system_id)}
