"""Global resource slots and named locks held by fenced job attempts.

Every function runs on the caller's connection (search_path already set to
the workspace schema) inside the caller's transaction; none commits.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence

from app.services.job_rows import loads as _loads


LOCK_MODES = frozenset({"read", "write"})


def normalize_resources(resources: Mapping[str, int] | None) -> dict[str, int]:
    normalized: dict[str, int] = {}
    for name, count in (resources or {}).items():
        key = str(name).strip()
        value = int(count)
        if not key or value < 1:
            raise ValueError("Resource requirements must use non-empty names and positive counts")
        normalized[key] = value
    return normalized


def normalize_locks(
    locks: Sequence[Mapping[str, str]] | None,
) -> list[dict[str, str]]:
    normalized: dict[str, str] = {}
    for requirement in locks or ():
        key = str(requirement.get("key") or "").strip()
        mode = str(requirement.get("mode") or "").strip().lower()
        if not key or mode not in LOCK_MODES:
            raise ValueError("Lock requirements need a non-empty key and read/write mode")
        previous = normalized.get(key)
        normalized[key] = "write" if mode == "write" or previous == "write" else "read"
    return [{"key": key, "mode": normalized[key]} for key in sorted(normalized)]


def configure_resource_slots(conn: Any, capacities: Mapping[str, int]) -> None:
    """Reconcile configured slot rows without evicting active leases."""

    for resource_name, raw_capacity in sorted(capacities.items()):
        capacity = int(raw_capacity)
        if capacity < 0:
            raise ValueError("Resource capacity cannot be negative")
        conn.execute(
            "SELECT pg_advisory_xact_lock(hashtext(%s))",
            (f"prism-resource:{resource_name}",),
        )
        for slot_number in range(1, capacity + 1):
            conn.execute(
                """
                INSERT INTO ws_job_resource_slots(resource_name, slot_number)
                VALUES (%s, %s)
                ON CONFLICT (resource_name, slot_number) DO NOTHING
                """,
                (resource_name, slot_number),
            )
        conn.execute(
            """
            DELETE FROM ws_job_resource_slots
            WHERE resource_name = %s AND slot_number > %s AND job_id IS NULL
            """,
            (resource_name, capacity),
        )


def find_slots(
    conn: Any,
    resources: Mapping[str, int],
    *,
    reclaim_job_id: str | None = None,
) -> dict[str, list[int]] | None:
    selected: dict[str, list[int]] = {}
    for resource_name, count in sorted(resources.items()):
        rows = conn.execute(
            """
            SELECT slot_number
            FROM ws_job_resource_slots
            WHERE resource_name = %s
              AND (job_id IS NULL OR job_id = %s)
            ORDER BY slot_number
            FOR UPDATE SKIP LOCKED
            LIMIT %s
            """,
            (resource_name, reclaim_job_id, count),
        ).fetchall()
        numbers = [int(row["slot_number"]) for row in rows]
        if len(numbers) != count:
            return None
        selected[resource_name] = numbers
    return selected


def locks_available(
    conn: Any,
    job_id: str,
    requirements: Sequence[Mapping[str, str]],
) -> bool:
    for requirement in requirements:
        lock_key = str(requirement["key"])
        mode = str(requirement["mode"])
        conn.execute(
            "SELECT pg_advisory_xact_lock(hashtext(%s))",
            (f"prism-job-lock:{lock_key}",),
        )
        if mode == "read":
            conflict = conn.execute(
                """
                SELECT 1 FROM ws_job_locks
                WHERE lock_key = %s AND job_id <> %s AND mode = 'write'
                LIMIT 1
                """,
                (lock_key, job_id),
            ).fetchone()
        else:
            conflict = conn.execute(
                """
                SELECT 1 FROM ws_job_locks
                WHERE lock_key = %s AND job_id <> %s
                LIMIT 1
                """,
                (lock_key, job_id),
            ).fetchone()
        if conflict:
            return False
    return True


def release_non_authoritative_claims(conn: Any) -> None:
    """Release only claims whose owning job has already lost authority."""

    conn.execute(
        """
        UPDATE ws_job_resource_slots slot
        SET job_id = NULL, fence = NULL, lease_owner = '',
            lease_expires_at = NULL, updated_at = NOW()
        FROM ws_jobs job
        WHERE slot.job_id = job.id
          AND (
            job.status IN ('completed', 'failed', 'cancelled')
            OR slot.fence IS DISTINCT FROM job.fence
            OR slot.lease_owner IS DISTINCT FROM job.lease_owner
          )
        """
    )
    conn.execute(
        """
        DELETE FROM ws_job_locks lock
        USING ws_jobs job
        WHERE lock.job_id = job.id
          AND (
            job.status IN ('completed', 'failed', 'cancelled')
            OR lock.fence IS DISTINCT FROM job.fence
            OR lock.lease_owner IS DISTINCT FROM job.lease_owner
          )
        """
    )


def clear_job_claims(conn: Any, job_id: str) -> None:
    """Drop every slot and lock a job holds, under any fence, before it is reclaimed."""

    conn.execute(
        """
        UPDATE ws_job_resource_slots
        SET job_id = NULL, fence = NULL, lease_owner = '',
            lease_expires_at = NULL, updated_at = NOW()
        WHERE job_id = %s
        """,
        (job_id,),
    )
    conn.execute("DELETE FROM ws_job_locks WHERE job_id = %s", (job_id,))


def assign_slots(
    conn: Any,
    slots: Mapping[str, Iterable[int]],
    *,
    job_id: str,
    fence: int,
    worker_id: str,
    lease_seconds: int,
) -> None:
    for resource_name, numbers in slots.items():
        for slot_number in numbers:
            conn.execute(
                """
                UPDATE ws_job_resource_slots
                SET job_id = %s, fence = %s, lease_owner = %s,
                    lease_expires_at = NOW() + (%s * INTERVAL '1 second'),
                    updated_at = NOW()
                WHERE resource_name = %s AND slot_number = %s
                """,
                (job_id, fence, worker_id, lease_seconds, resource_name, slot_number),
            )


def assign_locks(
    conn: Any,
    requirements: Sequence[Mapping[str, str]],
    *,
    job_id: str,
    fence: int,
    worker_id: str,
    lease_seconds: int,
) -> None:
    for requirement in requirements:
        conn.execute(
            """
            INSERT INTO ws_job_locks(
                lock_key, job_id, fence, mode, lease_owner, lease_expires_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                NOW() + (%s * INTERVAL '1 second')
            )
            """,
            (
                requirement["key"],
                job_id,
                fence,
                requirement["mode"],
                worker_id,
                lease_seconds,
            ),
        )


def holds_claims(
    conn: Any,
    row: Mapping[str, Any],
    job_id: str,
    worker_id: str,
    fence: int,
) -> bool:
    """Whether the attempt still holds every slot and lock its job row requires."""

    resources = normalize_resources(
        _loads(row["resource_requirements"], {})
    )
    for resource_name, expected_count in resources.items():
        held = conn.execute(
            """
            SELECT COUNT(*) AS held
            FROM ws_job_resource_slots
            WHERE resource_name = %s
              AND job_id = %s
              AND fence = %s
              AND lease_owner = %s
              AND lease_expires_at >= NOW()
            """,
            (resource_name, job_id, fence, worker_id),
        ).fetchone()
        if int((held or {}).get("held") or 0) != expected_count:
            return False

    locks = normalize_locks(_loads(row["lock_requirements"], []))
    for requirement in locks:
        held = conn.execute(
            """
            SELECT 1
            FROM ws_job_locks
            WHERE lock_key = %s
              AND job_id = %s
              AND fence = %s
              AND lease_owner = %s
              AND mode = %s
              AND lease_expires_at >= NOW()
            """,
            (
                requirement["key"],
                job_id,
                fence,
                worker_id,
                requirement["mode"],
            ),
        ).fetchone()
        if not held:
            return False
    return True


def extend_claims(
    conn: Any, job_id: str, worker_id: str, fence: int, *, lease_seconds: int
) -> None:
    """Extend the attempt's slot and lock leases along with its job lease."""

    conn.execute(
        """
        UPDATE ws_job_resource_slots
        SET lease_expires_at = NOW() + (%s * INTERVAL '1 second'),
            updated_at = NOW()
        WHERE job_id = %s AND fence = %s AND lease_owner = %s
        """,
        (lease_seconds, job_id, fence, worker_id),
    )
    conn.execute(
        """
        UPDATE ws_job_locks
        SET lease_expires_at = NOW() + (%s * INTERVAL '1 second'),
            updated_at = NOW()
        WHERE job_id = %s AND fence = %s AND lease_owner = %s
        """,
        (lease_seconds, job_id, fence, worker_id),
    )


def release_claims(conn: Any, job_id: str, fence: int) -> None:
    conn.execute(
        """
        UPDATE ws_job_resource_slots
        SET job_id = NULL, fence = NULL, lease_owner = '',
            lease_expires_at = NULL, updated_at = NOW()
        WHERE job_id = %s AND fence = %s
        """,
        (job_id, fence),
    )
    conn.execute(
        "DELETE FROM ws_job_locks WHERE job_id = %s AND fence = %s",
        (job_id, fence),
    )
