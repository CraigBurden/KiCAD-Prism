# KiCAD Prism

KiCAD Prism is a web platform for browsing, reviewing, and operating on KiCad Git repositories, and for governing a shared component library that places into KiCad through the Remote Symbols panel.

It is built for engineering teams that use KiCad as their ECAD tool and want collaboration, review, and library workflow without abandoning Git-centric source control.

<!-- SCREENSHOT NEEDED: Login / workspace hero. Preferred filename: assets/KiCAD-Prism-Login-Page.png (update or replace existing). -->
![KiCAD Prism login](assets/KiCAD-Prism-Login-Page.png)

## Why Prism

Standalone KiCad is excellent for design. Collaboration suites such as Altium 365 add shared review, library governance, and browser access. Prism sits between those worlds:

- Keep projects in Git (GitHub, GitLab, self-hosted).
- Review schematics, PCBs, BOM, and history in the browser.
- Govern symbols and footprints in a first-class Library Manager.
- Place released parts into KiCad through the Remote Symbol Provider.

Prism is currently strongest as a **Git-native KiCad workspace + library platform**. In-browser design commenting APIs remain available; the visualizer commenting UI is not shipped in the current release (see [Comments](docs/COMMENTS.md)).

## Core capabilities

### Workspace and repositories

- Import standalone KiCad repositories or monorepos with multiple boards.
- Sync remotes from the UI.
- Organize projects into RBAC-aware folders.
- Search projects by name, display name, description, and parent repo.

<p align="center">
  <img src="assets/KiCAD-Prism-New-Workspace.png" width="49%" alt="Workspace overview">
  <img src="assets/KiCAD-Prism-Importing-Repo.png" width="49%" alt="Importing a repository">
</p>

<!-- SCREENSHOT NEEDED: Updated workspace gallery with Library Manager entry visible. Preferred: assets/KiCAD-Prism-Workspace.png -->

### Project exploration and review

- Native schematic and PCB viewing in the browser with cross-probe.
- WebGPU 3D board viewing and Interactive HTML BOM integration.
- Engineering BOM from the semantic index.
- Markdown README and project documentation browsing.
- Design and manufacturing output browsing.
- Commit history, releases/tags, and visual SCH/PCB/BOM diffs.
- Branch and commit pinning via URL (`?branch=` / `?commit=`).

<p align="center">
  <img src="assets/KiCAD-Prism-Visualizer-SCH.png" width="49%" alt="Schematic viewer">
  <img src="assets/KiCAD-Prism-Visualizer-PCB.png" width="49%" alt="PCB viewer">
</p>

<p align="center">
  <img src="assets/KiCAD-Prism-Visualiser-3DView.png" width="49%" alt="3D viewer">
  <img src="assets/KiCAD-Prism-Visualizer-ibom.png" width="49%" alt="Interactive BOM">
</p>

<!-- SCREENSHOT NEEDED: Visual diff (SCH or PCB). Existing GIFs under assets/Visual-Diff-*.gif can be referenced once confirmed current. -->
<!-- SCREENSHOT NEEDED: Engineering BOM table with cross-probe / selection inspector open. -->

### Library Manager and KiCad placement

- Component catalog with revisions, QA workflow, and release queue.
- Folder and project import into the catalog.
- Optional KiCad Library Convention (KLC) validation.
- KiCad DBL export for database-library workflows.
- Remote Symbol Provider panel for searching and placing released parts from KiCad.

<!-- SCREENSHOT NEEDED: Library Manager catalog list. Preferred: assets/KiCAD-Prism-Library-Catalog.png -->
<!-- SCREENSHOT NEEDED: Component workspace / release queue. Preferred: assets/KiCAD-Prism-Library-Release-Queue.png -->
<!-- SCREENSHOT NEEDED: KiCad Remote Symbols panel placing a part. Preferred: assets/KiCAD-Prism-Remote-Symbols-Panel.png -->

### Workflow automation

- Trigger KiCad jobset workflows from the UI.
- Generate design, manufacturing, and render outputs.
- Browse generated artifacts from the project Assets portal.

![Workflow management](assets/KiCAD-Prism-Workflows.png)

### Access control

- OIDC single sign-on for the web UI.
- Roles: `viewer`, `designer`, `admin`, plus catalog roles `component_designer` and `component_qa`.
- Separate OAuth path for the KiCad Remote Symbols panel (`remote_symbols.read`).
- Optional machine clients for PLM/MRP link-out integrations.

## Architecture (current)

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite, Tailwind, shadcn/ui |
| Backend | FastAPI, GitPython, Pydantic Settings |
| Database | PostgreSQL 17 (`workspace`, `comments`, `catalog`, `operations` schemas) |
| Workers | Separate `catalog-worker` for import, validation, preview, retention jobs |
| Git data | Cloned repositories under `data/projects` |
| Catalog assets | Content-addressed + KiCad-style trees under `data/projects/.kicad-prism/` |
| Viewer | ecad-viewer (schematic/PCB) + WebGPU 3D path |

Runtime services (Docker Compose):

- `postgres`
- `backend` (API on port `8000`)
- `catalog-worker`
- `frontend` (Nginx on port `8080`, proxies API and remote-provider paths)

