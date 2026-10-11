"""Shared pieces of the System Builder store: limits, errors, helpers, ``Mutation``, systems.

``store.SystemStore`` is assembled from mixins by area; this module holds what every area uses.
See ``store.py`` for the transaction and versioning rules.
"""

from __future__ import annotations

import re
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Iterator, Mapping, Optional, Sequence

from psycopg.types.json import Jsonb

from app.core import errors
from app.services.systems.visibility import etag

if TYPE_CHECKING:
    from app.services.systems.store import SystemStore

# §8.3 (default O4).
MAX_INSTANCES = 50
MAX_LINKS = 500
MAX_ROWS = 5000
MAX_HARNESSES = 500
MAX_HARNESS_ENDS = 32
MAX_WIRES = 5000
MAX_HARNESS_NODES = 256
HARNESS_NODE_PREFIX = "shd_"
HARNESS_END_PREFIX = "she_"
MAX_EXPORTS = 200

ROW_SOURCES = frozenset({"manual", "generator", "import"})
OVERRIDE_STATES = frozenset({"hidden", "promoted"})
PORT_BASELINE_KEYS = ("portKey", "memberKeys", "reference", "libId", "footprint", "pinCount")


class SystemStoreError(errors.DomainError):
    """Base class. Each subclass is a typed domain error (``app.core.errors``) with one status."""


class NotFound(SystemStoreError, errors.NotFound):
    """404. Only a message written as "... not found" reaches the caller; an id never does."""

    def __init__(self, message: str = "") -> None:
        super().__init__(message, detail=message if message.endswith("not found") else "Not found")


class StaleVersion(SystemStoreError, errors.StaleVersion):
    """412: the caller's ETag version is not the current one. The response carries the current ETag."""

    def __init__(self, current: int, system_id: str = "") -> None:
        super().__init__(
            f"system is at version {current}",
            detail="System has changed; reload it",
            headers={"ETag": etag(system_id, current)},
        )
        self.current = current


class Conflict(SystemStoreError, errors.Conflict):
    """409: the request is well formed but contradicts current state."""


class Invalid(SystemStoreError, errors.Invalid):
    """422: schema or limit violation."""


class Forbidden(SystemStoreError, errors.Forbidden):
    """403: the caller may see the system but not this whole artifact."""


_COMMIT = re.compile(r"^[0-9a-f]{40}$")


def _require_commit(commit: str) -> str:
    if not isinstance(commit, str) or not _COMMIT.match(commit):
        raise Invalid("commit must be a full 40-character lowercase SHA")
    return commit


def new_id(prefix: str) -> str:
    """§2.1: a prefix plus 32 lowercase hex characters from a UUID4."""
    return f"{prefix}{uuid.uuid4().hex}"


def _given_id(prefix: str, value: Optional[str]) -> str:
    """A caller-supplied ID (manifest import keeps IDs), or a new one."""
    if value is None:
        return new_id(prefix)
    if not re.fullmatch(rf"{prefix}[0-9a-f]{{32}}", value):
        raise Invalid(f"{value!r} is not a {prefix} id")
    return value


def _port_baseline(port: Mapping[str, Any]) -> dict[str, Any]:
    missing = [key for key in PORT_BASELINE_KEYS if key not in port]
    if missing:
        raise Invalid(f"port baseline is missing {', '.join(missing)}")
    baseline = {key: port[key] for key in PORT_BASELINE_KEYS}
    if not baseline["portKey"] or baseline["portKey"] not in baseline["memberKeys"]:
        raise Invalid("portKey must be one of memberKeys")
    return baseline


def _iso(value: Any) -> Optional[str]:
    return value.isoformat() if hasattr(value, "isoformat") else value


def _pose_fact(pose: Optional[Mapping[str, Any]]) -> Optional[dict]:
    """A pose as audited: placement only, without who and when."""
    if pose is None:
        return None
    return {"translationMm": list(pose["translationMm"]), "rotation": list(pose["rotation"]), "source": pose["source"]}


def _nets(value: Sequence[str]) -> list[str]:
    return sorted({str(item) for item in value})


