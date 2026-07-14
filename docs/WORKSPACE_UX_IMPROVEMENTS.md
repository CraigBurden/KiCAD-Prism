# Workspace behavior notes

This document summarizes current workspace behavior in KiCAD Prism. For end-user steps, see [USER_GUIDE.md](USER_GUIDE.md) and [user-flows/01-workspace-and-import.md](user-flows/01-workspace-and-import.md).

## Current workspace data flow

The workspace boots from a single internal endpoint:

```http
GET /api/workspace/bootstrap
```

Response shape:

```json
{
  "projects": [...],
  "folders": [...]
}
```

This replaces separate initial requests for project and folder trees on the main workspace load path.

Projects, folders, and roles are stored in PostgreSQL (`workspace` schema).

## Search behavior

Workspace search is client-side and optimized for responsiveness.

Current behavior:

- search input is deferred so typing does not block rendering
- project matching uses fuzzy search across key project fields
- results include display names and descriptions where available

This keeps the workspace responsive without changing project data or server-side semantics. Very large workspaces may eventually need server-side search; that is not shipped yet.

## Folder and visibility model

Workspace folders are role-aware.

Current behavior:

- folder trees are filtered by the current user role
- project visibility respects RBAC assignments
- folder counts and visibility are computed without forcing full project hydration where unnecessary

## Project and dialog loading

The non-visualizer application shell is route-split.

Current behavior:

- login, workspace, and project detail routes are lazy-loaded
- settings and import dialogs are deferred until opened
- auth and markdown runtimes are deferred out of the initial shell

## Import flow notes

Import and analysis use async jobs.

Current behavior:

- repository analysis and import return a job id
- frontend polls job status during the active flow
- polling is stopped cleanly when dialogs close or unmount
- imported projects can expose comments helper URLs immediately after import

## Why this matters

The workspace is the highest-frequency surface in the product. These behaviors aim to:

- keep initial load small
- reduce duplicate API work
- avoid unnecessary background polling
- preserve UI responsiveness on larger project sets

## Related endpoints

- `GET /api/workspace/bootstrap`
- `GET /api/folders/tree`
- `GET /api/folders/contents`
- `POST /api/projects/analyze`
- `POST /api/projects/import`
- `GET /api/projects/jobs/{job_id}`
