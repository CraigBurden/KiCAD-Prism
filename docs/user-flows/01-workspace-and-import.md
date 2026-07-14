# User flow: Workspace and import

Audience: designers and admins setting up projects in Prism.

## Prerequisites

- Prism is reachable in a browser.
- Your role is `designer` or `admin` for import/sync (viewers can browse only).
- For private Git repos: SSH key from Settings added to the Git host, or `GITHUB_TOKEN` configured by an admin.

## Sign in

1. Navigate to the Prism origin (example: `https://prism.example.com`).
2. Complete SSO if auth is enabled.
3. Confirm the workspace name and your avatar/role indicator load.

<!-- SCREENSHOT NEEDED: Post-login workspace shell. -->

## Orient in the workspace

| UI region | Behavior |
|-----------|----------|
| Folder sidebar | Role-filtered tree; selecting a folder sets `?folder=` |
| Search | Client-side fuzzy search across loaded projects |
| Gallery / list toggle | Alternate project presentations |
| Project card / row | Open project or inspect properties |
| Import Project | Starts the Git import dialog |
| Library Manager | Opens catalog (requires catalog role) |
| Settings | SSH key + access control (admin) |

Bootstrap data comes from a single call: `GET /api/workspace/bootstrap`.

<!-- SCREENSHOT NEEDED: Folder tree + gallery. Preferred assets/KiCAD-Prism-Workspace.png -->

## Create folder structure

1. Create folders for programs, customers, or product lines.
2. Move projects into folders after import.
3. Remember: folder visibility is RBAC-aware; not every role sees every folder.

## Import a repository

### Happy path

1. Click **Import Project**.
2. Paste the clone URL.
3. Prism starts an analyze job and polls status.
4. Review discovered KiCad projects / boards.
5. Select what to import (important for monorepos).
6. Confirm. An import job clones (or reuses) the repo and registers projects.
7. On success, helper comment REST URLs may be shown for optional KiCad configuration.
8. Close the dialog; workspace refresh shows new cards.

<!-- SCREENSHOT NEEDED: Import analyze results / board picker. -->
<!-- SCREENSHOT NEEDED: Post-import helper URL panel. -->

### Monorepos

Prism supports repositories that contain multiple boards. During analyze, select only the paths you want as Prism projects. See [KICAD-PRJ-REPO-STRUCTURE.md](../KICAD-PRJ-REPO-STRUCTURE.md).

### Failures

| Symptom | Check |
|---------|-------|
| Analyze fails immediately | URL reachable from the backend container; DNS; SSH key / token |
| Import hangs | `docker compose logs backend`; disk space under `data/projects` |
| Projects missing after restart | `data/projects` volume mount |

## Sync an existing project

1. Open the project.
2. Click **Sync** (designer/admin).
3. Wait for fetch/pull to finish.
4. Refresh history if you were viewing commits.

Sync currently runs on the request path; large repos may take noticeable time.

## Configure output paths

If manufacturing outputs live outside default locations, add `.prism.json` path mapping. See [PATH-MAPPING.md](../PATH-MAPPING.md).

## Display names

Projects can show friendlier names than the raw folder name. See [CUSTOM_PROJECT_NAMES.md](../CUSTOM_PROJECT_NAMES.md).

## Next

- [Project review flow](02-project-review.md)
- [Deployment](../DEPLOYMENT.md)
