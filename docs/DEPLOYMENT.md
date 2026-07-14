# Deployment Guide

This guide covers hosting KiCAD Prism with Docker Compose, configuring authentication, persisting data, and operating the stack.

For HTTPS, internal CA trust, and KiCad Remote Symbols TLS requirements, read **[HTTPS and TLS](HTTPS_AND_TLS.md)** before exposing Prism beyond localhost.

## Runtime overview

Compose services:

| Service | Role |
|---------|------|
| `postgres` | PostgreSQL 17 for `workspace`, `comments`, `catalog`, and `operations` schemas |
| `backend` | FastAPI API on port `8000` |
| `catalog-worker` | Background catalog import, validation, preview, retention jobs |
| `frontend` | Production Vite bundle served by Nginx on port `8080` |

Optional overlay:

| File | Role |
|------|------|
| `docker-compose.proxy.yml` | Caddy TLS terminator on ports `80`/`443` |

In Docker, the frontend proxies these paths to the backend over the Compose network:

- `/api/*`
- `/oauth/*`
- `/.well-known/kicad-remote-provider`
- `/remote-provider/*`

Default local endpoints (HTTP):

- UI: [http://127.0.0.1:8080](http://127.0.0.1:8080)
- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)

## Prerequisites

- Docker Engine or Docker Desktop with Compose
- Disk for Git clones, catalog assets, and workflow outputs
- For HTTPS: a DNS name and either a public ACME path or an internal PKI (see [HTTPS and TLS](HTTPS_AND_TLS.md))

## Docker hosting (HTTP local / lab)

### 1. Clone

```bash
git clone https://github.com/krishna-swaroop/KiCAD-Prism.git
cd KiCAD-Prism
```

### 2. Create root `.env`

```bash
cp .env.example .env
```

Generate a session secret:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

#### Guest mode (no SSO)

```env
WORKSPACE_NAME=KiCAD Prism
AUTH_ENABLED=false
DEV_MODE=false
SESSION_COOKIE_SECURE=false
```

Guest mode grants full access to every visitor. Use only on trusted local machines.

#### OIDC mode (shared host)

```env
WORKSPACE_NAME=KiCAD Prism
AUTH_ENABLED=true
DEV_MODE=false
OIDC_ISSUER_URL=https://sso.example.com/realms/engineering
OIDC_CLIENT_ID=kicad-prism
OIDC_CLIENT_SECRET=
OIDC_SCOPES=openid email profile
OIDC_PROVIDER_NAME=SSO
SESSION_SECRET=
SESSION_TTL_HOURS=12
SESSION_COOKIE_SECURE=false
CORS_ORIGINS_STR=http://127.0.0.1:8080
BOOTSTRAP_ADMIN_USERS_STR=admin@example.com
DEFAULT_VIEWER_DOMAINS_STR=
POSTGRES_PASSWORD=<strong-local-password>
```

Important:

- `SESSION_SECRET` is required whenever auth is effectively enabled (`AUTH_ENABLED=true`, OIDC configured, `DEV_MODE=false`).
- `SESSION_COOKIE_SECURE=true` only when the site is served over HTTPS.
- `PRISM_DATABASE_URL` can stay empty for the bundled Compose Postgres service.
- `DEV_MODE` must stay `false` in Docker hosting.
- Change the default Postgres password before any non-local deployment.

Google Sign-In example issuer: `OIDC_ISSUER_URL=https://accounts.google.com`. For local Docker, register redirect URI exactly `http://127.0.0.1:8080/auth/callback` (Google treats `localhost` and `127.0.0.1` as different).

### 3. Start

```bash
docker compose up --build -d
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

### 4. Stop

```bash
docker compose down
```

Data in `./data/projects`, `./data/ssh`, and the `prism-postgres-data` volume is retained.

## Production HTTPS hosting

Do not expose the Remote Symbol Provider on plain HTTP outside loopback.

Recommended path:

1. Configure OIDC + `SESSION_COOKIE_SECURE=true` + HTTPS `CORS_ORIGINS_STR`.
2. Put Caddy or Nginx in front of the frontend container.
3. Preserve `Host` and set `X-Forwarded-Proto: https`.
4. Trust internal CAs on every KiCad workstation if using private PKI.
5. Verify `/.well-known/kicad-remote-provider` advertises `https://` absolute URLs.