For production, place a TLS-terminating reverse proxy in front of the frontend. HTTPS is required for reliable KiCad Remote Symbols panel use outside localhost. See [HTTPS and TLS](docs/HTTPS_AND_TLS.md).

## Quick start (Docker, HTTP local)

```bash
git clone https://github.com/krishna-swaroop/KiCAD-Prism.git
cd KiCAD-Prism
cp .env.example .env
```

Guest mode (no login wall):

```env
AUTH_ENABLED=false
```

OIDC login (recommended for shared hosts):

```env
AUTH_ENABLED=true
DEV_MODE=false
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_CLIENT_ID=kicad-prism
OIDC_CLIENT_SECRET=
OIDC_SCOPES=openid email profile
OIDC_PROVIDER_NAME=Google
SESSION_SECRET=
BOOTSTRAP_ADMIN_USERS_STR=admin@example.com
SESSION_COOKIE_SECURE=false
```

Generate `SESSION_SECRET`:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Start:

```bash
docker compose up --build -d
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

**Production HTTPS:** do not stop at this HTTP quick start. Follow [Deployment](docs/DEPLOYMENT.md) and [HTTPS and TLS](docs/HTTPS_AND_TLS.md) before enabling the Remote Symbol Provider for desktop KiCad clients.

## Documentation

| Document | Purpose |
|----------|---------|
| [Documentation index](docs/DOCUMENTATION.md) | Full map of product and ops docs |
| [Deployment](docs/DEPLOYMENT.md) | Docker hosting, volumes, auth modes, ops |
| [HTTPS and TLS](docs/HTTPS_AND_TLS.md) | Production TLS, internal CA, KiCad trust |
| [User guide](docs/USER_GUIDE.md) | End-to-end product workflows |
| [Remote Symbol Provider](docs/REMOTE_SYMBOL_PROVIDER.md) | KiCad panel setup and placement |
| [OIDC / OAuth](docs/OIDC_OAUTH_INTEGRATION.md) | SSO and machine clients |
| [Comments](docs/COMMENTS.md) | Comments API, export, current UI status |
| [Path mapping](docs/PATH-MAPPING.md) | `.prism.json` output path configuration |
| [Import existing libraries](docs/IMPORT_EXISTING_KICAD_LIBRARIES.md) | Bulk library onboarding |
| [Repository structure](docs/KICAD-PRJ-REPO-STRUCTURE.md) | Expected KiCad repo layouts |

User-flow deep dives:

- [Workspace and import](docs/user-flows/01-workspace-and-import.md)
- [Project review](docs/user-flows/02-project-review.md)
- [Library Manager](docs/user-flows/03-library-manager.md)
- [KiCad Remote Symbols](docs/user-flows/04-kicad-remote-symbols.md)

## Local development

Backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Ensure PRISM_DATABASE_URL points at a reachable Postgres instance
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Dev UI: [http://127.0.0.1:5173](http://127.0.0.1:5173).

### Test a local kicad-monkey checkout in Docker

For temporary integration testing, place `KiCAD-Prism` and `kicad-monkey` next
to each other:

```text
KiCAD-Platform/
├── KiCAD-Prism/
└── kicad-monkey/
```

Build and start Prism with the current local `kicad-monkey` working tree,
including uncommitted changes:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.local-kicad-monkey.yml \
  up -d --build
docker compose restart frontend
```

Verify which package was installed:

```bash
docker compose exec backend /app/venv/bin/python -c \
  'import inspect, kicad_monkey; print(kicad_monkey.__version__); print(inspect.getfile(kicad_monkey))'
docker compose exec backend /bin/sh -c 'echo "$PRISM_KICAD_MONKEY_SOURCE"'
```

To return to the pinned upstream release, omit the override and rebuild:

```bash
docker compose up -d --build
docker compose restart frontend
```

Restarting the frontend refreshes Nginx's Docker DNS entry after the backend
container is replaced.

The local override does not modify `requirements-runtime.txt`, vendor a wheel,
or require a fork. Normal Docker deployments therefore continue to use the
released versions pinned by Prism. The opt-in image also installs the released
`kicad-cruncher` version matching the local `kicad-monkey` package version so
their exact-version dependency remains consistent.

Prism compiles board topology indexes, semantic PCB IR, and pad-hole data as
one cached board product. There is no separate projection/full mode and no
metadata environment switch: every consumer reuses the same parsed PCB and IR
payload.

## Current limitations (honest)

- In-browser visualizer commenting UI is not shipped; PostgreSQL comments API and KiCad REST helper URLs remain.
- Single-workspace deployment model (not multi-tenant SaaS).
- Library Manager Connectors / PLM sync is not implemented yet.
- Real-time multi-user co-editing is not supported; collaboration is Git + review + library workflow.

## Acknowledgements

- [ecad-viewer](https://github.com/Huaqiu-Electronics/ecad-viewer)
- [KiCanvas](https://kicanvas.org)
- [Interactive HTML BOM](https://github.com/quindorian/Sublime-iBOM-Plugin)
- [Three.js](https://threejs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)

## License

See [LICENSE](LICENSE).
