"""Exports (CONTRACTS_P2 §4): a system's ports offered to its parents, and re-exports of a child's exports."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from psycopg.types.json import Jsonb

from app.services.systems import links
from app.services.systems.store_base import MAX_EXPORTS, NotFound, Conflict, Invalid, _given_id, _port_baseline, Mutation


class ExportsStore:
    def list_exports(self, system_id: str) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM system_exports WHERE system_id = %s ORDER BY lower(name), id", (system_id,)
        ).fetchall()
        return [dict(row) for row in rows]

    def get_export(self, system_id: str, export_id: str) -> dict:
        row = self.conn.execute(
            "SELECT * FROM system_exports WHERE system_id = %s AND id = %s", (system_id, export_id)
        ).fetchone()
        if row is None:
            raise NotFound("Export not found")
        return dict(row)

    def exported_port(self, system_id: str, instance_id: str, port_key: str,
                      subport_id: Optional[str] = None) -> Optional[dict]:
        """The export whose target is this port (``links.exported``)."""
        return links.exported(self.list_exports(system_id), links.End(instance_id, port_key, subport_id))

    def _require_free_export_name(self, system_id: str, name: str, *, except_id: str = "") -> str:
        name = name.strip()
        if not name or len(name) > 100:
            raise Invalid("export name must be 1 to 100 characters")
        clash = self.conn.execute(
            "SELECT 1 FROM system_exports WHERE system_id = %s AND lower(name) = lower(%s) AND id <> %s",
            (system_id, name, except_id),
        ).fetchone()
        if clash:
            raise Conflict(f"an export named {name!r} already exists")
        return name

    def create_export(
        self, change: Mutation, *, name: str, description: str, instance_id: str,
        port: Optional[Mapping[str, Any]] = None, child_export_id: Optional[str] = None,
        export_id: Optional[str] = None, subport_id: Optional[str] = None,
    ) -> dict:
        """One of ``port`` (a board port baseline) or ``child_export_id`` (a re-export)."""
        if (port is None) == (child_export_id is None):
            raise Invalid("an export targets exactly one of a port or a child export")
        count = self.conn.execute(
            "SELECT count(*) AS n FROM system_exports WHERE system_id = %s", (change.system_id,)
        ).fetchone()["n"]
        if count >= MAX_EXPORTS:
            raise Invalid(f"export_limit: at most {MAX_EXPORTS} exports per system")
        instance = self.get_instance(change.system_id, instance_id)
        name = self._require_free_export_name(change.system_id, name)
        baseline = _port_baseline(port) if port is not None else None
        if baseline is not None:
            if instance.get("kind", "board") not in ("board", "module"):
                raise Invalid("a port export needs a board or module instance")
            if self.linked_port(change.system_id, instance_id, baseline["portKey"], subport_id):
                raise Conflict("export_port_linked: this port is an end of a link in this system")
            if self.exported_port(change.system_id, instance_id, baseline["portKey"], subport_id):
                raise Conflict("this port is already exported")
        else:
            if instance.get("kind", "board") != "assembly":
                raise Invalid("a re-export needs an assembly instance")
            if self.linked_port(change.system_id, instance_id, child_export_id, subport_id):
                raise Conflict("export_port_linked: this subsystem export is an end of a link in this system")
            if self.exported_port(change.system_id, instance_id, child_export_id, subport_id):
                raise Conflict("this subsystem export is already re-exported")
        export_id = _given_id("sxp_", export_id)
        self.conn.execute(
            """
            INSERT INTO system_exports
                (id, system_id, name, description, target_instance_id, target_port, target_export_id,
                 target_subport_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (export_id, change.system_id, name, description or "", instance_id,
             Jsonb(baseline) if baseline is not None else None, child_export_id, subport_id),
        )
        created = {"exportId": export_id, "name": name, "instanceId": instance_id,
                   "portKey": baseline["portKey"] if baseline else None, "childExportId": child_export_id}
        change.audit("export_created", {**created, "subportId": subport_id} if subport_id else created)
        return self.get_export(change.system_id, export_id)

    def update_export(
        self, change: Mutation, export_id: str, *, name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict:
        before = self.get_export(change.system_id, export_id)
        values = {
            "name": before["name"] if name is None else self._require_free_export_name(
                change.system_id, name, except_id=export_id),
            "description": before["description"] if description is None else description,
        }
        self.conn.execute(
            "UPDATE system_exports SET name = %s, description = %s, updated_at = NOW() WHERE id = %s",
            (values["name"], values["description"], export_id),
        )
        changed = {k: {"before": before[k], "after": v} for k, v in values.items() if before[k] != v}
        if changed:
            change.audit("export_updated", {"exportId": export_id, **changed})
        return self.get_export(change.system_id, export_id)

    def retarget_export(
        self, change: Mutation, export_id: str, *, instance_id: str, port: Mapping[str, Any],
    ) -> dict:
        """Point an export at another board port; its ID never changes (§4.1)."""
        before = self.get_export(change.system_id, export_id)
        baseline = _port_baseline(port)
        instance = self.get_instance(change.system_id, instance_id)
        if instance.get("kind", "board") not in ("board", "module"):
            raise Invalid("a port export needs a board or module instance")
        if self.linked_port(change.system_id, instance_id, baseline["portKey"]):
            raise Conflict("export_port_linked: this port is an end of a link in this system")
        other = self.exported_port(change.system_id, instance_id, baseline["portKey"])
        if other and other["id"] != export_id:
            raise Conflict("this port is already exported")
        self.conn.execute(
            """
            UPDATE system_exports
            SET target_instance_id = %s, target_port = %s, target_export_id = NULL, target_subport_id = NULL,
                updated_at = NOW()
            WHERE id = %s
            """,
            (instance_id, Jsonb(baseline), export_id),
        )
        change.audit("export_retargeted", {
            "exportId": export_id,
            "before": {"instanceId": before["target_instance_id"],
                       "portKey": (before["target_port"] or {}).get("portKey"),
                       "childExportId": before["target_export_id"]},
            "after": {"instanceId": instance_id, "portKey": baseline["portKey"]},
        })
        return self.get_export(change.system_id, export_id)

    def set_export_port(self, change: Mutation, export_id: str, port: Mapping[str, Any]) -> None:
        """Refresh an export's port baseline after a silent relabel or rebind (no audit of its own)."""
        before = self.get_export(change.system_id, export_id)
        self.conn.execute(
            "UPDATE system_exports SET target_port = %s, updated_at = NOW() WHERE id = %s",
            (Jsonb(_port_baseline(port)), export_id),
        )
        if before["target_port"]:
            self.follow_connector(before["target_instance_id"], before["target_port"], port)  # P2 §22.4

    def delete_export(self, change: Mutation, export_id: str) -> None:
        export = self.get_export(change.system_id, export_id)
        self.conn.execute("DELETE FROM system_exports WHERE id = %s", (export_id,))
        change.audit("export_deleted", {"exportId": export_id, "name": export["name"],
                                        "instanceId": export["target_instance_id"]})