Full walkthrough, internal CA trust steps, and failure modes: **[HTTPS and TLS](HTTPS_AND_TLS.md)**.

Quick start with the bundled Caddy overlay (public ACME):

```bash
# Edit deploy/Caddyfile domain first
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up --build -d
```

## Volumes and persistence

Compose mounts:

| Host / volume | Container path | Contents |
|---------------|----------------|----------|
| `./data/projects` | `/app/projects` | Git clones, `.kicad-prism` assets/artifacts |
| `./data/ssh` | `/root/.ssh` | SSH keys, `known_hosts` |
| `prism-postgres-data` | Postgres data dir | Workspace, comments, catalog, jobs |

Persisted application data includes:

- PostgreSQL state for projects/folders/roles, comments, catalog, jobs, provider OAuth
- Imported repositories under `data/projects/`
- Canonical component libraries under `data/projects/.kicad-prism/components/`
- Content-addressed artifacts under `data/projects/.kicad-prism/artifacts/`
- DBL exports under `data/projects/.kicad-prism/exports/kicad-dbl/`
- KLC validation reports under `data/projects/.kicad-prism/validation/klc/`
- SSH material under `data/ssh/`

Keep PostgreSQL and the `.kicad-prism` asset tree backed up together. Database rows that reference missing files are not restorable as placeable components.

Do not place the project data directory on NFS/SMB if you can avoid it. Prefer local SSD/NVMe for the workstation/VPN deployment profile.

## Authentication modes

### Guest

```env
AUTH_ENABLED=false
```

No login wall. Everyone is effectively an admin. Local lab only.

### OIDC + session cookie

```env
AUTH_ENABLED=true
DEV_MODE=false
SESSION_SECRET=...
OIDC_*=...
```

Flow:

1. Frontend loads `/api/auth/config`.
2. User signs in at the IdP.
3. Browser hits `/auth/callback` with an auth code.
4. Backend exchanges the code, verifies `id_token`, issues an HttpOnly session cookie.
5. Roles come from PostgreSQL `workspace.user_roles`, bootstrap admins, and optional default viewer domains.

### Local development bypass

```env
DEV_MODE=true
```

Auth is effectively disabled even if `AUTH_ENABLED=true`. Convenient for Vite + Uvicorn development. Never use on shared hosts.

RBAC roles:

| Role | Typical access |
|------|----------------|
| `viewer` | Read projects and released library content |
| `designer` | Import/sync projects, workflows, folder mutations |
| `admin` | Settings, role assignment, service clients |
| `component_designer` | Library Manager authoring |
| `component_qa` | Library QA / release queue |

Details: [OIDC and OAuth](OIDC_OAUTH_INTEGRATION.md).

## Reverse proxy path map

When the outer proxy targets the frontend container, no extra path map is required.

When routing directly:

| Path | Target |
|------|--------|
| `/` | frontend |
| `/api/*` | backend |
| `/oauth/*` | backend |
| `/.well-known/kicad-remote-provider` | backend |
| `/remote-provider/*` | backend |

Plain internal HTTP example (Remote Symbols not recommended on HTTP):

```env
CORS_ORIGINS_STR=http://kicad-prism.example.internal
SESSION_COOKIE_SECURE=false
```

HTTPS example:

```env
CORS_ORIGINS_STR=https://kicad-prism.example.internal
SESSION_COOKIE_SECURE=true
```

## Private Git access

### SSH (recommended)

- Keys persist under `./data/ssh`
- Copy the public key into GitHub/GitLab/deploy keys
- Optional startup host-key scan:

```env
GIT_SCAN_KNOWN_HOSTS_ON_STARTUP=true
```

### GitHub HTTPS token

```env
GITHUB_TOKEN=ghp_...
```

Backend rewrites GitHub HTTPS remotes to use the token at startup.

## Component library / catalog worker

Catalog mutations that need KiCad tooling run in `catalog-worker`, not inside an in-process API thread.

Useful settings:

```env
CATALOG_WORKER_CONCURRENCY=2
CATALOG_WORKER_POLL_SECONDS=1
CATALOG_JOB_LEASE_SECONDS=120
CATALOG_ARTIFACT_ROOT=/app/projects/.kicad-prism/artifacts
CATALOG_RETENTION_ENABLED=true
CATALOG_IMPORT_ROOTS=engineering=/imports/engineering
CATALOG_KLC_ENABLED=true
CATALOG_KLC_RELEASE_GATE=warn
```

If `CATALOG_IMPORT_ROOTS` is set, mount each path read-only on **both** `backend` and `catalog-worker`.

Only components in a released / place-ready state with symbol and footprint assets appear in the KiCad Remote Symbols panel.

DBL export:

```bash
curl -X POST https://prism.example.com/api/catalog/exports/kicad-dbl
```

Library onboarding: [IMPORT_EXISTING_KICAD_LIBRARIES.md](IMPORT_EXISTING_KICAD_LIBRARIES.md).

## Remote Symbols panel bundle

Panel source: `frontend/src/panel`.

Docker backend image builds the panel with `npm run build:panel` and embeds it under `/remote-provider/panel`.

Local panel rebuild without Docker:

```bash
cd frontend
npm run build:panel
mkdir -p ../backend/app/static/remote_provider
cp -R dist/remote_provider/. ../backend/app/static/remote_provider/
```

Datasource ZIP for KiCad PCM:

```bash
python3 scripts/build_datasource_package.py --base-url https://prism.example.com
```

Always use the public origin users and KiCad will call.

## Production tuning

```env
UVICORN_WORKERS=4
```

On constrained lab machines, `UVICORN_WORKERS=1` is fine.

Backend Compose already enables `--proxy-headers` so forwarded `Host` / proto are honored.

## Backups

Minimum backup set:

1. PostgreSQL dump or volume snapshot of `prism-postgres-data`
2. Entire `data/projects/.kicad-prism/` tree
3. `data/ssh/` if you rely on mounted deploy keys
4. Root `.env` from a secret manager (not from Git)

Restore requires database + asset tree consistency.

## Local development hosting

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export PRISM_DATABASE_URL=postgresql://kicad_prism:kicad-prism-local@127.0.0.1:5432/kicad_prism
uvicorn app.main:app --reload --port 8000
```

You can start only Postgres via Compose while running the API on the host.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dev UI: [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Operations

### Rebuild after env or image changes

```bash
docker compose up --build -d
```

### Logs

```bash
docker compose logs --tail=100 frontend
docker compose logs --tail=100 backend
docker compose logs --tail=100 catalog-worker
docker compose logs --tail=100 postgres
```

### Session notes

- Changing `SESSION_SECRET` invalidates all web sessions and re-keys provider token signing that depends on it.
- Secure cookies require HTTPS end-to-end from the browser's point of view.

## Troubleshooting

### Blank page / frontend JS error

Open DevTools, capture the first console error, confirm `/assets/index-*.js` and `/api/auth/config` load.

### `SESSION_SECRET is not configured`

Set `SESSION_SECRET` in root `.env` and recreate containers.

### SSO sign-in not appearing

Check `AUTH_ENABLED=true`, OIDC fields populated, `DEV_MODE=false`, and IdP redirect URI allowlist.

### `/api/auth/config` returns `502`

Backend is down or still starting. Inspect backend logs; confirm Postgres is healthy.

### Login works, API calls fail

- `SESSION_COOKIE_SECURE` vs actual transport
- `CORS_ORIGINS_STR` exact origin match
- proxy stripping cookies or `Authorization`

### Remote Symbols metadata wrong scheme/host

See [HTTPS and TLS](HTTPS_AND_TLS.md) failure modes. Almost always forwarded headers.

### Imported repositories missing after restart

Confirm `./data/projects` is mounted and writable.

## Related docs

- [HTTPS and TLS](HTTPS_AND_TLS.md)
- [Remote Symbol Provider](REMOTE_SYMBOL_PROVIDER.md)
- [OIDC and OAuth](OIDC_OAUTH_INTEGRATION.md)
- [User guide](USER_GUIDE.md)
- [Documentation index](DOCUMENTATION.md)