@dataclass
class Mutation:
    """An open, locked change to one system. Obtain it from ``store.mutation``."""

    store: "SystemStore"
    system_id: str
    actor: str
    version: int
    events: list[str] = field(default_factory=list)

    def audit(self, kind: str, payload: Mapping[str, Any] | None = None) -> str:
        event_id = new_id("sae_")
        self.store.conn.execute(
            """
            INSERT INTO system_audit_events (id, system_id, actor, kind, payload)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (event_id, self.system_id, self.actor, kind, Jsonb(dict(payload or {}))),
        )
        self.events.append(event_id)
        return event_id


class StoreCore:
    def __init__(self, conn: Any) -> None:
        self.conn = conn

    # ------------------------------------------------------------------
    # Systems

    def create_system(
        self, *, name: str, description: str = "", folder_id: Optional[str], actor: str,
        system_id: Optional[str] = None, optional_rules: Sequence[str] = (),
    ) -> dict:
        if not name.strip():
            raise Invalid("name is required")
        system_id = _given_id("sys_", system_id)
        row = self.conn.execute(
            """
            INSERT INTO system_projects (id, name, description, folder_id, created_by, optional_rules)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (system_id, name.strip(), description, folder_id, actor, sorted(set(optional_rules))),
        ).fetchone()
        Mutation(self, system_id, actor, row["version"]).audit(
            "system_created", {"name": row["name"], "folderId": folder_id}
        )
        return dict(row)

    def get_system(self, system_id: str) -> dict:
        row = self.conn.execute(
            "SELECT * FROM system_projects WHERE id = %s", (system_id,)
        ).fetchone()
        if row is None:
            raise NotFound(system_id)
        return dict(row)

    def list_systems(self) -> list[dict]:
        """Every system with its counts. Role visibility is applied by the caller."""
        rows = self.conn.execute(
            """
            SELECT s.*,
                   (SELECT count(*) FROM system_instances i WHERE i.system_id = s.id)
                       AS instance_count,
                   (SELECT count(*) FROM system_reviews r
                     WHERE r.system_id = s.id AND r.status = 'open') AS open_review_count
            FROM system_projects s
            ORDER BY lower(s.name), s.id
            """
        ).fetchall()
        return [dict(row) for row in rows]

    @contextmanager
    def mutation(
        self, system_id: str, *, expected_version: Optional[int], actor: str, bump: bool = True,
        archived_ok: bool = False,
    ) -> Iterator[Mutation]:
        """``bump=False`` locks and checks the version but leaves it alone, for
        audited writes that change no engineering state (a snapshot, §9.1).
        An archived system refuses every change (D-P2-31) except a delete retry (``archived_ok``)."""

        row = self.conn.execute(
            "SELECT version, archived_at FROM system_projects WHERE id = %s FOR UPDATE", (system_id,)
        ).fetchone()
        if row is None:
            raise NotFound(system_id)
        if row["archived_at"] is not None and not archived_ok:
            raise Conflict("system_archived: this system is archived and read-only")
        if expected_version is not None and int(expected_version) != int(row["version"]):
            raise StaleVersion(int(row["version"]), system_id)
        change = Mutation(self, system_id, actor, int(row["version"]))
        yield change
        if not bump:
            return
        bumped = self.conn.execute(
            """
            UPDATE system_projects SET version = version + 1, updated_at = NOW()
            WHERE id = %s RETURNING version
            """,
            (system_id,),
        ).fetchone()
        change.version = int(bumped["version"])

    def count_snapshots_of_revisions(self, revision_ids: Sequence[str]) -> int:
        """Snapshots, in any system, whose frozen instances pin one of ``revision_ids`` (D-P2-31).

        The manifest names each assembly's catalog revision; a snapshot from before manifests
        records it in its document."""
        if not revision_ids:
            return 0
        row = self.conn.execute(
            """
            SELECT COUNT(*) AS n FROM system_snapshots s
            WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(s.manifest -> 'instances', '[]'::jsonb)) i
                          WHERE i -> 'catalog' ->> 'revisionId' = ANY(%(ids)s))
               OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(s.document -> 'instances', '[]'::jsonb)) i
                          WHERE i ->> 'catalogRevisionId' = ANY(%(ids)s)
                             OR i -> 'catalog' ->> 'revisionId' = ANY(%(ids)s))
            """,
            {"ids": list(revision_ids)},
        ).fetchone()
        return int(row["n"])

    def archive_system(self, change: Mutation) -> None:
        self.conn.execute(
            "UPDATE system_projects SET archived_at = NOW(), archived_by = %s WHERE id = %s AND archived_at IS NULL",
            (change.actor, change.system_id),
        )
        change.audit("system_archived")

    def count_instances_of_revisions(self, revision_ids: Sequence[str]) -> int:
        """Assembly instances, in any system, that pin one of ``revision_ids`` (D-P2-29)."""
        if not revision_ids:
            return 0
        row = self.conn.execute(
            "SELECT COUNT(*) AS n FROM system_instances WHERE catalog_revision_id = ANY(%s)", (list(revision_ids),)
        ).fetchone()
        return int(row["n"])

    def bind_catalog_component(self, change: Mutation, component_id: str) -> None:
        """First publish (CONTRACTS_P2 §3.3): the system's assembly, set once."""
        row = self.conn.execute(
            """
            UPDATE system_projects SET catalog_component_id = %s
            WHERE id = %s AND (catalog_component_id IS NULL OR catalog_component_id = %s)
            RETURNING id
            """,
            (component_id, change.system_id, component_id),
        ).fetchone()
        if row is None:
            raise Conflict("this system already publishes to another catalog component")

    def update_system(
        self, change: Mutation, *, name: Optional[str] = None,
        description: Optional[str] = None, folder_id: Any = ...,
        optional_rules: Optional[Sequence[str]] = None,
    ) -> dict:
        before = self.get_system(change.system_id)
        values = {
            "name": before["name"] if name is None else name.strip(),
            "description": before["description"] if description is None else description,
            "folder_id": before["folder_id"] if folder_id is ... else folder_id,
            "optional_rules": list(before["optional_rules"] or []) if optional_rules is None
            else sorted(set(optional_rules)),
        }
        if not values["name"]:
            raise Invalid("name is required")
        self.conn.execute(
            "UPDATE system_projects SET name = %s, description = %s, folder_id = %s, optional_rules = %s"
            " WHERE id = %s",
            (values["name"], values["description"], values["folder_id"], values["optional_rules"],
             change.system_id),
        )
        changed = {k: {"before": before[k], "after": v} for k, v in values.items() if before[k] != v}
        if changed:
            change.audit("system_updated", changed)
        return self.get_system(change.system_id)

    def delete_system(self, system_id: str) -> None:
        # No foreign key on purpose (migrations 49 and 52), so no cascade either.
        self.conn.execute("DELETE FROM system_finding_counts WHERE system_id = %s", (system_id,))
        self.conn.execute("DELETE FROM system_collision_checks WHERE system_id = %s", (system_id,))
        self.conn.execute("DELETE FROM system_step_exports WHERE system_id = %s", (system_id,))
        deleted = self.conn.execute(
            "DELETE FROM system_projects WHERE id = %s RETURNING id", (system_id,)
        ).fetchone()
        if deleted is None:
            raise NotFound(system_id)
