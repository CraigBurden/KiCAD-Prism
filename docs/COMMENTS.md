# Comments

This document describes the current comments architecture in KiCAD Prism.

## Current status (read this first)

| Layer | Status |
|-------|--------|
| PostgreSQL `comments` schema | Active source of truth |
| REST API under `/api/projects/{id}/comments` | Available |
| Export to `.comments/comments.json` | Available via `POST .../comments/push` |
| KiCad REST helper URL generation | Available |
| In-browser visualizer commenting UI | **Not shipped** in the current release |

React commenting controls and marker overlays were removed during the ecad-viewer host refactor. Overlay extension channels remain in the viewer host for a future comments pass. See [postgres-ecad-extension-refactor.md](postgres-ecad-extension-refactor.md).

Older screenshots in `assets/` that show commenting mode are historical and do not represent the current UI.

## Storage and export

- Live source of truth: PostgreSQL comments tables (per-project isolation).
- Export artifact: `.comments/comments.json` inside the project repository.
- `POST /comments/push` means **export DB state to JSON**. It does not perform a Git push.
- After export, stage/commit/push with normal Git workflows if you want the artifact versioned.

On first need, the store can bootstrap from an existing `.comments/comments.json` when present.

## API surface

Under `/api/projects/{project_id}`:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/comments` | List comments |
| POST | `/comments` | Create |
| PATCH | `/comments/{comment_id}` | Update |
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

## Frontend behavior today

- Import dialog can show comment-source helper URLs after a successful import (copy/paste into experimental KiCad REST configuration).
- There is no visualizer pin/thread UI and no in-app comment resolution board.
- `frontend/src/types/comments.ts` remains for API typing; do not assume a comments panel exists.

## Recommended usage

1. Use Git history + visual diff + selection inspector for browser review today.
2. Use helper URLs only if you run an experimental KiCad build that consumes Prism comment REST endpoints.
3. Export `.comments/comments.json` when you need a repository-carried artifact.
4. Plan future in-browser commenting on the ecad overlay channel rather than reintroducing the removed marker overlay as-is.

## Hosting notes

If KiCad or other tools on another machine must reach comment APIs:

- Serve Prism on a stable HTTPS origin ([HTTPS and TLS](HTTPS_AND_TLS.md)).
- Set `COMMENTS_API_BASE_URL` to that origin.
- Ensure designers/admins have the roles required by the comments endpoints.

## Related

- [User guide](USER_GUIDE.md)
- [Project review flow](user-flows/02-project-review.md)
- [Deployment](DEPLOYMENT.md)
