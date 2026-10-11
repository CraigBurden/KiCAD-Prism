"""Net rename proposals (SB2-106, CONTRACTS_P2 §23): propose, withdraw, and the board page's view."""

from __future__ import annotations

import csv
import io
from typing import Any, Optional

from app.services.systems import renames as renames_module, visibility
from app.services.systems.service_base import Caller, Result
from app.services.systems.service_rendering import rename_doc
from app.services.systems.store import Invalid, NotFound

CSV_COLUMNS = ("system", "board", "net", "rename_to", "rows", "connectors", "note", "proposed_by", "proposed_at")


class RenamesMixin:
    def propose_rename(self, caller: Caller, system_id: str, version: int, *, instance_id: str, net: str,
                       name: str, note: Optional[str] = None) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                instance = self._open_instance(store, system_id, instance_id, caller)
                if instance.get("kind", "board") != "board":
                    raise Invalid("only a board's nets can be renamed; a subsystem's are renamed inside it")
                problem = renames_module.check_name(net, name)
                if problem:
                    raise Invalid(problem)
                links = store.drift_links(system_id)
                rows = renames_module.covered(links, instance_id, net)
                if not rows:
                    raise Invalid(f"no row on {instance['label']} carries {net}")
                row = store.propose_rename(change, instance_id=instance_id, net=net, name=name,
                                           note=(note or "").strip()[:2000])
                body = rename_doc(row, len(rows))
        return Result(body, system_id, change.version)

    def withdraw_rename(self, caller: Caller, system_id: str, version: int, rename_id: str) -> Result:
        with self._tx() as store:
            self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=version, actor=caller.actor) as change:
                rename = store.get_rename(system_id, rename_id)
                try:
                    self._open_instance(store, system_id, rename["instance_id"], caller)
                except NotFound:
                    raise NotFound("Rename proposal not found") from None
                store.close_rename(change, rename_id, "withdrawn")
        return Result(None, system_id, change.version)

    def systems_using_project(self, caller: Caller, project_id: str) -> dict:
        """§23.5: the systems the reader can see that place ``project_id``, with their open proposals."""
        with self._tx(consistent=True) as store:
            self._require_project(store, project_id, caller)
            systems = {s["id"]: s for s in visibility.visible_systems(store.conn, caller.role)}
            rows = store.conn.execute(
                """
                SELECT id, system_id, label, baseline_commit, tracked_ref, pinned FROM system_instances
                WHERE project_id = %s AND system_id = ANY(%s) ORDER BY system_id, label
                """,
                (project_id, list(systems)),
            ).fetchall()
            by_system: dict[str, list[dict]] = {}
            for row in rows:
                by_system.setdefault(row["system_id"], []).append(dict(row))
            proposals = store.renames_on([row["id"] for row in rows])
            links = {sid: store.drift_links(sid) for sid in {p["system_id"] for p in proposals}}
        out = []
        for system_id, instances in sorted(by_system.items(), key=lambda item: systems[item[0]]["name"].casefold()):
            labels = {i["id"]: i["label"] for i in instances}
            found = [p for p in proposals if p["instance_id"] in labels]
            out.append({
                "id": system_id, "name": systems[system_id]["name"],
                "instances": [{"id": i["id"], "label": i["label"], "baselineCommit": i["baseline_commit"],
                               "trackedRef": i["tracked_ref"], "pinned": i["pinned"]} for i in instances],
                "renames": [{**rename_doc(p, len(renames_module.covered(links[system_id], p["instance_id"], p["net"]))),
                             "board": labels[p["instance_id"]],
                             "connectors": _connectors(links[system_id], p)} for p in found],
            })
        return {"projectId": project_id, "systems": out}

    def project_renames_csv(self, caller: Caller, project_id: str) -> str:
        """§23.5: the board owner's work list, one line per open proposal."""
        body = self.systems_using_project(caller, project_id)
        buffer = io.StringIO()
        writer = csv.writer(buffer, lineterminator="\r\n")
        writer.writerow(CSV_COLUMNS)
        for system in body["systems"]:
            for rename in system["renames"]:
                writer.writerow([_cell(v) for v in (
                    system["name"], rename["board"], rename["net"], rename["name"], rename["rows"],
                    " ".join(rename["connectors"]), rename["note"], rename["createdBy"].removeprefix("user:"),
                    (rename["createdAt"] or "")[:10])])
        return buffer.getvalue()


def _connectors(links: list[dict], proposal: dict) -> list[str]:
    """``J6.12`` for each pad that carries the net on the board, so the owner finds it fast."""
    out = set()
    for link in links:
        for end in ("a", "b"):
            if link.get(f"{end}_instance_id") != proposal["instance_id"]:
                continue
            reference = (link.get(f"{end}_port") or {}).get("reference") or "?"
            for row in link.get("rows") or ():
                if proposal["net"] in (row.get(f"net_{end}") or ()):
                    out.add(f"{reference}.{row[f'pin_{end}']}")
    return sorted(out)


def _cell(value: Any) -> str:
    """A cell a spreadsheet would read as a formula is prefixed (CSV injection)."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text
