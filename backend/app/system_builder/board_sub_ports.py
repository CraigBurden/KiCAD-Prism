"""``ws_board_sub_ports``: a board's published pin groups (CONTRACTS.md §10).

A board-level sub-port is a project's named, ordered set of one connector's
pads, shared by every system that places the board. The row carries the
definition; ``ws_board_sub_port_history`` carries one entry per version. Every
write (including the soft delete) bumps ``version`` and inserts the history row
in the same transaction.

Unlike a system document, the row is keyed by a workspace-unique id that is
never reused, live or deleted. Name uniqueness holds only among the live rows
of one project and connector (the partial unique index); a deleted holder frees
its name for a new sub-port.
"""

from __future__ import annotations

import re
from contextlib import contextmanager
from typing import Any, Callable, ContextManager, Iterator, Mapping, Optional, Sequence

from psycopg import errors as pg_errors
from psycopg.types.json import Jsonb

from app.core import errors, preconditions
from app.core.config import settings
from app.services.design_bundle import schemas
from app.services.postgres_database import database
from app.system_builder.document import sub_port_endpoints

ETAG_KIND = "board-sub-port"
SCHEMA = "prism.board_sub_ports.a0"

ID_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
MAX_IDENTIFIER = 64

_LIVE_NAME_INDEX = "uq_ws_board_sub_ports_live_name"
_PRIMARY_KEY = "ws_board_sub_ports_pkey"

_COLUMNS = (
    "sub_port_id, project_id, connector, name, pins, version, "
    "created_by, created_at, updated_by, updated_at, deleted_at, deleted_by"
)
_SELECT = ", ".join(_COLUMNS.split(", "))
_HISTORY_COLUMNS = "sub_port_id, version, action, name, pins, actor, created_at"


class BoardSubPortNotFound(errors.NotFound):
    default_detail = "Board sub-port not found"


class BoardSubPortExists(errors.Conflict):
    code = "board_sub_port_exists"
    default_detail = "That board sub-port id has already been used"


class BoardSubPortNameTaken(errors.Conflict):
    code = "board_sub_port_name_taken"
    default_detail = "Name already used by a live sub-port of this connector"


class BoardSubPortDeleted(errors.Conflict):
    code = "board_sub_port_deleted"
    default_detail = "The board sub-port was deleted"


class BoardSubPortInvalid(errors.Invalid):
    code = "board_sub_port_invalid"


class StaleBoardSubPort(errors.StaleVersion):
    def __init__(self, sub_port_id: str, version: int) -> None:
        super().__init__(
            "The board sub-port changed since you read it; reload it and apply your change again.",
            headers={"ETag": preconditions.etag(ETAG_KIND, sub_port_id, version)},
        )


def etag(record: Mapping[str, Any]) -> str:
    return preconditions.etag(ETAG_KIND, record["sub_port_id"], record["version"])


@contextmanager
def workspace_connection() -> Iterator[Any]:
    with database.connection() as conn:
        conn.execute("SET search_path TO workspace, public")
        yield conn


def _invalid(detail: str) -> BoardSubPortInvalid:
    return BoardSubPortInvalid(detail)


def _identifier(sub_port_id: str) -> str:
    if not isinstance(sub_port_id, str) or not ID_PATTERN.fullmatch(sub_port_id):
        raise _invalid("id must match ^[a-z][a-z0-9_-]{0,63}$")
    return sub_port_id


def _text(value: str, field: str) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= MAX_IDENTIFIER:
        raise _invalid(f"{field} must be 1-64 characters")
    return value


def _validated_pins(pins: Sequence[Any]) -> list[str]:
    if not isinstance(pins, (list, tuple)) or not pins:
        raise _invalid("pins must be a non-empty list")
    if len(pins) > settings.PRISM_BOARD_SUB_PORT_MAX_PINS:
        raise _invalid(
            f"a sub-port may hold at most {settings.PRISM_BOARD_SUB_PORT_MAX_PINS} pins"
        )
    seen: set[str] = set()
    result: list[str] = []
    for pin in pins:
        if not isinstance(pin, str) or not pin:
            raise _invalid("every pin must be a non-empty string")
        if pin in seen:
            raise _invalid(f"pin {pin} appears more than once")
        seen.add(pin)
        result.append(pin)
    return result


def _unique_violation(error: pg_errors.UniqueViolation) -> errors.DomainError:
    constraint = error.diag.constraint_name
    if constraint == _LIVE_NAME_INDEX:
        return BoardSubPortNameTaken()
    if constraint == _PRIMARY_KEY:
        return BoardSubPortExists()
    return errors.Conflict("The board sub-port could not be stored", code="board_sub_port_conflict")


