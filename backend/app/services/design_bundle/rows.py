"""The design bundle's workspace tables (migrations 100-102).

- ``ws_design_bundle_commit_index``: revision-key.md §10, one immutable row
  per ``(project, commit, config digest, algorithm)``;
- ``ws_design_bundles``: one row per stored bundle, its stages, job and use;
- ``ws_design_bundle_absences``: commits at which the project is absent;
- ``ws_design_bundle_flags``: what the backfill found about a project.

Every function takes an optional ``connect`` factory (a context manager that
yields a connection on the workspace schema and commits on exit); the default
is the workspace database's.
"""

from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any, Callable, Iterable, Mapping, Sequence

from psycopg.types.json import Jsonb

from app.services.design_bundle.revision_key import ALGORITHM

Connect = Callable[[], AbstractContextManager[Any]]
_ACTIVE = ("queued", "running", "retry_wait", "cancel_requested")


def default_connect() -> AbstractContextManager[Any]:
    from app.services.workspace_service import workspace

    return workspace._connect()


def _with(connect: Connect | None) -> Connect:
    return connect or default_connect


# ------------------------------------------------------------- commit index


def lookup_key(project_id: str, commit: str, config_digest: str, *, connect: Connect | None = None) -> str | None:
    with _with(connect)() as conn:
        row = conn.execute(
            """SELECT revision_key FROM ws_design_bundle_commit_index
               WHERE project_id=%s AND commit_sha=%s AND config_digest=%s AND algorithm=%s""",
            (project_id, commit, config_digest, ALGORITHM),
        ).fetchone()
    return str(row["revision_key"]) if row else None


def index_key(project_id: str, commit: str, config_digest: str, revision_key: str, *, connect: Connect | None = None) -> None:
    """Insert a computation; an existing row is immutable and must agree."""

    with _with(connect)() as conn:
        conn.execute(
            """INSERT INTO ws_design_bundle_commit_index
                   (project_id, commit_sha, config_digest, algorithm, revision_key)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (project_id, commit_sha, config_digest, algorithm) DO NOTHING""",
            (project_id, commit, config_digest, ALGORITHM, revision_key),
        )
        row = conn.execute(
            """SELECT revision_key FROM ws_design_bundle_commit_index
               WHERE project_id=%s AND commit_sha=%s AND config_digest=%s AND algorithm=%s""",
            (project_id, commit, config_digest, ALGORITHM),
        ).fetchone()
    if row and row["revision_key"] != revision_key:
        raise RuntimeError(f"commit index disagrees for {project_id}@{commit}: the key computation is not deterministic")


def keys_for_commits(project_id: str, commits: Iterable[str], *, connect: Connect | None = None) -> set[str]:
    wanted = sorted(set(commits))
    if not wanted:
        return set()
    with _with(connect)() as conn:
        rows = conn.execute(
            """SELECT DISTINCT revision_key FROM ws_design_bundle_commit_index
               WHERE project_id=%s AND commit_sha = ANY(%s)""",
            (project_id, wanted),
        ).fetchall()
    return {str(row["revision_key"]) for row in rows}


def prune_index(project_id: str, keep_commits: Iterable[str], *, older_than_days: int, connect: Connect | None = None) -> int:
    """Drop index rows of unkept commits whose key has no stored bundle any more."""

    with _with(connect)() as conn:
        result = conn.execute(
            """DELETE FROM ws_design_bundle_commit_index i
               WHERE i.project_id=%s AND NOT (i.commit_sha = ANY(%s))
                 AND i.created_at < NOW() - make_interval(days => %s)
                 AND NOT EXISTS (SELECT 1 FROM ws_design_bundles b
                                 WHERE b.project_id=i.project_id AND b.revision_key=i.revision_key)""",
            (project_id, sorted(set(keep_commits)), older_than_days),
        )
        return int(result.rowcount or 0)


# ------------------------------------------------------------------ bundles


def upsert_bundle(
    *,
    bundle_key: str,
    project_id: str,
    revision_key: str,
    generator_digest: str,
    commit: str | None,
    state: str,
    stages: Mapping[str, str] | None = None,
    job_id: str | None = None,
    error: str = "",
    archive_bytes: int | None = None,
    connect: Connect | None = None,
) -> None:
    with _with(connect)() as conn:
        conn.execute(
            """INSERT INTO ws_design_bundles
                   (bundle_key, project_id, revision_key, generator_digest, commit_sha, state, stages,
                    job_id, error, archive_bytes)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (project_id, bundle_key) DO UPDATE SET
                   state = EXCLUDED.state,
                   stages = CASE WHEN EXCLUDED.stages = '{}'::jsonb THEN ws_design_bundles.stages ELSE EXCLUDED.stages END,
                   job_id = COALESCE(EXCLUDED.job_id, ws_design_bundles.job_id),
                   commit_sha = COALESCE(ws_design_bundles.commit_sha, EXCLUDED.commit_sha),
                   error = EXCLUDED.error,
                   archive_bytes = CASE WHEN %s THEN EXCLUDED.archive_bytes ELSE ws_design_bundles.archive_bytes END,
                   updated_at = NOW()""",
            (
                bundle_key, project_id, revision_key, generator_digest, commit, state, Jsonb(dict(stages or {})),
                job_id, error, int(archive_bytes or 0), archive_bytes is not None,
            ),
        )


def get_bundle(project_id: str, bundle_key: str, *, connect: Connect | None = None) -> dict[str, Any] | None:
    with _with(connect)() as conn:
        row = conn.execute(
            "SELECT * FROM ws_design_bundles WHERE project_id=%s AND bundle_key=%s", (project_id, bundle_key)
        ).fetchone()
    return dict(row) if row else None


