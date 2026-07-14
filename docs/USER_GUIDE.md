# User guide

This is the product overview for people who use KiCAD Prism day to day. Detailed click-paths live under [user-flows/](user-flows/).

## Who Prism is for

| Role | What you do in Prism |
|------|----------------------|
| Reviewer / viewer | Browse projects, open schematics/PCBs, compare commits, download outputs |
| Designer | Import/sync Git repos, run workflows, organize folders |
| Librarian | Govern components, QA, release, place from KiCad |
| Admin | SSO, roles, SSH keys, service clients |

## Sign in

1. Open the Prism URL for your deployment (prefer HTTPS; see [HTTPS and TLS](HTTPS_AND_TLS.md)).
2. If auth is enabled, choose the configured SSO provider.
3. After redirect, you land on the workspace.

Guest mode (`AUTH_ENABLED=false`) skips the login wall and should only be used on trusted local machines.

<!-- SCREENSHOT NEEDED: Login page with SSO button. assets/KiCAD-Prism-Login-Page.png -->

## Workspace

The home screen lists projects in gallery or list view, with a folder tree and search.

Common actions:

- Open a project
- Import Project (Git URL)
- Create / rename / move folders
- Open Settings (SSH public key, role assignments) as admin
- Open Library Manager (catalog roles)

Deep dive: [01-workspace-and-import.md](user-flows/01-workspace-and-import.md)

<!-- SCREENSHOT NEEDED: Workspace gallery with folders and search. assets/KiCAD-Prism-New-Workspace.png or assets/KiCAD-Prism-Workspace.png -->

## Import and sync a KiCad repository

1. Click **Import Project**.
2. Paste a Git URL (SSH or HTTPS).
3. Wait for analyze; select boards in a monorepo if prompted.
4. Confirm import; projects appear in the workspace.
5. Later, open a project and use **Sync** to pull remote updates (designer/admin).

Path mapping for manufacturing outputs uses `.prism.json`. See [PATH-MAPPING.md](PATH-MAPPING.md).

<!-- SCREENSHOT NEEDED: Import dialog mid-analyze or board selection. assets/KiCAD-Prism-Importing-Repo.png -->

## Review a project

Open `/project/<id>`. Sections:

| Section | Purpose |
|---------|---------|
| Overview | README / summary |
| History | Commits, tags/releases, visual diff |
| Visualizers | Schematic, PCB, 3D, BOM, Assembly (iBOM) |
| Workflows | Run KiCad jobsets, watch logs |
| Assets | Browse generated outputs |
| Documentation | Markdown tree in the repo |

Use the branch selector and commit pin (`?commit=`) to review historical revisions.

Cross-probe: selecting a reference in schematic, PCB, or BOM highlights the same object elsewhere when identity data is available.

Deep dive: [02-project-review.md](user-flows/02-project-review.md)

<!-- SCREENSHOT NEEDED: Project visualizer with selection inspector. -->
<!-- SCREENSHOT NEEDED: History visual diff. assets/Visual-Diff-GIF.gif may still be valid. -->

## Library Manager

Open **Library Manager** from the workspace sidebar (`/?section=library-manager`).

Typical lifecycle:

1. Import symbols/footprints from a folder or harvest from a project.
2. Edit metadata and attach assets in the component workspace.
3. Submit for QA.
4. Release from the release queue.
5. Place from KiCad Remote Symbols (released + place-ready only).

Deep dive: [03-library-manager.md](user-flows/03-library-manager.md)

<!-- SCREENSHOT NEEDED: Library catalog. assets/KiCAD-Prism-Library-Catalog.png -->
<!-- SCREENSHOT NEEDED: Release queue. assets/KiCAD-Prism-Library-Release-Queue.png -->

## Place parts from KiCad

1. Admin hosts Prism on HTTPS with correct forwarded headers.
2. Build/install the datasource ZIP or add the provider base URL in KiCad.
3. Open the Remote Symbols panel, sign in if prompted.
4. Search, open a part, Place.

Deep dive: [04-kicad-remote-symbols.md](user-flows/04-kicad-remote-symbols.md) and [REMOTE_SYMBOL_PROVIDER.md](REMOTE_SYMBOL_PROVIDER.md).

<!-- SCREENSHOT NEEDED: KiCad Remote Symbols panel. assets/KiCAD-Prism-Remote-Symbols-Panel.png -->

## Comments (current status)

- PostgreSQL-backed comments API exists.
- In-browser visualizer commenting UI is **not** shipped in the current release.
- After import, helper REST URLs can still be copied for experimental KiCad REST integration.
- `POST /comments/push` exports `.comments/comments.json` into the repo (Git commit remains manual).

Details: [COMMENTS.md](COMMENTS.md).

## Settings

Admins can:

- View/regenerate the Git SSH public key
- Assign user roles
- Create OAuth service clients for PLM link-out (API)

General settings UI may show placeholders for items still configured via `.env`.

## What Prism does not do yet

- Multi-tenant orgs / share links / per-project ACLs beyond folder visibility
- Live multi-user co-editing
- Built-in PLM connectors (Connectors tab is a stub)
- Full Altium-style design review assignment workflow in the browser

## Next reading

- [Documentation index](DOCUMENTATION.md)
- [Deployment](DEPLOYMENT.md)
- [HTTPS and TLS](HTTPS_AND_TLS.md)