def _named_sub_ports(document: Mapping[str, Any]) -> dict[str, set[int]]:
    """The board-level ids the document names, with the versions its endpoints name.

    An endpoint names a board-level sub-port as ``subPort: {kind: "board", id,
    version}``. The same id may be named at several versions, and by several
    endpoints; each version is kept so ``previous`` can carry exactly those
    definitions (CONTRACTS.md §10.5).
    """

    named: dict[str, set[int]] = {}
    for endpoint in sub_port_endpoints(document):
        sub_port = (endpoint or {}).get("subPort") or {}
        if sub_port.get("kind") != "board":
            continue
        sub_port_id = str(sub_port.get("id") or "")
        if not sub_port_id:
            continue
        named.setdefault(sub_port_id, set())
        version = sub_port.get("version")
        if isinstance(version, int) and not isinstance(version, bool):
            named[sub_port_id].add(version)
    return named


def build_input(conn: Any, document: Mapping[str, Any]) -> dict[str, Any]:
    """The ``prism.board_sub_ports.a0`` build input for ``document`` (CONTRACTS.md §10.5).

    Every board-level sub-port an endpoint names is included, deleted ones
    included; an id no row holds is simply absent, so the build reports
    ``board-sub-port-missing``. ``previous`` lists ``{version, pins}`` for each
    distinct earlier version an endpoint names, from the history, so the build
    can tell a rename from a pins change. The result is schema-validated here,
    like every other input ``system build`` receives.
    """

    named = _named_sub_ports(document)
    if not named:
        return {"schema": SCHEMA, "subPorts": []}
    rows = {
        str(row["sub_port_id"]): row
        for row in conn.execute(
            f"SELECT {_SELECT} FROM ws_board_sub_ports WHERE sub_port_id = ANY(%s)",
            (sorted(named),),
        ).fetchall()
    }
    sub_ports: list[dict[str, Any]] = []
    for sub_port_id in sorted(rows):
        row = rows[sub_port_id]
        current = int(row["version"])
        older = sorted(version for version in named[sub_port_id] if version < current)
        previous: list[dict[str, Any]] = []
        if older:
            previous = [
                {"version": int(history["version"]), "pins": list(history["pins"])}
                for history in conn.execute(
                    "SELECT version, pins FROM ws_board_sub_port_history"
                    " WHERE sub_port_id = %s AND version = ANY(%s) ORDER BY version",
                    (sub_port_id, older),
                ).fetchall()
            ]
        sub_ports.append(
            {
                "id": sub_port_id,
                "projectId": str(row["project_id"]),
                "connector": str(row["connector"]),
                "name": str(row["name"]),
                "pins": list(row["pins"]),
                "version": current,
                "deleted": row["deleted_at"] is not None,
                "previous": previous,
            }
        )
    result = {"schema": SCHEMA, "subPorts": sub_ports}
    schemas.validate(result, SCHEMA)
    return result


def soft_delete_project_on(conn: Any, project_id: str, actor: str) -> int:
    """Soft-delete every live sub-port of ``project_id`` on ``conn``'s transaction.

    Used by project removal, which already holds the transaction that deletes
    the project, so the sub-ports leave with it atomically. Each row keeps its
    history and gains a ``delete`` entry, exactly like a direct delete.
    """

    rows = conn.execute(
        f"SELECT {_SELECT} FROM ws_board_sub_ports"
        " WHERE project_id = %s AND deleted_at IS NULL"
        " ORDER BY sub_port_id FOR UPDATE",
        (project_id,),
    ).fetchall()
    for row in rows:
        version = int(row["version"]) + 1
        conn.execute(
            """
            UPDATE ws_board_sub_ports
               SET version = %s, deleted_at = now(), deleted_by = %s,
                   updated_by = %s, updated_at = now()
             WHERE sub_port_id = %s
            """,
            (version, actor, actor, row["sub_port_id"]),
        )
        conn.execute(
            """
            INSERT INTO ws_board_sub_port_history
                (sub_port_id, version, action, name, pins, actor)
            VALUES (%s, %s, 'delete', %s, %s, %s)
            """,
            (row["sub_port_id"], version, row["name"], Jsonb(row["pins"]), actor),
        )
    return len(rows)


class BoardSubPortForbidden(errors.Forbidden):
    code = "board_sub_port_forbidden"
    default_detail = "Promoting needs design rights on the board's project"


