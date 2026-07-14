# Documentation index

This is the map of KiCAD Prism product and operations documentation.

## Start here

| Audience | Read first |
|----------|------------|
| New user | [User guide](USER_GUIDE.md) |
| Admin / DevOps | [Deployment](DEPLOYMENT.md) then [HTTPS and TLS](HTTPS_AND_TLS.md) |
| KiCad librarian | [Library Manager flow](user-flows/03-library-manager.md) |
| KiCad desktop users | [Remote Symbol Provider](REMOTE_SYMBOL_PROVIDER.md) |

## Product docs

| Document | Description |
|----------|-------------|
| [USER_GUIDE.md](USER_GUIDE.md) | End-to-end product overview and links to detailed flows |
| [user-flows/01-workspace-and-import.md](user-flows/01-workspace-and-import.md) | Sign-in, workspace, folders, Git import/sync |
| [user-flows/02-project-review.md](user-flows/02-project-review.md) | Visualizers, history, diff, workflows, assets |
| [user-flows/03-library-manager.md](user-flows/03-library-manager.md) | Catalog, import center, QA, release |
| [user-flows/04-kicad-remote-symbols.md](user-flows/04-kicad-remote-symbols.md) | Place released parts from KiCad |
| [REMOTE_SYMBOL_PROVIDER.md](REMOTE_SYMBOL_PROVIDER.md) | Provider metadata, OAuth, datasource ZIP, limits |
| [COMMENTS.md](COMMENTS.md) | Comments API, export, current UI status |
| [PATH-MAPPING.md](PATH-MAPPING.md) | `.prism.json` for output paths |
| [CUSTOM_PROJECT_NAMES.md](CUSTOM_PROJECT_NAMES.md) | Display names and project metadata |
| [KICAD-PRJ-REPO-STRUCTURE.md](KICAD-PRJ-REPO-STRUCTURE.md) | Expected repository layouts |
| [IMPORT_EXISTING_KICAD_LIBRARIES.md](IMPORT_EXISTING_KICAD_LIBRARIES.md) | Bulk onboarding of existing libraries |

## Operations and security

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker Compose, volumes, auth modes, backups, troubleshooting |
| [HTTPS_AND_TLS.md](HTTPS_AND_TLS.md) | HTTPS reverse proxy, public CA, internal CA, KiCad trust |
| [OIDC_OAUTH_INTEGRATION.md](OIDC_OAUTH_INTEGRATION.md) | Human SSO and machine OAuth clients |

## Engineering / internal notes

These are useful for contributors; they are not end-user guides.

| Document | Description |
|----------|-------------|
| [postgres-ecad-extension-refactor.md](postgres-ecad-extension-refactor.md) | Current persistence + ecad overlay channel notes |
| [catalog-postgres-migration.md](catalog-postgres-migration.md) | Historical catalog migration notes |
| [library-manager-first-class-plan.md](library-manager-first-class-plan.md) | Library Manager product plan |
| [ECAD_VIEWER_SYNC_NOTES.md](ECAD_VIEWER_SYNC_NOTES.md) | Vendor viewer sync notes |
| [WORKSPACE_UX_IMPROVEMENTS.md](WORKSPACE_UX_IMPROVEMENTS.md) | Workspace bootstrap/search behavior |

## Deploy examples in the repository

| Path | Description |
|------|-------------|
| `../deploy/Caddyfile` | Public HTTPS with automatic certificates (Let's Encrypt) |
| `../deploy/Caddyfile.internal` | Internal HTTPS with custom/internal CA certificates |
| `../deploy/nginx-tls.conf.example` | External Nginx TLS terminator example |
| `../docker-compose.proxy.yml` | Optional Caddy sidecar Compose overlay |

## Screenshot inventory

Marketing and user-guide pages reference screenshots under `../assets/`.

Where a screenshot is missing or stale, docs use an HTML comment:

```html
<!-- SCREENSHOT NEEDED: description. Preferred filename: assets/... -->
```

See [SCREENSHOTS.md](SCREENSHOTS.md) for the full request list.
