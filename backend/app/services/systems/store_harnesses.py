"""Harnesses (CONTRACTS_P2 §17): ends, wires, nodes and coverings."""

from __future__ import annotations

import math
from typing import Any, Mapping, Optional, Sequence

from psycopg.types.json import Jsonb

from app.services.systems.store_base import (
    MAX_HARNESSES, MAX_HARNESS_ENDS, MAX_WIRES, MAX_HARNESS_NODES, HARNESS_END_PREFIX,
    HARNESS_NODE_PREFIX, NotFound,
    Conflict, Invalid, new_id, _given_id, _port_baseline, _nets, Mutation,
)


class HarnessesStore:
    # ------------------------------------------------------------------
    # Harnesses (CONTRACTS_P2 §17)

    def list_harnesses(self, system_id: str) -> list[dict]:
        harnesses = [dict(r) for r in self.conn.execute(
            "SELECT * FROM system_harnesses WHERE system_id = %s ORDER BY lower(name), id", (system_id,)).fetchall()]
        if not harnesses:
            return []
        ids = [h["id"] for h in harnesses]
        ends: dict[str, list[dict]] = {}
        for row in self.conn.execute(
                "SELECT * FROM system_harness_ends WHERE harness_id = ANY(%s) ORDER BY harness_id, ordinal",
                (ids,)).fetchall():
            ends.setdefault(row["harness_id"], []).append(dict(row))
        wires: dict[str, list[dict]] = {}
        for row in self.conn.execute(
                "SELECT * FROM system_harness_wires WHERE harness_id = ANY(%s) ORDER BY harness_id, id",
                (ids,)).fetchall():
            wires.setdefault(row["harness_id"], []).append(dict(row))
        nodes: dict[str, list[dict]] = {}
        for row in self.conn.execute(
                "SELECT * FROM system_harness_nodes WHERE harness_id = ANY(%s) ORDER BY harness_id, kind, between_ids NULLS FIRST, ord, id",
                (ids,)).fetchall():
            nodes.setdefault(row["harness_id"], []).append(node_doc(row))
        for harness in harnesses:
            harness["ends"] = ends.get(harness["id"], [])
            harness["wires"] = wires.get(harness["id"], [])
            harness["nodes"] = nodes.get(harness["id"], [])
        return harnesses

    def get_harness(self, system_id: str, harness_id: str) -> dict:
        found = next((h for h in self.list_harnesses(system_id) if h["id"] == harness_id), None)
        if found is None:
            raise NotFound("Harness not found")
        return found

    def create_harness(
        self, change: Mutation, *, name: str, label: Optional[str] = None, harness_id: Optional[str] = None,
        cut_length_mm: Optional[float] = None, service_allowance_pct: Optional[float] = None,
        audit: Optional[Mapping[str, Any]] = None,
    ) -> dict:
        if not name.strip():
            raise Invalid("name is required")
        count = self.conn.execute("SELECT count(*) AS n FROM system_harnesses WHERE system_id = %s",
                                  (change.system_id,)).fetchone()["n"]
        if count >= MAX_HARNESSES:
            raise Invalid(f"limit harnesses_per_system ({MAX_HARNESSES})")
        harness_id = _given_id("shn_", harness_id)
        self.conn.execute(
            "INSERT INTO system_harnesses (id, system_id, name, label, cut_length_mm, service_allowance_pct)"
            " VALUES (%s, %s, %s, %s, %s, %s)",
            (harness_id, change.system_id, name.strip(), label or None, cut_length_mm, service_allowance_pct),
        )
        change.audit("harness_created", {"harnessId": harness_id, "name": name.strip(), **dict(audit or {})})
        return self.get_harness(change.system_id, harness_id)

    def update_harness(self, change: Mutation, harness_id: str, fields: Mapping[str, Any]) -> dict:
        before = self.get_harness(change.system_id, harness_id)
        columns = {"name": "name", "label": "label", "cutLengthMm": "cut_length_mm",
                   "serviceAllowancePct": "service_allowance_pct"}
        values = {column: before[column] for column in columns.values()}
        for key, column in columns.items():
            if key in fields:
                values[column] = fields[key]
        if not str(values["name"] or "").strip():
            raise Invalid("name is required")
        values["name"] = values["name"].strip()
        values["label"] = values["label"] or None
        self.conn.execute(
            "UPDATE system_harnesses SET name = %s, label = %s, cut_length_mm = %s, service_allowance_pct = %s,"
            " updated_at = NOW() WHERE id = %s",
            (values["name"], values["label"], values["cut_length_mm"], values["service_allowance_pct"], harness_id),
        )
        changed = {k: {"before": before[k], "after": v} for k, v in values.items() if before[k] != v}
        if changed:
            change.audit("harness_updated", {"harnessId": harness_id, **changed})
        return self.get_harness(change.system_id, harness_id)

    def set_coverings(self, change: Mutation, harness_id: str, coverings: Sequence[Mapping[str, Any]]) -> dict:
        """§26.1: replace the harness's coverings (already validated by the service)."""
        before = self.get_harness(change.system_id, harness_id)
        after = [dict(c) for c in coverings]
        self.conn.execute("UPDATE system_harnesses SET coverings = %s, updated_at = NOW() WHERE id = %s",
                          (Jsonb(after), harness_id))
        if list(before.get("coverings") or []) != after:
            change.audit("harness_updated", {"harnessId": harness_id,
                                             "coverings": {"before": list(before.get("coverings") or []), "after": after}})
        return self.get_harness(change.system_id, harness_id)

    def delete_harness(self, change: Mutation, harness_id: str) -> None:
        harness = self.get_harness(change.system_id, harness_id)
        self.conn.execute("DELETE FROM system_harnesses WHERE id = %s", (harness_id,))
        change.audit("harness_deleted", {"harnessId": harness_id, "name": harness["name"],
                                         "ends": len(harness["ends"]), "wires": len(harness["wires"])})

    def harness_end_on_port(self, system_id: str, instance_id: str, port_key: str,
                            exclude_end: Optional[str] = None) -> Optional[str]:
        row = self.conn.execute(
            """
            SELECT e.id FROM system_harness_ends e JOIN system_harnesses h ON h.id = e.harness_id
            WHERE h.system_id = %s AND e.mates_instance_id = %s AND e.mates_port->>'portKey' = %s AND e.id <> %s
            LIMIT 1
            """,
            (system_id, instance_id, port_key, exclude_end or ""),
        ).fetchone()
        return row["id"] if row else None

    def _check_end_mate(self, system_id: str, end_id: str, instance_id: str, port_key: str) -> None:
        """§17.2 [T6]: a port is mated by one harness end, and then by no b2b link."""
        self.get_instance(system_id, instance_id)
        if self.harness_end_on_port(system_id, instance_id, port_key, exclude_end=end_id):
            raise Conflict("port_already_mated: another harness end mates this connector")
        b2b = self.conn.execute(
            """
            SELECT 1 FROM system_links WHERE system_id = %s AND type = 'b2b'
              AND ((a_instance_id = %s AND a_port->>'portKey' = %s) OR (b_instance_id = %s AND b_port->>'portKey' = %s))
            LIMIT 1
            """,
            (system_id, instance_id, port_key, instance_id, port_key),
        ).fetchone()
        if b2b is not None:
            raise Conflict("port_already_mated: a board-to-board link mates this connector")
        if self.exported_port(system_id, instance_id, port_key):
            raise Conflict("export_port_linked: this port is exported; delete or retarget the export first")

    def add_harness_end(
        self, change: Mutation, harness_id: str, *, mates_instance_id: Optional[str] = None,
        mates_port: Optional[Mapping[str, Any]] = None, pin_count: int, end_id: Optional[str] = None,
        pin_map: Optional[Mapping[str, str]] = None, boot_mm: Optional[float] = None,
        catalog_component_id: Optional[str] = None, catalog_revision_id: Optional[str] = None,
        ordinal: Optional[int] = None, part_pins: Optional[Sequence[str]] = None,
        part_summary: Optional[Mapping[str, Any]] = None, contact_component_id: Optional[str] = None,
        contact_revision_id: Optional[str] = None, contact_summary: Optional[Mapping[str, Any]] = None,
    ) -> dict:
        harness = self.get_harness(change.system_id, harness_id)
        if len(harness["ends"]) >= MAX_HARNESS_ENDS:
            raise Invalid(f"a harness has at most {MAX_HARNESS_ENDS} ends")
        end_id = _given_id(HARNESS_END_PREFIX, end_id)
        baseline = _port_baseline(mates_port) if mates_port else None
        if (mates_instance_id is None) != (baseline is None):
            raise Invalid("an end mates an instance and a port, or nothing")
        if baseline is not None:
            self._check_end_mate(change.system_id, end_id, mates_instance_id, baseline["portKey"])
        if ordinal is None:
            ordinal = max((e["ordinal"] for e in harness["ends"]), default=-1) + 1
        self.conn.execute(
            """
            INSERT INTO system_harness_ends (id, harness_id, ordinal, mates_instance_id, mates_port,
                catalog_component_id, catalog_revision_id, pin_count, pin_map, boot_mm, part_pins, part_summary,
                contact_component_id, contact_revision_id, contact_summary)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (end_id, harness_id, ordinal, mates_instance_id, Jsonb(baseline) if baseline else None,
             catalog_component_id, catalog_revision_id, int(pin_count),
             Jsonb(dict(pin_map)) if pin_map else None, boot_mm,
             Jsonb(list(part_pins)) if part_pins is not None else None,
             Jsonb(dict(part_summary)) if part_summary is not None else None,
             contact_component_id, contact_revision_id,
             Jsonb(dict(contact_summary)) if contact_summary is not None else None),
        )
        change.audit("harness_updated", {"harnessId": harness_id, "endAdded": end_id,
                                         "mates": {"instanceId": mates_instance_id,
                                                   "portKey": baseline["portKey"]} if baseline else None})
        return self.get_harness(change.system_id, harness_id)

    def update_harness_end(self, change: Mutation, harness_id: str, end_id: str, fields: Mapping[str, Any]) -> dict:
        harness = self.get_harness(change.system_id, harness_id)
        before = next((e for e in harness["ends"] if e["id"] == end_id), None)
        if before is None:
            raise NotFound("Harness end not found")
        values = {k: before[k] for k in ("mates_instance_id", "mates_port", "catalog_component_id",
                                          "catalog_revision_id", "pin_count", "pin_map", "boot_mm", "part_pins",
                                          "part_summary", "contact_component_id", "contact_revision_id",
                                          "contact_summary")}
        if "mates" in fields:
            mates = fields["mates"]
            if mates is None:
                values["mates_instance_id"], values["mates_port"] = None, None
            else:
                baseline = _port_baseline(mates["port"])
                self._check_end_mate(change.system_id, end_id, mates["instanceId"], baseline["portKey"])
                values["mates_instance_id"], values["mates_port"] = mates["instanceId"], baseline
        for key, column in (("pinCount", "pin_count"), ("pinMap", "pin_map"), ("bootMm", "boot_mm"),
                            ("catalogComponentId", "catalog_component_id"),
                            ("catalogRevisionId", "catalog_revision_id"), ("partPins", "part_pins"),
                            ("partSummary", "part_summary"), ("contactComponentId", "contact_component_id"),
                            ("contactRevisionId", "contact_revision_id"), ("contactSummary", "contact_summary")):
            if key in fields:
                values[column] = fields[key]
        if values["pin_map"] is not None:
            mapped = list(values["pin_map"].values())
            if len(set(mapped)) != len(mapped):
                raise Invalid("each connector pad is mapped at most once")
            values["pin_map"] = dict(values["pin_map"]) or None
        self.conn.execute(
            """
            UPDATE system_harness_ends SET mates_instance_id = %s, mates_port = %s, catalog_component_id = %s,
                catalog_revision_id = %s, pin_count = %s, pin_map = %s, boot_mm = %s, part_pins = %s,
                part_summary = %s, contact_component_id = %s, contact_revision_id = %s, contact_summary = %s
            WHERE id = %s
            """,
            (values["mates_instance_id"], Jsonb(values["mates_port"]) if values["mates_port"] else None,
             values["catalog_component_id"], values["catalog_revision_id"], int(values["pin_count"]),
             Jsonb(values["pin_map"]) if values["pin_map"] else None, values["boot_mm"],
             Jsonb(list(values["part_pins"])) if values["part_pins"] is not None else None,
             Jsonb(dict(values["part_summary"])) if values["part_summary"] is not None else None,
             values["contact_component_id"], values["contact_revision_id"],
             Jsonb(dict(values["contact_summary"])) if values["contact_summary"] is not None else None, end_id),
        )
        changed = {k: {"before": before[k], "after": v} for k, v in values.items() if before[k] != v}
        if changed:
            change.audit("harness_updated", {"harnessId": harness_id, "endId": end_id, **changed})
        return self.get_harness(change.system_id, harness_id)

    def delete_harness_end(self, change: Mutation, harness_id: str, end_id: str) -> dict:
        harness = self.get_harness(change.system_id, harness_id)
        if not any(e["id"] == end_id for e in harness["ends"]):
            raise NotFound("Harness end not found")
        if len(harness["ends"]) == 1:
            raise Invalid("a harness keeps at least one end; delete the harness instead")
        wires = [w["id"] for w in harness["wires"] if end_id in (w["from_end"], w["to_end"])]
        self.conn.execute("DELETE FROM system_harness_ends WHERE id = %s", (end_id,))
        # Waypoints leading to the end go with it; breakouts stop listing it (§17.9).
        dropped = [n["id"] for n in harness["nodes"] if end_id in (n["between"] or [])]
        self.conn.execute("DELETE FROM system_harness_nodes WHERE harness_id = %s AND %s = ANY(between_ids)",
                          (harness_id, end_id))
        self.conn.execute("UPDATE system_harness_nodes SET ends = array_remove(ends, %s) WHERE harness_id = %s",
                          (end_id, harness_id))
        change.audit("harness_updated", {"harnessId": harness_id, "endRemoved": end_id, "wiresRemoved": wires,
                                         **({"nodesRemoved": dropped} if dropped else {})})
        return self.get_harness(change.system_id, harness_id)

    def replace_wires(self, change: Mutation, harness_id: str, wires: Sequence[Mapping[str, Any]],
                      *, keep_new_ids: bool = False) -> list[dict]:
        """Replace a harness's wire list. Callers capture ``netFrom``/``netTo`` (§17.2); a splice is allowed."""
        harness = self.get_harness(change.system_id, harness_id)
        ends = {e["id"] for e in harness["ends"]}
        existing = {w["id"] for w in harness["wires"]}
        ids: set[str] = set()
        normalized = []
        for wire in wires:
            source, target = wire.get("from") or {}, wire.get("to") or {}
            if source.get("end") not in ends or target.get("end") not in ends:
                raise Invalid("every wire joins two ends of this harness")
            if source["end"] == target["end"]:
                raise Invalid("a wire joins two different ends")
            if not str(source.get("pin") or "") or not str(target.get("pin") or ""):
                raise Invalid("every wire needs a pin at both ends")
            wire_id = wire.get("id")
            if wire_id is not None and wire_id not in existing:
                if not keep_new_ids:
                    raise Conflict(f"wire {wire_id} does not belong to this harness")
                _given_id("shw_", wire_id)
            if wire_id is not None and wire_id in ids:
                raise Invalid(f"wire {wire_id} appears twice")
            wire_id = wire_id or new_id("shw_")
            ids.add(wire_id)
            gauge = wire.get("gaugeAwg")
            if gauge is not None and not (isinstance(gauge, int) and 0 <= gauge <= 40):
                raise Invalid("gaugeAwg must be 0 to 40")
            normalized.append((wire_id, source["end"], str(source["pin"]), target["end"], str(target["pin"]),
                               str(wire.get("signal") or ""), gauge, wire.get("colour") or None,
                               wire.get("label") or None, _nets(wire.get("netFrom") or []),
                               _nets(wire.get("netTo") or [])))
        total = self.conn.execute(
            "SELECT count(*) AS n FROM system_harness_wires w JOIN system_harnesses h ON h.id = w.harness_id"
            " WHERE h.system_id = %s AND w.harness_id <> %s", (change.system_id, harness_id)).fetchone()["n"]
        if total + len(normalized) > MAX_WIRES:
            raise Invalid(f"limit wires_per_system ({MAX_WIRES})")
        self.conn.execute("DELETE FROM system_harness_wires WHERE harness_id = %s", (harness_id,))
        for row in normalized:
            self.conn.execute(
                """
                INSERT INTO system_harness_wires (id, harness_id, from_end, from_pin, to_end, to_pin, signal,
                    gauge_awg, colour, label, net_from, net_to)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (row[0], harness_id, *row[1:9], Jsonb(row[9]), Jsonb(row[10])),
            )
        kept = {row[0] for row in normalized}
        change.audit("harness_updated", {"harnessId": harness_id, "wireCount": len(normalized),
                                         "wiresAdded": sorted(kept - existing),
                                         "wiresRemoved": sorted(existing - kept)})
        return self.get_harness(change.system_id, harness_id)["wires"]

    def replace_nodes(self, change: Mutation, harness_id: str, nodes: Sequence[Mapping[str, Any]]) -> list[dict]:
        """Replace a harness's breakouts and waypoints (§17.9). Breakouts chain in list order; the
        waypoints between one pair of nodes go in list order from ``between[0]``. A new node may
        bring its own ``shd_`` ID so a waypoint can name a breakout added in the same list."""
        harness = self.get_harness(change.system_id, harness_id)
        ends = {e["id"] for e in harness["ends"]}
        existing = {n["id"] for n in harness["nodes"]}
        if len(nodes) > MAX_HARNESS_NODES:
            raise Invalid(f"limit nodes_per_harness ({MAX_HARNESS_NODES})")
        ids: list[str] = []
        for node in nodes:
            node_id = node.get("id")
            node_id = new_id(HARNESS_NODE_PREFIX) if node_id is None else _given_id(HARNESS_NODE_PREFIX, node_id)
            if node_id in ids:
                raise Invalid(f"node {node_id} appears twice")
            ids.append(node_id)
        taken = [r["id"] for r in self.conn.execute(
            "SELECT id FROM system_harness_nodes WHERE id = ANY(%s) AND harness_id <> %s",
            ([i for i in ids if i not in existing], harness_id)).fetchall()]
        if taken:
            raise Conflict(f"node {taken[0]} belongs to another harness")
        breakout_ids = {i for i, n in zip(ids, nodes) if n.get("kind") == "breakout"}
        branched: set[str] = set()
        directions: dict[frozenset, tuple[str, str]] = {}
        order = {"breakout": 0}
        rows = []
        for node_id, node in zip(ids, nodes):
            kind = node.get("kind")
            if kind not in ("breakout", "waypoint"):
                raise Invalid("kind is breakout or waypoint")
            position = node.get("positionMm")
            if (not isinstance(position, (list, tuple)) or len(position) != 3
                    or not all(isinstance(v, (int, float)) and math.isfinite(v) and abs(v) <= 1e6 for v in position)):
                raise Invalid(f"node {node_id}: positionMm is three finite numbers within 1 km")
            if kind == "breakout":
                listed = list(node.get("ends") or [])
                if node.get("pinned") or node.get("between"):
                    raise Invalid(f"breakout {node_id}: only waypoints are pinned or lie between nodes")
                for end_id in listed:
                    if end_id not in ends:
                        raise Invalid(f"breakout {node_id}: {end_id} is not an end of this harness")
                    if end_id in branched:
                        raise Invalid(f"end {end_id} joins one breakout")
                    branched.add(end_id)
                rows.append((node_id, kind, [float(v) for v in position], False, order["breakout"], listed, None))
                order["breakout"] += 1
            else:
                between = list(node.get("between") or [])
                if node.get("ends"):
                    raise Invalid(f"waypoint {node_id}: only breakouts list ends")
                if len(between) != 2 or between[0] == between[1] or not all(b in ends | breakout_ids for b in between):
                    raise Invalid(f"waypoint {node_id}: between names two ends or breakouts of this harness")
                pair = frozenset(between)
                if directions.setdefault(pair, (between[0], between[1])) != (between[0], between[1]):
                    raise Invalid(f"waypoint {node_id}: waypoints between the same nodes name them in the same order")
                key = "~".join(sorted(pair))
                rows.append((node_id, kind, [float(v) for v in position], bool(node.get("pinned")),
                             order.get(key, 0), [], between))
                order[key] = order.get(key, 0) + 1
        self.conn.execute("DELETE FROM system_harness_nodes WHERE harness_id = %s", (harness_id,))
        for row in rows:
            self.conn.execute(
                "INSERT INTO system_harness_nodes (id, harness_id, kind, position_mm, pinned, ord, ends, between_ids)"
                " VALUES (%s, %s, %s, %s, %s, %s, %s, %s)", (row[0], harness_id, *row[1:]))
        kept = set(ids)
        change.audit("harness_updated", {"harnessId": harness_id, "nodeCount": len(rows),
                                         "nodesAdded": sorted(kept - existing),
                                         "nodesRemoved": sorted(existing - kept)})
        return self.get_harness(change.system_id, harness_id)["nodes"]

def node_doc(row: Mapping[str, Any]) -> dict:
    """A stored node in its public shape (the manifest's ``harnesses[].nodes``, §17.9)."""
    return {"id": row["id"], "kind": row["kind"], "positionMm": list(row["position_mm"]),
            "pinned": row["pinned"], "order": row["ord"], "ends": list(row["ends"] or []),
            "between": list(row["between_ids"]) if row["between_ids"] else None}
