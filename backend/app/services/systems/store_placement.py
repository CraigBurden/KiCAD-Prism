"""Placement (CONTRACTS_P2 §14): mating frames per port, poses per instance and driving mates."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence


from app.services.systems.store_base import Invalid, _iso, _pose_fact, Mutation


class PlacementStore:
    def list_mating(self, instance_id: str) -> dict[str, dict]:
        """CONTRACTS_P2 §15.2: ``port_key -> {mode, axis, quarterTurns, geometryDigest}``."""
        rows = self.conn.execute(
            "SELECT port_key, mode, axis, quarter_turns, geometry_digest FROM system_port_mating"
            " WHERE instance_id = %s",
            (instance_id,),
        ).fetchall()
        return {row["port_key"]: {"mode": row["mode"], "axis": row["axis"], "quarterTurns": int(row["quarter_turns"]),
                                  "geometryDigest": row["geometry_digest"]} for row in rows}

    def mating_of(self, instance_ids: Sequence[str]) -> dict[str, dict[str, dict]]:
        """``list_mating`` for many instances in one query (SB2-93); every ID gets a map."""
        out: dict[str, dict[str, dict]] = {iid: {} for iid in instance_ids}
        if out:
            for row in self.conn.execute(
                "SELECT instance_id, port_key, mode, axis, quarter_turns, geometry_digest FROM system_port_mating"
                " WHERE instance_id = ANY(%s)",
                (list(out),),
            ).fetchall():
                out[row["instance_id"]][row["port_key"]] = {
                    "mode": row["mode"], "axis": row["axis"], "quarterTurns": int(row["quarter_turns"]),
                    "geometryDigest": row["geometry_digest"]}
        return out

    def set_mating(
        self, change: Mutation, instance_id: str, port_key: str, record: Optional[Mapping[str, Any]]
    ) -> None:
        """Store a confirmed/override frame, or clear it (``None``) back to inferred."""
        self.get_instance(change.system_id, instance_id)
        before = self.list_mating(instance_id).get(port_key)
        if record is None:
            self.conn.execute(
                "DELETE FROM system_port_mating WHERE instance_id = %s AND port_key = %s", (instance_id, port_key)
            )
        else:
            self.conn.execute(
                """
                INSERT INTO system_port_mating (instance_id, port_key, mode, axis, quarter_turns, geometry_digest,
                                                updated_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (instance_id, port_key) DO UPDATE SET
                    mode = EXCLUDED.mode, axis = EXCLUDED.axis, quarter_turns = EXCLUDED.quarter_turns,
                    geometry_digest = EXCLUDED.geometry_digest, updated_by = EXCLUDED.updated_by, updated_at = NOW()
                """,
                (instance_id, port_key, record["mode"], record["axis"], int(record.get("quarterTurns") or 0),
                 record.get("geometryDigest"), change.actor),
            )
        after = self.list_mating(instance_id).get(port_key)
        if before != after:
            change.audit("mating_updated", {"instanceId": instance_id, "portKey": port_key,
                                            "before": before, "after": after})

    def list_poses(self, system_id: str) -> dict[str, dict]:
        """``instance_id -> {translationMm, rotation, source, updatedBy, updatedAt}``; an
        instance without a row takes its default pose."""
        rows = self.conn.execute(
            "SELECT instance_id, translation_mm, rotation, source, updated_by, updated_at FROM system_poses"
            " WHERE system_id = %s ORDER BY instance_id",
            (system_id,),
        ).fetchall()
        return {row["instance_id"]: {"translationMm": [float(v) for v in row["translation_mm"]],
                                     "rotation": [float(v) for v in row["rotation"]], "source": row["source"],
                                     "updatedBy": row["updated_by"], "updatedAt": _iso(row["updated_at"])}
                for row in rows}

    def set_pose(self, change: Mutation, instance_id: str, pose: Optional[Mapping[str, Any]]) -> None:
        """Store an instance's pose, or clear it (``None``) back to the default."""
        self.get_instance(change.system_id, instance_id)
        before = _pose_fact(self.list_poses(change.system_id).get(instance_id))
        if pose is None:
            self.conn.execute("DELETE FROM system_poses WHERE instance_id = %s", (instance_id,))
        else:
            self.conn.execute(
                """
                INSERT INTO system_poses (instance_id, system_id, translation_mm, rotation, source, updated_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (instance_id) DO UPDATE SET
                    translation_mm = EXCLUDED.translation_mm, rotation = EXCLUDED.rotation,
                    source = EXCLUDED.source, updated_by = EXCLUDED.updated_by, updated_at = NOW()
                """,
                (instance_id, change.system_id, [float(v) for v in pose["translationMm"]],
                 [float(v) for v in pose["rotation"]], pose["source"], change.actor),
            )
        after = _pose_fact(self.list_poses(change.system_id).get(instance_id))
        if before != after:
            change.audit("pose_updated", {"instanceId": instance_id, "before": before, "after": after})

    def reset_poses(self, change: Mutation, sources: Sequence[str] = ("manual",)) -> list[str]:
        """Delete the stored poses with these sources; return the instances reset."""
        rows = self.conn.execute(
            "DELETE FROM system_poses WHERE system_id = %s AND source = ANY(%s) RETURNING instance_id",
            (change.system_id, list(sources)),
        ).fetchall()
        reset = sorted(row["instance_id"] for row in rows)
        if reset:
            change.audit("poses_reset", {"instanceIds": reset, "sources": sorted(sources)})
        return reset

    def list_driving_mates(self, system_id: str) -> dict[str, str]:
        """``instance_id -> link_id``: the user's choice of which B2B link places an instance."""
        rows = self.conn.execute(
            "SELECT instance_id, link_id FROM system_driving_mates WHERE system_id = %s ORDER BY instance_id",
            (system_id,),
        ).fetchall()
        return {row["instance_id"]: row["link_id"] for row in rows}

    def set_driving_mate(self, change: Mutation, instance_id: str, link_id: Optional[str]) -> None:
        """Choose the B2B link that places ``instance_id`` (one of its ends), or clear the choice (``None``)."""
        self.get_instance(change.system_id, instance_id)
        before = self.list_driving_mates(change.system_id).get(instance_id)
        if link_id is None:
            self.conn.execute("DELETE FROM system_driving_mates WHERE instance_id = %s", (instance_id,))
        else:
            link = self.get_link(change.system_id, link_id)
            if link.get("type") != "b2b":
                raise Invalid("a driving mate must be a board-to-board link")
            if instance_id not in (link["a_instance_id"], link["b_instance_id"]):
                raise Invalid("a driving mate must be one of the instance's own links")
            self.conn.execute(
                """
                INSERT INTO system_driving_mates (instance_id, system_id, link_id, updated_by)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (instance_id) DO UPDATE SET
                    link_id = EXCLUDED.link_id, updated_by = EXCLUDED.updated_by, updated_at = NOW()
                """,
                (instance_id, change.system_id, link_id, change.actor),
            )
        after = self.list_driving_mates(change.system_id).get(instance_id)
        if before != after:
            change.audit("driving_mate_updated", {"instanceId": instance_id, "before": before, "after": after})
