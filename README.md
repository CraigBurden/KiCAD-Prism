# KiCAD Prism

KiCAD Prism is an open-source, self-hosted collaboration and component-governance
platform for teams that use KiCad and Git.

KiCad remains the desktop editor. Git remains the source of truth for design
files and revisions. Prism adds browser review, visual comparison, generated
assets, comments, and a governed component library without requiring a
proprietary ECAD cloud.

![KiCAD Prism workspace](assets/KiCAD-Prism-New-Workspace.png)

## Capabilities

- Import KiCad projects from SSH or HTTPS Git remotes, including monorepos.
- Browse schematics, PCBs, 3D boards, BOMs, stackups, assembly views, history,
  and generated documentation.
- Cross-probe compatible schematic, PCB, and BOM identities.
- Compare commits with semantic schematic, PCB, BOM, and related change views.
- Create and resolve project or comparison discussions.
- Run supported KiCad jobset flows and browse outputs in the Assets portal.
- Govern component revisions through authoring, QA, approval, and release.
- Validate symbols and footprints with optional KLC release gates.
- Place released components from desktop KiCad through the Remote Symbol
  Provider.
- Self-host with PostgreSQL, OIDC SSO, roles, scoped service clients, and
  separate workers.

## Runtime

The Docker Compose application contains:

| Service | Purpose |
| --- | --- |
| `frontend` | React application and Nginx reverse proxy |
| `backend` | FastAPI, authentication, authorization, and APIs |
| `prism-worker` | project, comparison, visualization, and jobset work |
| `catalog-worker` | catalog import, validation, preview, and release work |
| `postgres` | workspace, comments, catalog, jobs, audit, and session data |

Imported Git repositories and generated assets live under `data/projects`.
Prism's Git SSH identity lives under `data/ssh`. All three persistence domains,
including PostgreSQL, are required for complete recovery.

See [Architecture](docs/ARCHITECTURE.md).

## Quick local evaluation

```bash
git clone https://github.com/krishna-swaroop/KiCAD-Prism.git
cd KiCAD-Prism
cp .env.example .env
```

For a private single-user evaluation:

```env
AUTH_ENABLED=false
DEV_GUEST_ROLE=admin
UVICORN_WORKERS=1
```

The documented source-build path targets a Linux AMD64 Docker host and uses the
public KiCad runtime image selected in `.env`.

```bash
docker compose up --build -d
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

Follow [Getting started](docs/GETTING_STARTED.md) for setup and verification.
For any shared installation, use OIDC and HTTPS and follow
[Deployment](docs/DEPLOYMENT.md).

## Documentation

- [Documentation index](docs/README.md)
- [Platform overview](docs/OVERVIEW.md)
- [Getting started](docs/GETTING_STARTED.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Configuration](docs/CONFIGURATION.md)
- [Authentication and access](docs/AUTHENTICATION_AND_ACCESS.md)
- [Project workflows](docs/PROJECT_WORKFLOWS.md)
- [Library Manager](docs/LIBRARY_MANAGER.md)
- [Remote Symbol Provider](docs/REMOTE_SYMBOL_PROVIDER.md)
- [Team adoption](docs/TEAM_ADOPTION.md)
- [Operations](docs/OPERATIONS.md)

## Project status

The `dev` branch is heading toward a V3.0.0 alpha. Expect alpha-level changes,
and pin deployments to a reviewed tag or commit.

Current boundaries include:

- one role per user rather than composable workspace and catalog permissions;
- project-scoped standard comments;
- no mention notifications or Git forge webhook/status integration;
- fixed workflow types rather than first-class arbitrary workflows;
- no real-time multi-user ECAD editing;
- no complete in-product approved/changes-requested project state.

See [Platform overview](docs/OVERVIEW.md) before planning a team rollout.

## Contributing and issues

- [Contributing guidelines](CONTRIBUTING.md)
- [Reporting issues](docs/REPORTING_ISSUES.md)
- [Security policy](SECURITY.md)

Changes target the protected `dev` branch through pull requests. The required
quality gate validates frontend, backend, semantic viewer, and Compose
configuration.

## Acknowledgements

Prism builds on work from the KiCad ecosystem, including:

- [ecad-viewer](https://github.com/Huaqiu-Electronics/ecad-viewer)
- [KiCanvas](https://github.com/theacodes/kicanvas)
- [kicad-monkey](https://github.com/wavenumber-eng/kicad_monkey)
- [Interactive HTML BOM](https://github.com/openscopeproject/InteractiveHtmlBom)

## License

KiCAD Prism is licensed under the
[Apache License 2.0](LICENSE).
