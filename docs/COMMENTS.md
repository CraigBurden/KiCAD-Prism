# Comments

This document describes the comments architecture in KiCAD Prism.

## Current status

| Layer | Status |
|-------|--------|
| PostgreSQL `comments` schema | Active source of truth |
| REST API under `/api/projects/{id}/comments` | Available |
| Export to `.comments/comments.json` | Available via `POST .../comments/push` |
| KiCad REST helper URL generation | Available |
| In-browser visualizer commenting UI | **Shipped** via ecad-viewer overlay scenes |

Markers are painted by the ecad-viewer host as translucent yellow text-box glyphs on an overlay channel. They are **not** written into `.kicad_sch` / `.kicad_pcb`, and creating or updating comments does **not** reparse or replace design sources.

## Visualizer UX

On Schematic and PCB tabs (designer/admin):

1. Select a net, wire, or component, then press **C** to open the Add Comment dialog. **Cmd/Ctrl+Enter** submits.
2. With nothing selected, press **C** (or use **Commenting Mode**) and drag a rectangle; the marker is placed at the rectangle center and the bounds are stored.
3. Choose a **class** (`general`, `observation`, `question`, `task`; default `general`) and **severity** (`info`, `minor`, `major`, `critical`; default `info`).
4. Type `@` to mention a workspace user (email list from access roles). Mentions are stored with the comment.
5. Click a yellow note marker to open a compact comment card (resolve / reply / delete).
6. Use the **Comments** panel to browse, filter, and navigate to threads.

Overlay primitives use channel id `comments` with `setOverlayScene` / `clearOverlayScene`. Area comments also draw a dashed bbox around the region of interest.

Forge Issues sync fields (`forgeProvider`, `forgeIssueId`, …) exist in the schema for a future GitHub/GitLab bridge and are unused today.

## Storage and export

- Live source of truth: PostgreSQL comments tables (per-project isolation).
- Optional columns: `area_*` bounds for rectangle comments; `element_id` / `element_ref` / `element_type` for selection anchors.
- Export artifact: `.comments/comments.json` inside the project repository.
- `POST /comments/push` means **export DB state to JSON**. It does not perform a Git push.
- After export, stage/commit/push with normal Git workflows if you want the artifact versioned.

On first need, the store can bootstrap from an existing `.comments/comments.json` when present.

## API surface

Under `/api/projects/{project_id}`:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/comments` | List comments |
| POST | `/comments` | Create (supports `location.bounds`, optional element fields) |
| PATCH | `/comments/{comment_id}` | Update status |
| POST | `/comments/{comment_id}/replies` | Reply |
| DELETE | `/comments/{comment_id}` | Delete |
| POST | `/comments/push` | Export JSON artifact |
| GET | `/comments/source-urls` | Helper URLs for external tools |

### Helper URLs

`GET /api/projects/{project_id}/comments/source-urls` returns:

- `list_url`
- `patch_url_template`
- `reply_url_template`
- `delete_url_template`

Base URL resolution order:

1. Explicit `base_url` query parameter
2. `COMMENTS_API_BASE_URL` environment variable
3. Request origin (honors forwarded `Host` / proto when proxy headers are correct)

For HTTPS deployments, prefer setting:

```env
COMMENTS_API_BASE_URL=https://prism.example.com
```

so helpers do not accidentally advertise an internal hostname.

## Related

- [PostgreSQL / ecad extension refactor](postgres-ecad-extension-refactor.md)
- [User guide](USER_GUIDE.md)
- [Project review flow](user-flows/02-project-review.md)
- [Deployment](DEPLOYMENT.md)