def create_on(
    conn: Any, project_id: str, sub_port_id: str, connector: str, name: str,
    pins: Sequence[Any], *, actor: str,
) -> dict[str, Any]:
    """Insert version 1 and its history entry on ``conn`` without committing.

    For a caller that holds its own transaction, such as a system request that
    promotes a sub-port (CONTRACTS.md §10.5). Name and id clashes are checked
    before the insert, so a refusal never aborts the caller's transaction; a
    concurrent clash still fails the insert, and the caller rolls back.
    """

    sub_port_id = _identifier(sub_port_id)
    connector = _text(connector, "connector")
    name = _text(name, "name")
    clean_pins = _validated_pins(pins)
    if conn.execute("SELECT 1 FROM ws_board_sub_ports WHERE sub_port_id = %s", (sub_port_id,)).fetchone():
        raise BoardSubPortExists()
    taken = conn.execute(
        "SELECT 1 FROM ws_board_sub_ports"
        " WHERE project_id = %s AND connector = %s AND name = %s AND deleted_at IS NULL",
        (project_id, connector, name),
    ).fetchone()
    if taken:
        raise BoardSubPortNameTaken()
    live = conn.execute(
        "SELECT COUNT(*) AS n FROM ws_board_sub_ports WHERE project_id = %s AND deleted_at IS NULL",
        (project_id,),
    ).fetchone()
    if int(live["n"]) >= settings.PRISM_BOARD_SUB_PORT_MAX_PER_PROJECT:
        raise _invalid(f"the project already holds {settings.PRISM_BOARD_SUB_PORT_MAX_PER_PROJECT} live sub-ports")
    row = conn.execute(
        f"""
        INSERT INTO ws_board_sub_ports
            (sub_port_id, project_id, connector, name, pins, version, created_by, updated_by)
        VALUES (%s, %s, %s, %s, %s, 1, %s, %s)
        RETURNING {_COLUMNS}
        """,
        (sub_port_id, project_id, connector, name, Jsonb(clean_pins), actor, actor),
    ).fetchone()
    conn.execute(
        """
        INSERT INTO ws_board_sub_port_history (sub_port_id, version, action, name, pins, actor)
        VALUES (%s, 1, 'create', %s, %s, %s)
        """,
        (sub_port_id, name, Jsonb(clean_pins), actor),
    )
    return dict(row)


