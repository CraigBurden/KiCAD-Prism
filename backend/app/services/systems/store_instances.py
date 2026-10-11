"""Instances, port overrides, poses, links and rows."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from psycopg.types.json import Jsonb

from app.services.systems.store_base import (
    MAX_INSTANCES, MAX_LINKS, HARNESS_END_PREFIX, OVERRIDE_STATES, NotFound, Conflict, Invalid, _require_commit,
    _given_id, _check_link_type, _port_baseline, _iso, _pose_fact, Mutation,
)


class InstancesStore:
    # ------------------------------------------------------------------
    # Instances

    BOARD_KINDS = ("board",)
    ALL_KINDS = ("board", "assembly", "module", "part")

    def list_instances(self, system_id: str, *, kinds: Sequence[str] = BOARD_KINDS) -> list[dict]:
        """Boards by default: every P1 path (interfaces, drift, validation, access) is board-only.

        Pass ``kinds=SystemStore.ALL_KINDS`` where assembly and module
        instances matter (the document, the hierarchy, the manifest).
        """
        rows = self.conn.execute(
            "SELECT * FROM system_instances WHERE system_id = %s AND kind = ANY(%s) ORDER BY lower(label), id",
            (system_id, list(kinds)),
        ).fetchall()
        return [dict(row) for row in rows]

    def get_instance(self, system_id: str, instance_id: str) -> dict:
        row = self.conn.execute(
            "SELECT * FROM system_instances WHERE system_id = %s AND id = %s",
            (system_id, instance_id),
        ).fetchone()
        if row is None:
            raise NotFound(instance_id)
        return dict(row)

    def add_instance(
        self, change: Mutation, *, project_id: str, label: str, baseline_commit: str,
        tracked_ref: Optional[str], pinned: bool, instance_id: Optional[str] = None,
    ) -> dict:
        count = self.conn.execute(
            "SELECT count(*) AS n FROM system_instances WHERE system_id = %s", (change.system_id,)
        ).fetchone()["n"]
        if count >= MAX_INSTANCES:
            raise Invalid(f"limit instances_per_system ({MAX_INSTANCES})")
        _require_commit(baseline_commit)
        self._require_free_label(change.system_id, label)
        instance_id = _given_id("sin_", instance_id)
        row = self.conn.execute(
            """
            INSERT INTO system_instances
                (id, system_id, project_id, label, baseline_commit, tracked_ref, pinned)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (instance_id, change.system_id, project_id, label.strip(), baseline_commit,
             tracked_ref, bool(pinned)),
        ).fetchone()
        change.audit(
            "instance_added",
            {"instanceId": instance_id, "projectId": project_id, "label": row["label"],
             "baselineCommit": baseline_commit, "trackedRef": tracked_ref, "pinned": bool(pinned)},
        )
        return dict(row)

    def add_catalog_instance(
        self, change: Mutation, *, kind: str, label: str, component_id: str, revision_id: str,
        follow: str, instance_id: Optional[str] = None,
    ) -> dict:
        """An ``assembly``, ``module`` or (P2 §24.1) mechanical ``part`` instance pinning one catalog revision (§5.1)."""
        if kind not in ("assembly", "module", "part"):
            raise Invalid("kind must be assembly, module or part")
        if follow not in ("pinned", "latest_released"):
            raise Invalid("follow must be pinned or latest_released")
        count = self.conn.execute(
            "SELECT count(*) AS n FROM system_instances WHERE system_id = %s", (change.system_id,)
        ).fetchone()["n"]
        if count >= MAX_INSTANCES:
            raise Invalid(f"limit instances_per_system ({MAX_INSTANCES})")
        self._require_free_label(change.system_id, label)
        instance_id = _given_id("sin_", instance_id)
        row = self.conn.execute(
            """
            INSERT INTO system_instances
                (id, system_id, kind, label, catalog_component_id, catalog_revision_id, follow)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (instance_id, change.system_id, kind, label.strip(), component_id, revision_id, follow),
        ).fetchone()
        change.audit("instance_added", {
            "instanceId": instance_id, "kind": kind, "label": row["label"], "componentId": component_id,
            "revisionId": revision_id, "follow": follow,
        })
        return dict(row)

    def set_catalog_revision(self, change: Mutation, instance_id: str, revision_id: str, *, kind: str,
                             payload: Optional[Mapping[str, Any]] = None) -> None:
        """Move an assembly/module instance to another revision (audited as ``kind``)."""
        before = self.get_instance(change.system_id, instance_id)
        self.conn.execute(
            "UPDATE system_instances SET catalog_revision_id = %s, updated_at = NOW() WHERE id = %s",
            (revision_id, instance_id),
        )
        change.audit(kind, {"instanceId": instance_id, "from": before["catalog_revision_id"], "to": revision_id,
                            **dict(payload or {})})

    def set_follow(self, change: Mutation, instance_id: str, follow: str) -> None:
        if follow not in ("pinned", "latest_released"):
            raise Invalid("follow must be pinned or latest_released")
        before = self.get_instance(change.system_id, instance_id)
        if before["kind"] == "board":
            raise Invalid("only assembly and module instances follow catalog revisions")
        if before["follow"] == follow:
            return
        self.conn.execute("UPDATE system_instances SET follow = %s, updated_at = NOW() WHERE id = %s",
                          (follow, instance_id))
        change.audit("instance_updated", {"instanceId": instance_id,
                                          "follow": {"before": before["follow"], "after": follow}})

    def update_instance(
        self, change: Mutation, instance_id: str, *, label: Optional[str] = None,
        pinned: Optional[bool] = None, tracked_ref: Any = ...,
    ) -> dict:
        before = self.get_instance(change.system_id, instance_id)
        values = {
            "label": before["label"] if label is None else label.strip(),
            "pinned": before["pinned"] if pinned is None else bool(pinned),
            "tracked_ref": before["tracked_ref"] if tracked_ref is ... else tracked_ref,
        }
        if values["label"].lower() != before["label"].lower():
            self._require_free_label(change.system_id, values["label"])
        self.conn.execute(
            """
            UPDATE system_instances SET label = %s, pinned = %s, tracked_ref = %s, updated_at = NOW()
            WHERE id = %s
            """,
            (values["label"], values["pinned"], values["tracked_ref"], instance_id),
        )
        changed = {k: {"before": before[k], "after": v} for k, v in values.items() if before[k] != v}
        if "tracked_ref" in changed:
            # The old branch's tip says nothing about the new one.
            self.conn.execute(
                "UPDATE system_instances SET tip_commit = NULL, tip_checked_at = NULL WHERE id = %s",
                (instance_id,),
            )
            self.conn.execute("DELETE FROM system_source_checks WHERE instance_id = %s", (instance_id,))
        elif changed.get("pinned", {}).get("after") is False:
            # A pinned check only reported the tip; unpinned, the same tip must be evaluated.
            self.conn.execute("DELETE FROM system_source_checks WHERE instance_id = %s", (instance_id,))
        if changed:
            change.audit("instance_updated", {"instanceId": instance_id, **changed})
        return self.get_instance(change.system_id, instance_id)

    def set_baseline(
        self, change: Mutation, instance_id: str, commit: str, *, kind: str,
        payload: Mapping[str, Any] | None = None,
    ) -> None:
        """Move the accepted baseline; ``kind`` is the audit event (§10.2)."""
        _require_commit(commit)
        before = self.get_instance(change.system_id, instance_id)
        self.conn.execute(
            """
            UPDATE system_instances
            SET baseline_commit = %s, resolution = 'resolved', updated_at = NOW()
            WHERE id = %s
            """,
            (commit, instance_id),
        )
        change.audit(
            kind,
            {"instanceId": instance_id, "from": before["baseline_commit"], "to": commit,
             **dict(payload or {})},
        )

    def set_resolution(self, change: Mutation, instance_id: str, resolution: str) -> None:
        self.conn.execute(
            "UPDATE system_instances SET resolution = %s, updated_at = NOW() WHERE id = %s",
            (resolution, instance_id),
        )

    def remove_instance(self, change: Mutation, instance_id: str, *, cascade_links: bool) -> None:
        instance = self.get_instance(change.system_id, instance_id)
        links = self.conn.execute(
            """
            SELECT id FROM system_links
            WHERE system_id = %s AND (a_instance_id = %s OR b_instance_id = %s)
            ORDER BY id
            """,
            (change.system_id, instance_id, instance_id),
        ).fetchall()
        exports = self.conn.execute(
            "SELECT id FROM system_exports WHERE system_id = %s AND target_instance_id = %s ORDER BY id",
            (change.system_id, instance_id),
        ).fetchall()
        if links and not cascade_links:
            raise Conflict("instance is an endpoint of a link")
        if exports and not cascade_links:
            raise Conflict("instance carries exports; remove them or pass ?cascade=links")
        for link in links:
            self.delete_link(change, link["id"])
        for export in exports:
            self.delete_export(change, export["id"])
        self.conn.execute("DELETE FROM system_instances WHERE id = %s", (instance_id,))
        change.audit(
            "instance_removed",
            {"instanceId": instance_id, "projectId": instance["project_id"],
             "label": instance["label"], "removedLinks": [link["id"] for link in links]},
        )

    def instances_for_projects(self, project_ids: Sequence[str]) -> list[dict]:
        """Reverse index: every instance of the given projects, across systems."""
        if not project_ids:
            return []
        rows = self.conn.execute(
            "SELECT * FROM system_instances WHERE project_id = ANY(%s) ORDER BY system_id, id",
            (list(project_ids),),
        ).fetchall()
        return [dict(row) for row in rows]

    def mark_project_unresolved(self, project_id: str) -> list[str]:
        """§5.1: the child project is gone; keep its instances, unresolved.

        The affected systems' versions move, so an editor holding an old ETag
        re-reads before changing anything. Returns their IDs.
        """
        rows = self.conn.execute(
            """
            UPDATE system_instances SET resolution = 'unresolved', updated_at = NOW()
            WHERE project_id = %s AND resolution <> 'unresolved'
            RETURNING system_id
            """,
            (project_id,),
        ).fetchall()
        system_ids = sorted({row["system_id"] for row in rows})
        if system_ids:
            self.conn.execute(
                """
                UPDATE system_projects SET version = version + 1, updated_at = NOW()
                WHERE id = ANY(%s)
                """,
                (system_ids,),
            )
        return system_ids

    def _require_free_label(self, system_id: str, label: str) -> None:
        if not label.strip():
            raise Invalid("label is required")
        taken = self.conn.execute(
            "SELECT 1 FROM system_instances WHERE system_id = %s AND lower(label) = lower(%s)",
            (system_id, label.strip()),
        ).fetchone()
        if taken:
            raise Conflict(f"label {label.strip()!r} is already used in this system")

    # ------------------------------------------------------------------
    # Port overrides

    def list_overrides(self, instance_id: str) -> dict[str, str]:
        rows = self.conn.execute(
            "SELECT port_key, state FROM system_port_overrides WHERE instance_id = %s",
            (instance_id,),
        ).fetchall()
        return {row["port_key"]: row["state"] for row in rows}

    def list_mating(self, instance_id: str) -> dict[str, dict]:
        """CONTRACTS_P2 §15.2: ``port_key -> {mode, axis, quarterTurns, geometryDigest}``."""
        rows = self.conn.execute(
            "SELECT port_key, mode, axis, quarter_turns, geometry_digest FROM system_port_mating"
            " WHERE instance_id = %s",
            (instance_id,),
        ).fetchall()
        return {row["port_key"]: {"mode": row["mode"], "axis": row["axis"], "quarterTurns": int(row["quarter_turns"]),
                                  "geometryDigest": row["geometry_digest"]} for row in rows}

    def overrides_of(self, instance_ids: Sequence[str]) -> dict[str, dict[str, str]]:
        """``list_overrides`` for many instances in one query (SB2-93); every ID gets a map."""
        out: dict[str, dict[str, str]] = {iid: {} for iid in instance_ids}
        if out:
            for row in self.conn.execute(
                "SELECT instance_id, port_key, state FROM system_port_overrides WHERE instance_id = ANY(%s)",
                (list(out),),
            ).fetchall():
                out[row["instance_id"]][row["port_key"]] = row["state"]
        return out

    def latest_jobs(self, kind: str, artifact_keys: Sequence[str]) -> dict[str, dict]:
        """The newest ``kind`` job per artifact key: ``{key: {id, artifact_key, status, error_code}}``."""
        keys = sorted(set(artifact_keys))
        if not keys:
            return {}
        rows = self.conn.execute(
            """
            SELECT DISTINCT ON (artifact_key) id, artifact_key, status, error_code
            FROM ws_jobs
            WHERE kind = %s AND artifact_key = ANY(%s)
            ORDER BY artifact_key, created_at DESC
            """,
            (kind, keys),
        ).fetchall()
        return {row["artifact_key"]: dict(row) for row in rows}

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

    # ------------------------------------------------------------------
    # Poses (CONTRACTS_P2 §14.3)

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

    # ------------------------------------------------------------------
    # Driving mates (CONTRACTS_P2 §14.9)

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

    def set_override(
        self, change: Mutation, instance_id: str, port_key: str, state: Optional[str]
    ) -> None:
        self.get_instance(change.system_id, instance_id)
        if state is not None and state not in OVERRIDE_STATES:
            raise Invalid(f"unknown override state {state!r}")
        if state == "hidden" and self._port_is_linked(change.system_id, instance_id, port_key):
            raise Conflict("a port that is an endpoint of a link cannot be hidden")
        before = self.list_overrides(instance_id).get(port_key)
        if state is None:
            self.conn.execute(
                "DELETE FROM system_port_overrides WHERE instance_id = %s AND port_key = %s",
                (instance_id, port_key),
            )
        else:
            self.conn.execute(
                """
                INSERT INTO system_port_overrides (instance_id, port_key, state)
                VALUES (%s, %s, %s)
                ON CONFLICT (instance_id, port_key) DO UPDATE SET state = EXCLUDED.state
                """,
                (instance_id, port_key, state),
            )
        if before != state:
            change.audit(
                "port_override_set",
                {"instanceId": instance_id, "portKey": port_key, "before": before, "after": state},
            )

    def _port_is_linked(self, system_id: str, instance_id: str, port_key: str) -> bool:
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
    # Links and rows

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
        if link_id.startswith(HARNESS_END_PREFIX):
            return self._end_as_link(system_id, link_id)
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
        _check_link_type(link_type, stack_height_mm)
        if a_instance_id == b_instance_id and a_baseline["portKey"] == b_baseline["portKey"]:
            raise Invalid("both link ends are the same port")
        for instance_id, baseline, subport_id in ((a_instance_id, a_baseline, a_subport_id),
                                                  (b_instance_id, b_baseline, b_subport_id)):
            self.get_instance(change.system_id, instance_id)
            if self.exported_port(change.system_id, instance_id, baseline["portKey"], subport_id):
                raise Conflict("export_port_linked: this port is exported; delete or retarget the export first")
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


def _audit_end(instance_id: str, baseline: Mapping[str, Any], subport_id: Optional[str]) -> dict:
    end = {"instanceId": instance_id, "portKey": baseline["portKey"]}
    return {**end, "subportId": subport_id} if subport_id else end
