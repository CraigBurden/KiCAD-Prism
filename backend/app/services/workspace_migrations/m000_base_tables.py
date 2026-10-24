"""Workspace schema step 0: base_tables.

The repository, folder, project, portfolio and job tables every later step
builds on. Before the single ledger these ran on every start from
``WorkspaceService._create_schema``; a database deployed then already has them,
so on upgrade this runs once as a no-op and is recorded.

Frozen. Edit nothing here, add a new migration instead.
"""

from __future__ import annotations

from typing import Any


def migrate(conn: Any) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ws_repositories (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            url         TEXT NOT NULL UNIQUE,
            clone_path  TEXT NOT NULL UNIQUE,
            import_type TEXT NOT NULL DEFAULT 'single',
            cloned_at   TIMESTAMPTZ NOT NULL,
            last_synced_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS ws_folders (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            parent_id       TEXT REFERENCES ws_folders(id) ON DELETE CASCADE,
            visibility_mode TEXT,
            allowed_roles   JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at      TIMESTAMPTZ NOT NULL,
            updated_at      TIMESTAMPTZ NOT NULL,
            UNIQUE(parent_id, name)
        );
        CREATE INDEX IF NOT EXISTS idx_ws_folders_parent ON ws_folders(parent_id);

        CREATE TABLE IF NOT EXISTS ws_projects (
            id              TEXT PRIMARY KEY,
            repo_id         TEXT NOT NULL REFERENCES ws_repositories(id) ON DELETE CASCADE,
            name            TEXT NOT NULL,
            display_name    TEXT,
            description     TEXT NOT NULL DEFAULT '',
            relative_path   TEXT NOT NULL DEFAULT '.',
            project_file_rel TEXT NOT NULL DEFAULT '',
            folder_id       TEXT REFERENCES ws_folders(id) ON DELETE SET NULL,
            schematic_rel   TEXT,
            pcb_rel         TEXT,
            thumbnail_rel   TEXT,
            jobset_rel      TEXT,
            has_3d_model    BOOLEAN NOT NULL DEFAULT FALSE,
            has_ibom        BOOLEAN NOT NULL DEFAULT FALSE,
            registered_at   TIMESTAMPTZ NOT NULL,
            last_modified   TIMESTAMPTZ NOT NULL,
            prism_json_hash TEXT,
            -- A directory can hold more than one KiCad project, so it does
            -- not identify one on its own. Keying uniqueness on the
            -- directory alone made a repository with two projects in its
            -- root importable only as one of them.
            CONSTRAINT ws_projects_repo_path_file_key
                UNIQUE (repo_id, relative_path, project_file_rel)
        );
        CREATE INDEX IF NOT EXISTS idx_ws_projects_folder ON ws_projects(folder_id);
        CREATE INDEX IF NOT EXISTS idx_ws_projects_repo   ON ws_projects(repo_id);

        CREATE TABLE IF NOT EXISTS ws_project_portfolio (
            project_id  TEXT PRIMARY KEY REFERENCES ws_projects(id) ON DELETE CASCADE,
            model_rel   TEXT,
            tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
            scene_config JSONB
        );

        CREATE TABLE IF NOT EXISTS ws_jobs (
            id         TEXT PRIMARY KEY,
            kind       TEXT NOT NULL,
            status     TEXT NOT NULL,
            message    TEXT NOT NULL DEFAULT '',
            percent    REAL NOT NULL DEFAULT 0,
            payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ws_jobs_kind_status ON ws_jobs(kind, status);
    """, prepare=False)
