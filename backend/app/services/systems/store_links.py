"""Links and rows (CONTRACTS §5, §8.1; CONTRACTS_P2 §16.2, §17.2 drift, §22.2).

The end rules are ``links.py``'s; this module stores links and their rows. Its read and review
methods (``get_link``, ``drift_links``, ``set_link_port``, ``update_row_end``, ``delete_rows``) take a
link ID or a mated harness end's ID alike: a harness end is served as ``links.end_as_link`` and written
through the harness tables (the last section), so detection, reviews and reconcile never tell them apart.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from psycopg.types.json import Jsonb

from app.services.systems import links
from app.services.systems.store_base import (
    MAX_LINKS, MAX_ROWS, ROW_SOURCES, NotFound, Conflict, Invalid, new_id, _given_id, _port_baseline, _nets, Mutation,
)


class LinksStore:
    # ------------------------------------------------------------------
    # Links

    def list_links(self, system_id: str) -> list[dict]:
        links = [
            dict(row)
            for row in self.conn.execute(
                "SELECT * FROM system_links WHERE system_id = %s ORDER BY lower(name), id",
                (system_id,),
            ).fetchall()
        ]
        rows = self.conn.execute(
            """
            SELECT r.* FROM system_link_rows r
            JOIN system_links l ON l.id = r.link_id
            WHERE l.system_id = %s
            ORDER BY r.link_id, r.id
            """,
            (system_id,),
        ).fetchall()
        by_link: dict[str, list[dict]] = {}
        for row in rows:
            by_link.setdefault(row["link_id"], []).append(dict(row))
        for link in links:
            link["rows"] = by_link.get(link["id"], [])
        return links


    def get_link(self, system_id: str, link_id: str) -> dict:
        if links.is_harness_end(link_id):
            return self._end_view(system_id, link_id)
        row = self.conn.execute(
            "SELECT * FROM system_links WHERE system_id = %s AND id = %s", (system_id, link_id)
        ).fetchone()
        if row is None:
            raise NotFound(link_id)
        link = dict(row)
        link["rows"] = [
            dict(r)
            for r in self.conn.execute(
                "SELECT * FROM system_link_rows WHERE link_id = %s ORDER BY id", (link_id,)
            ).fetchall()
        ]
        return link


    def create_link(
        self, change: Mutation, *, a_instance_id: str, a_port: Mapping[str, Any],
        b_instance_id: str, b_port: Mapping[str, Any], name: str = "",
        harness: Optional[str] = None, link_id: Optional[str] = None,
        link_type: str = "unspecified", stack_height_mm: Optional[float] = None,
        a_subport_id: Optional[str] = None, b_subport_id: Optional[str] = None,
    ) -> dict:
        a_baseline, b_baseline = _port_baseline(a_port), _port_baseline(b_port)
        links.check_type(link_type, stack_height_mm)
        ends = (links.End(a_instance_id, a_baseline["portKey"], a_subport_id),
                links.End(b_instance_id, b_baseline["portKey"], b_subport_id))
        links.check_distinct(*ends)
        for end in ends:
            self.get_instance(change.system_id, end.instance_id)
            links.refuse_exported(self.exported_port(change.system_id, end.instance_id, end.port_key, end.subport_id))
        count = self.conn.execute(
            "SELECT count(*) AS n FROM system_links WHERE system_id = %s", (change.system_id,)
        ).fetchone()["n"]
        if count >= MAX_LINKS:
            raise Invalid(f"limit links_per_system ({MAX_LINKS})")
        link_id = _given_id("slk_", link_id)
        if link_type == "b2b":
            self._check_b2b_ports(change.system_id, link_id, ((a_instance_id, a_baseline["portKey"]),
                                                              (b_instance_id, b_baseline["portKey"])))
        self.conn.execute(
            """
            INSERT INTO system_links
                (id, system_id, name, harness, a_instance_id, a_port, b_instance_id, b_port, type, stack_height_mm,
                 a_subport_id, b_subport_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (link_id, change.system_id, name, harness or None, a_instance_id, Jsonb(a_baseline),
             b_instance_id, Jsonb(b_baseline), link_type, stack_height_mm, a_subport_id, b_subport_id),
        )
        change.audit(
            "link_created",
            {"linkId": link_id, "name": name, "harness": harness or None, "type": link_type,
             "a": _audit_end(a_instance_id, a_baseline, a_subport_id),
             "b": _audit_end(b_instance_id, b_baseline, b_subport_id)},
        )
        return self.get_link(change.system_id, link_id)


    def update_link(
        self, change: Mutation, link_id: str, *, name: Optional[str] = None, harness: Any = ...,
        link_type: Optional[str] = None, stack_height_mm: Any = ...,
    ) -> dict:
        before = self.get_link(change.system_id, link_id)
        values = {
            "name": before["name"] if name is None else name,
            "harness": before["harness"] if harness is ... else (harness or None),
        }
        new_type = before["type"] if link_type is None else link_type
        stack = before["stack_height_mm"] if stack_height_mm is ... else stack_height_mm
        if new_type != "b2b" and stack_height_mm is ...:
            stack = None  # leaving b2b drops the pair's stack height (§16.2)
        links.check_type(new_type, stack)
        if new_type == "b2b" and before["type"] != "b2b":
            self._check_b2b_ports(change.system_id, link_id, ((before["a_instance_id"], before["a_port"]["portKey"]),
                                                              (before["b_instance_id"], before["b_port"]["portKey"])))
        self.conn.execute(
            "UPDATE system_links SET name = %s, harness = %s, type = %s, stack_height_mm = %s, updated_at = NOW()"
            " WHERE id = %s",
            (values["name"], values["harness"], new_type, stack, link_id),
        )
        changed = {k: {"before": before[k], "after": v} for k, v in values.items() if before[k] != v}
        if before["stack_height_mm"] != stack:
            changed["stackHeightMm"] = {"before": before["stack_height_mm"], "after": stack}
        if changed:
            change.audit("link_updated", {"linkId": link_id, **changed})
        if before["type"] != new_type:
            change.audit("link_type_changed", {"linkId": link_id, "before": before["type"], "after": new_type})
        return self.get_link(change.system_id, link_id)


    def _check_b2b_ports(self, system_id: str, link_id: str, ends: Sequence[tuple[str, str]]) -> None:
        """§16.2 [T6]: a port is in at most one ``b2b`` link; P2 §22.2: never a split connector."""
        for instance_id, port_key in ends:
            if self.conn.execute("SELECT 1 FROM system_subports WHERE instance_id = %s AND port_key = %s LIMIT 1",
                                 (instance_id, port_key)).fetchone() is not None:
                raise Conflict("port_split: this connector has sub-ports; a board-to-board link mates a whole connector")
            clash = self.conn.execute(
                """
                SELECT id FROM system_links
                WHERE system_id = %s AND type = 'b2b' AND id <> %s
                  AND ((a_instance_id = %s AND a_port->>'portKey' = %s) OR (b_instance_id = %s AND b_port->>'portKey' = %s))
                LIMIT 1
                """,
                (system_id, link_id, instance_id, port_key, instance_id, port_key),
            ).fetchone()
            if clash is not None:
                raise Conflict("port_already_mated: this connector already mates in another board-to-board link")
            if self.harness_end_on_port(system_id, instance_id, port_key) is not None:
                raise Conflict("port_already_mated: a harness end mates this connector")


    def set_link_port(
        self, change: Mutation, link_id: str, end: str, port: Mapping[str, Any]
    ) -> None:
        """Replace one end's port baseline (silent relabel, rebind, accepted change)."""
        if end not in ("a", "b"):
            raise Invalid("end must be 'a' or 'b'")
        if links.is_harness_end(link_id):  # a harness end's mate (CONTRACTS_P2 §17.2 drift)
            self._set_end_port(change, link_id, port)
            return
        before = self.get_link(change.system_id, link_id)
        self.follow_connector(before[f"{end}_instance_id"], before[f"{end}_port"], port)  # P2 §22.4
        self.conn.execute(
            f"UPDATE system_links SET {end}_port = %s, updated_at = NOW() WHERE id = %s",
            (Jsonb(_port_baseline(port)), link_id),
        )


    def delete_link(self, change: Mutation, link_id: str) -> None:
        link = self.get_link(change.system_id, link_id)
        self.conn.execute("DELETE FROM system_links WHERE id = %s", (link_id,))
        change.audit(
            "link_deleted", {"linkId": link_id, "name": link["name"], "rowCount": len(link["rows"])}
        )


    def linked_port(self, system_id: str, instance_id: str, port_key: str, subport_id: Optional[str] = None) -> bool:
        return links.linked(self.list_links(system_id), links.End(instance_id, port_key, subport_id))

    def port_is_linked(self, system_id: str, instance_id: str, port_key: str) -> bool:
        """A link end or a harness end mates this port, or it has sub-ports (P2 §22.2)."""
        return self.conn.execute(
            """
            SELECT 1 FROM system_subports WHERE instance_id = %s AND port_key = %s
            UNION ALL
            SELECT 1 FROM system_links
            WHERE system_id = %s AND (
                (a_instance_id = %s AND a_port->>'portKey' = %s)
                OR (b_instance_id = %s AND b_port->>'portKey' = %s))
            UNION ALL
            SELECT 1 FROM system_harness_ends e JOIN system_harnesses h ON h.id = e.harness_id
            WHERE h.system_id = %s AND e.mates_instance_id = %s AND e.mates_port->>'portKey' = %s
            LIMIT 1
            """,
            (instance_id, port_key, system_id, instance_id, port_key, instance_id, port_key,
             system_id, instance_id, port_key),
        ).fetchone() is not None


    # ------------------------------------------------------------------
    # Rows

    def replace_rows(
        self, change: Mutation, link_id: str, rows: Sequence[Mapping[str, Any]],
        *, keep_new_ids: bool = False,
    ) -> list[dict]:
        """§8.1 ``PUT …/rows``: replace a link's rows atomically.

        Each row carries ``pinA``, ``pinB``, ``signal``, ``source`` and the net
        baselines ``netA``/``netB`` the caller captured from the current
        observation. A row with an ``id`` of this link keeps that id.
        """

        link = self.get_link(change.system_id, link_id)
        previous = {row["id"]: row for row in link["rows"]}
        existing = set(previous)
        seen: set[tuple[str, str]] = set()
        ids: set[str] = set()
        normalized = []
        for row in rows:
            pin_a, pin_b = str(row.get("pinA") or ""), str(row.get("pinB") or "")
            if not pin_a or not pin_b:
                raise Invalid("every row needs pinA and pinB")
            if (pin_a, pin_b) in seen:
                raise Invalid(f"duplicate row {pin_a} ↔ {pin_b}")
            seen.add((pin_a, pin_b))
            source = str(row.get("source") or "manual")
            if source not in ROW_SOURCES:
                raise Invalid(f"unknown row source {source!r}")
            row_id = row.get("id")
            if row_id is not None and row_id not in existing:
                if not keep_new_ids:
                    raise Conflict(f"row {row_id} does not belong to this link")
                _given_id("srw_", row_id)  # manifest import: a new row keeps its ID
            if row_id is not None and row_id in ids:
                raise Invalid(f"row {row_id} appears twice")
            if row_id is not None:
                ids.add(row_id)
            normalized.append(
                (row_id or new_id("srw_"), pin_a, pin_b, str(row.get("signal") or ""),
                 _nets(row.get("netA") or []), _nets(row.get("netB") or []), source)
            )
        other_rows = self.conn.execute(
            """
            SELECT count(*) AS n FROM system_link_rows r JOIN system_links l ON l.id = r.link_id
            WHERE l.system_id = %s AND r.link_id <> %s
            """,
            (change.system_id, link_id),
        ).fetchone()["n"]
        if other_rows + len(normalized) > MAX_ROWS:
            raise Invalid(f"limit rows_per_system ({MAX_ROWS})")
        self.conn.execute("DELETE FROM system_link_rows WHERE link_id = %s", (link_id,))
        for row_id, pin_a, pin_b, signal, net_a, net_b, source in normalized:
            self.conn.execute(
                """
                INSERT INTO system_link_rows (id, link_id, pin_a, pin_b, signal, net_a, net_b, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (row_id, link_id, pin_a, pin_b, signal, Jsonb(net_a), Jsonb(net_b), source),
            )
        kept = {row[0] for row in normalized}

        def described(pin_a: str, pin_b: str, signal: str, net_a: list, net_b: list) -> dict:
            return {"pinA": pin_a, "pinB": pin_b, "signal": signal, "netA": net_a, "netB": net_b}

        after = {row[0]: described(*row[1:6]) for row in normalized}
        before = {rid: described(r["pin_a"], r["pin_b"], r["signal"], list(r["net_a"]), list(r["net_b"]))
                  for rid, r in previous.items()}
        change.audit(
            "rows_replaced",
            {"linkId": link_id, "rowCount": len(normalized),
             "added": sorted(kept - existing), "removed": sorted(existing - kept),
             # What each row was and became, so history explains the engineering change.
             "rows": {
                 "added": [{"id": rid, **after[rid]} for rid in sorted(kept - existing)],
                 "removed": [{"id": rid, **before[rid]} for rid in sorted(existing - kept)],
                 "changed": [{"id": rid, "before": before[rid], "after": after[rid]}
                             for rid in sorted(kept & existing) if before[rid] != after[rid]],
             }},
        )
        return self.get_link(change.system_id, link_id)["rows"]


    def update_row_end(
        self, change: Mutation, link_id: str, row_id: str, end: str, *,
        pin: Optional[str] = None, nets: Sequence[str],
    ) -> None:
        """Set one end's accepted net set, and optionally its pin (§7.1)."""
        if end not in ("a", "b"):
            raise Invalid("end must be 'a' or 'b'")
        if links.is_harness_end(link_id):
            self._update_wire_end(link_id, row_id, pin=pin, nets=nets)
            return
        try:
            self.conn.execute(
                f"""
                UPDATE system_link_rows
                SET pin_{end} = COALESCE(%s, pin_{end}), net_{end} = %s
                WHERE id = %s AND link_id = %s
                """,
                (pin, Jsonb(_nets(nets)), row_id, link_id),
            )
        except Exception as error:
            if getattr(error, "sqlstate", None) == "23505":
                raise Conflict("the remapped row would duplicate another row") from None
            raise


    def delete_rows(self, change: Mutation, link_id: str, row_ids: Sequence[str]) -> None:
        if links.is_harness_end(link_id):
            self._delete_end_wires(link_id, row_ids)
            return
        self.conn.execute(
            "DELETE FROM system_link_rows WHERE link_id = %s AND id = ANY(%s)",
            (link_id, list(row_ids)),
        )



    # ------------------------------------------------------------------
    # Harness ends as links (§17.2 drift): the only code that reads or writes a harness end by a link ID

    def drift_links(self, system_id: str) -> list[dict]:
        """Links plus one link-shaped view per mated harness end, for drift and reviews only."""
        views = [links.end_as_link(harness, end) for harness in self.list_harnesses(system_id)
                 for end in harness["ends"] if end["mates_instance_id"] and end["mates_port"]]
        return self.list_links(system_id) + views


    def _end_view(self, system_id: str, end_id: str) -> dict:
        for harness in self.list_harnesses(system_id):
            for end in harness["ends"]:
                if end["id"] == end_id:
                    return links.end_as_link(harness, end)
        raise NotFound(end_id)

    def _set_end_port(self, change: Mutation, end_id: str, port: Mapping[str, Any]) -> None:
        before = self._end_view(change.system_id, end_id)
        self.conn.execute("UPDATE system_harness_ends SET mates_port = %s WHERE id = %s",
                          (Jsonb(_port_baseline(port)), end_id))
        self.follow_connector(before["a_instance_id"], before["a_port"], port)  # P2 §22.4

    def _update_wire_end(self, end_id: str, wire_id: str, *, pin: Optional[str], nets: Sequence[str]) -> None:
        """Accept (nets) or remap (``pin`` = the new connector pad, via the end's pin map) on one wire."""
        wire = self.conn.execute("SELECT * FROM system_harness_wires WHERE id = %s", (wire_id,)).fetchone()
        if wire is None:
            return
        side = "from" if wire["from_end"] == end_id else "to"
        if pin is not None:
            end = self.conn.execute("SELECT pin_map FROM system_harness_ends WHERE id = %s", (end_id,)).fetchone()
            pin_map = dict(end["pin_map"] or {})
            end_pin = wire[f"{side}_pin"]
            if pin == end_pin:
                pin_map.pop(end_pin, None)
            else:
                pin_map[end_pin] = pin
            if len(set(pin_map.values())) != len(pin_map):
                raise Conflict("the remapped pin would map two end pins to one pad")
            self.conn.execute("UPDATE system_harness_ends SET pin_map = %s WHERE id = %s",
                              (Jsonb(pin_map) if pin_map else None, end_id))
        self.conn.execute(f"UPDATE system_harness_wires SET net_{side} = %s WHERE id = %s",
                          (Jsonb(_nets(nets)), wire_id))


    def _delete_end_wires(self, end_id: str, wire_ids: Sequence[str]) -> None:
        self.conn.execute("DELETE FROM system_harness_wires WHERE id = ANY(%s)"
                          " AND (from_end = %s OR to_end = %s)", (list(wire_ids), end_id, end_id))


def _audit_end(instance_id: str, baseline: Mapping[str, Any], subport_id: Optional[str]) -> dict:
    end = {"instanceId": instance_id, "portKey": baseline["portKey"]}
    return {**end, "subportId": subport_id} if subport_id else end