class BoardSubPortStore:
    def __init__(self, connect: Callable[[], ContextManager[Any]] = workspace_connection) -> None:
        self._connect = connect

    # ----------------------------------------------------------------- writes

    def create(
        self, project_id: str, sub_port_id: str, connector: str, name: str,
        pins: Sequence[Any], *, actor: str,
    ) -> dict[str, Any]:
        """Insert version 1 and its ``create`` history entry."""

        sub_port_id = _identifier(sub_port_id)
        connector = _text(connector, "connector")
        name = _text(name, "name")
        clean_pins = _validated_pins(pins)

        with self._connect() as conn:
            existing = conn.execute(
                "SELECT 1 FROM ws_board_sub_ports WHERE sub_port_id = %s",
                (sub_port_id,),
            ).fetchone()
            if existing is not None:
                raise BoardSubPortExists()
            live = conn.execute(
                "SELECT COUNT(*) AS n FROM ws_board_sub_ports"
                " WHERE project_id = %s AND deleted_at IS NULL",
                (project_id,),
            ).fetchone()
            if int(live["n"]) >= settings.PRISM_BOARD_SUB_PORT_MAX_PER_PROJECT:
                raise _invalid(
                    "the project already holds "
                    f"{settings.PRISM_BOARD_SUB_PORT_MAX_PER_PROJECT} live sub-ports"
                )
            try:
                row = conn.execute(
                    f"""
                    INSERT INTO ws_board_sub_ports
                        (sub_port_id, project_id, connector, name, pins, version, created_by, updated_by)
                    VALUES (%s, %s, %s, %s, %s, 1, %s, %s)
                    RETURNING {_COLUMNS}
                    """,
                    (
                        sub_port_id, project_id, connector, name, Jsonb(clean_pins),
                        actor, actor,
                    ),
                ).fetchone()
                conn.execute(
                    """
                    INSERT INTO ws_board_sub_port_history
                        (sub_port_id, version, action, name, pins, actor)
                    VALUES (%s, 1, 'create', %s, %s, %s)
                    """,
                    (sub_port_id, name, Jsonb(clean_pins), actor),
                )
                conn.commit()
            except pg_errors.UniqueViolation as error:
                conn.rollback()
                raise _unique_violation(error) from None
        return dict(row)

    def update(
        self, project_id: str, sub_port_id: str, *, name: str, pins: Sequence[Any],
        expected_version: Optional[int], actor: str,
    ) -> dict[str, Any]:
        """Change ``name`` and ``pins``, bump the version and log an ``update``."""

        name = _text(name, "name")
        clean_pins = _validated_pins(pins)

        with self._connect() as conn:
            row = conn.execute(
                f"SELECT {_SELECT} FROM ws_board_sub_ports"
                " WHERE sub_port_id = %s AND project_id = %s FOR UPDATE",
                (sub_port_id, project_id),
            ).fetchone()
            if row is None:
                raise BoardSubPortNotFound()
            if row["deleted_at"] is not None:
                raise BoardSubPortDeleted()
            if expected_version != row["version"]:
                raise StaleBoardSubPort(sub_port_id, int(row["version"]))
            try:
                updated = conn.execute(
                    f"""
                    UPDATE ws_board_sub_ports
                       SET name = %s, pins = %s, version = version + 1,
                           updated_by = %s, updated_at = now()
                     WHERE sub_port_id = %s
                     RETURNING {_COLUMNS}
                    """,
                    (name, Jsonb(clean_pins), actor, sub_port_id),
                ).fetchone()
                conn.execute(
                    """
                    INSERT INTO ws_board_sub_port_history
                        (sub_port_id, version, action, name, pins, actor)
                    VALUES (%s, %s, 'update', %s, %s, %s)
                    """,
                    (sub_port_id, updated["version"], name, Jsonb(clean_pins), actor),
                )
                conn.commit()
            except pg_errors.UniqueViolation as error:
                conn.rollback()
                raise _unique_violation(error) from None
        return dict(updated)

    def delete(
        self, project_id: str, sub_port_id: str, *, expected_version: Optional[int], actor: str,
    ) -> dict[str, Any]:
        """Soft-delete the row, bump the version and log a ``delete``."""

        with self._connect() as conn:
            row = conn.execute(
                f"SELECT {_SELECT} FROM ws_board_sub_ports"
                " WHERE sub_port_id = %s AND project_id = %s FOR UPDATE",
                (sub_port_id, project_id),
            ).fetchone()
            if row is None:
                raise BoardSubPortNotFound()
            if row["deleted_at"] is not None:
                raise BoardSubPortDeleted()
            if expected_version != row["version"]:
                raise StaleBoardSubPort(sub_port_id, int(row["version"]))
            updated = conn.execute(
                f"""
                UPDATE ws_board_sub_ports
                   SET version = version + 1, deleted_at = now(), deleted_by = %s,
                       updated_by = %s, updated_at = now()
                 WHERE sub_port_id = %s
                 RETURNING {_COLUMNS}
                """,
                (actor, actor, sub_port_id),
            ).fetchone()
            conn.execute(
                """
                INSERT INTO ws_board_sub_port_history
                    (sub_port_id, version, action, name, pins, actor)
                VALUES (%s, %s, 'delete', %s, %s, %s)
                """,
                (
                    sub_port_id, updated["version"], updated["name"],
                    Jsonb(updated["pins"]), actor,
                ),
            )
            conn.commit()
        return dict(updated)

    def soft_delete_project(self, project_id: str, actor: str) -> int:
        """Soft-delete every live sub-port of a removed project; their history stays."""

        with self._connect() as conn:
            count = soft_delete_project_on(conn, project_id, actor)
            conn.commit()
        return count

    # ------------------------------------------------------------------ reads

    def read(self, project_id: str, sub_port_id: str) -> Optional[dict[str, Any]]:
        """One record of this project, deleted or not, or None."""

        with self._connect() as conn:
            row = conn.execute(
                f"SELECT {_SELECT} FROM ws_board_sub_ports"
                " WHERE sub_port_id = %s AND project_id = %s",
                (sub_port_id, project_id),
            ).fetchone()
        return dict(row) if row is not None else None

    def list(
        self, project_id: str, *, connector: Optional[str] = None, deleted: bool = False,
    ) -> list[dict[str, Any]]:
        """The project's sub-ports by connector then name; deleted ones only on request."""

        conditions = ["project_id = %s"]
        params: list[Any] = [project_id]
        if not deleted:
            conditions.append("deleted_at IS NULL")
        if connector is not None:
            conditions.append("connector = %s")
            params.append(connector)
        with self._connect() as conn:
            rows = conn.execute(
                f"SELECT {_SELECT} FROM ws_board_sub_ports"
                f" WHERE {' AND '.join(conditions)}"
                " ORDER BY connector, name, sub_port_id",
                tuple(params),
            ).fetchall()
        return [dict(row) for row in rows]

    def history(self, project_id: str, sub_port_id: str) -> Optional[list[dict[str, Any]]]:
        """Every version of this project's sub-port, newest first; None when it is not one."""

        with self._connect() as conn:
            exists = conn.execute(
                "SELECT 1 FROM ws_board_sub_ports"
                " WHERE sub_port_id = %s AND project_id = %s",
                (sub_port_id, project_id),
            ).fetchone()
            if exists is None:
                return None
            rows = conn.execute(
                f"SELECT {_HISTORY_COLUMNS} FROM ws_board_sub_port_history"
                " WHERE sub_port_id = %s ORDER BY version DESC",
                (sub_port_id,),
            ).fetchall()
        return [dict(row) for row in rows]