def touch_bundle(project_id: str, bundle_key: str, *, connect: Connect | None = None) -> None:
    """Mark a read (retention keeps bundles by use); at most once a minute per bundle."""

    with _with(connect)() as conn:
        conn.execute(
            """UPDATE ws_design_bundles SET last_used_at = NOW()
               WHERE project_id=%s AND bundle_key=%s AND last_used_at < NOW() - INTERVAL '1 minute'""",
            (project_id, bundle_key),
        )


def bundles(project_id: str | None = None, *, connect: Connect | None = None) -> list[dict[str, Any]]:
    with _with(connect)() as conn:
        if project_id is None:
            rows = conn.execute("SELECT * FROM ws_design_bundles ORDER BY project_id, created_at").fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM ws_design_bundles WHERE project_id=%s ORDER BY created_at", (project_id,)
            ).fetchall()
    return [dict(row) for row in rows]


def delete_bundles(project_id: str, bundle_keys: Sequence[str], *, connect: Connect | None = None) -> None:
    if not bundle_keys:
        return
    with _with(connect)() as conn:
        conn.execute(
            "DELETE FROM ws_design_bundles WHERE project_id=%s AND bundle_key = ANY(%s)", (project_id, list(bundle_keys))
        )


def superseded_generators(project_id: str, revision_key: str, keep_digest: str, *, connect: Connect | None = None) -> list[str]:
    """Bundle keys of the revision's other generators (removed when a new one is stored)."""

    with _with(connect)() as conn:
        rows = conn.execute(
            """SELECT bundle_key FROM ws_design_bundles
               WHERE project_id=%s AND revision_key=%s AND generator_digest<>%s""",
            (project_id, revision_key, keep_digest),
        ).fetchall()
    return [str(row["bundle_key"]) for row in rows]


# ----------------------------------------------------------- other outcomes


def record_absence(project_id: str, commit: str, project_file: str, *, connect: Connect | None = None) -> None:
    with _with(connect)() as conn:
        conn.execute(
            """INSERT INTO ws_design_bundle_absences (project_id, commit_sha, project_file)
               VALUES (%s, %s, %s) ON CONFLICT DO NOTHING""",
            (project_id, commit, project_file),
        )


def is_absent(project_id: str, commit: str, project_file: str, *, connect: Connect | None = None) -> bool:
    with _with(connect)() as conn:
        row = conn.execute(
            """SELECT 1 FROM ws_design_bundle_absences
               WHERE project_id=%s AND commit_sha=%s AND project_file=%s""",
            (project_id, commit, project_file),
        ).fetchone()
    return row is not None


def set_flags(project_id: str, commit: str, flags: Mapping[str, str], *, connect: Connect | None = None) -> None:
    """Replace the project's flags with ``{code: detail}`` found at ``commit``."""

    with _with(connect)() as conn:
        conn.execute("DELETE FROM ws_design_bundle_flags WHERE project_id=%s AND NOT (code = ANY(%s))", (project_id, sorted(flags)))
        for code, detail in sorted(flags.items()):
            conn.execute(
                """INSERT INTO ws_design_bundle_flags (project_id, code, commit_sha, detail)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (project_id, code) DO UPDATE
                   SET commit_sha=EXCLUDED.commit_sha, detail=EXCLUDED.detail, flagged_at=NOW()""",
                (project_id, code, commit, detail),
            )


def flags(project_id: str, *, connect: Connect | None = None) -> dict[str, dict[str, Any]]:
    with _with(connect)() as conn:
        rows = conn.execute(
            "SELECT code, commit_sha, detail FROM ws_design_bundle_flags WHERE project_id=%s ORDER BY code",
            (project_id,),
        ).fetchall()
    return {str(row["code"]): dict(row) for row in rows}


# ---------------------------------------------------------- jobs and pins


def active_jobs(kind: str, *, connect: Connect | None = None) -> int:
    with _with(connect)() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM ws_jobs WHERE kind=%s AND status = ANY(%s)", (kind, list(_ACTIVE))
        ).fetchone()
    return int(row["n"])


def job_status(job_id: str | None, *, connect: Connect | None = None) -> str | None:
    if not job_id:
        return None
    with _with(connect)() as conn:
        row = conn.execute("SELECT status FROM ws_jobs WHERE id=%s", (job_id,)).fetchone()
    return str(row["status"]) if row else None


def projects(*, connect: Connect | None = None) -> list[dict[str, Any]]:
    """Every project with the columns keying needs, ordered by id (the backfill's order)."""

    with _with(connect)() as conn:
        rows = conn.execute(
            """SELECT p.id, p.repo_id, p.relative_path, p.project_file_rel, p.path_settings, r.clone_path
               FROM ws_projects p JOIN ws_repositories r ON r.id = p.repo_id ORDER BY p.id"""
        ).fetchall()
    return [dict(row) for row in rows]


def pinned_commits(project_id: str, *, connect: Connect | None = None) -> set[str]:
    """Commits whose bundles retention always keeps besides branch heads (ADR §5).

    System Builder instances' baseline commits and released Release Studio
    commits. Simulation Studio's kept runs join here when C6 lands.
    """

    queries = (
        "SELECT baseline_commit AS c FROM system_instances WHERE project_id=%s",
        "SELECT commit_sha AS c FROM ws_release_records WHERE project_id=%s",
    )
    found: set[str] = set()
    with _with(connect)() as conn:
        for query in queries:
            exists = conn.execute(
                "SELECT to_regclass(%s) IS NOT NULL AS present", (query.split(" FROM ")[1].split()[0],)
            ).fetchone()
            if exists and exists["present"]:
                found.update(str(row["c"]) for row in conn.execute(query, (project_id,)).fetchall() if row["c"])
    return found
