# Deployment

This guide describes a shared, self-hosted KiCAD Prism installation built from
the repository. V3 alpha does not yet provide a fully separated prebuilt-image
deployment contract, so pin the Git revision and KiCad base image used by each
installation.

## Deployment checklist

Before exposing Prism to a team, prepare:

- a Linux host or workstation with Docker Compose;
- a native KiCad runtime image for the host architecture;
- durable local storage for PostgreSQL, project data, and SSH state;
- a DNS name and TLS certificate;
- an OIDC client;
- a tested backup destination;
- capacity appropriate for concurrent KiCad generation jobs.

Prefer local SSD or NVMe. Imported repositories and generated assets can be much
larger than the source projects.

## 1. Pin the release source

Clone the repository and check out the selected release tag or reviewed commit:

```bash
git clone https://github.com/krishna-swaroop/KiCAD-Prism.git
cd KiCAD-Prism
git checkout <release-tag-or-commit>
cp .env.example .env
```

Do not deploy a moving branch without recording its commit SHA.

## 2. Configure architecture

Set `KICAD_BASE_IMAGE`, `KICAD_BASE_PLATFORM`, and `DOCKER_PLATFORM` to one
native architecture. The local Apple Silicon flow intentionally uses the
locally built `kicad/kicad:10.0.4-arm64-local` image. AMD64 servers need an
AMD64 KiCad image.

Never rely on transparent CPU emulation for the backend or workers.

## 3. Configure PostgreSQL and storage

Replace the example database password:

```env
POSTGRES_DB=kicad_prism
POSTGRES_USER=kicad_prism
POSTGRES_PASSWORD=<random-database-password>
```

Compose derives the private `PRISM_DATABASE_URL`. If you use an external
PostgreSQL server, set `PRISM_DATABASE_URL` explicitly and ensure it is reachable
from the backend and both workers.

The default persistent locations are:

| Host location | Contents |
| --- | --- |
| Docker volume `prism-postgres-data` | all PostgreSQL schemas |
| `./data/projects` | Git checkouts, catalog assets, generated artifacts, caches, exports |
| `./data/ssh` | Prism Git private key, public key, and known hosts |

Do not place these paths on ephemeral container storage.

## 4. Configure OIDC

At minimum:

```env
AUTH_ENABLED=true
WORKSPACE_NAME=Engineering ECAD
OIDC_ISSUER_URL=https://sso.example.com/realms/engineering
OIDC_CLIENT_ID=kicad-prism
OIDC_CLIENT_SECRET=<oidc-client-secret>
OIDC_PROVIDER_NAME=Company SSO
SESSION_SECRET=<random-value-of-at-least-32-characters>
BOOTSTRAP_ADMIN_USERS_STR=admin@example.com
PUBLIC_BASE_URL=https://prism.example.com
CORS_ORIGINS_STR=https://prism.example.com
```

Generate a session secret:

```bash
openssl rand -base64 48
```

Register both redirect URIs with the identity provider:

```text
https://prism.example.com/auth/callback
https://prism.example.com/oauth/oidc/callback
```

See [Authentication and access](AUTHENTICATION_AND_ACCESS.md) before starting the
shared service.

## 5. Configure HTTPS

The normal public route is:

```text
client -> TLS reverse proxy -> frontend:80 -> backend:8000
```

Do not expose backend port `8000` to the public network. The Compose file
publishes it for development; restrict it with the host firewall or a
production-specific Compose override.

Prism includes example Caddy and Nginx configurations in `deploy/`. For the
bundled Caddy service:

1. replace `prism.example.com` in `deploy/Caddyfile`;
2. point DNS to the host;
3. allow inbound ports 80 and 443;
4. start the stack:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.proxy.yml \
  up --build -d
```

For an internal CA, use `deploy/Caddyfile.internal`, mount the certificate
files, and distribute the root CA to every workstation that runs KiCad.

The proxy must preserve the public `Host` and set `X-Forwarded-Proto: https`.
Setting `PUBLIC_BASE_URL` remains the safest way to make advertised provider and
OAuth URLs deterministic.

## 6. Start and verify

```bash
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 backend prism-worker catalog-worker
```

Verify from a client:

```bash
curl -fsS https://prism.example.com/api/auth/config
curl -fsS https://prism.example.com/.well-known/kicad-remote-provider
curl -fsS https://prism.example.com/oauth/.well-known/oauth-authorization-server
```

Every absolute URL in Remote Symbol Provider metadata must use the public HTTPS
origin.

Sign in with the bootstrap administrator, assign explicit user roles, import a
small test repository, run one workflow, and place one released component before
onboarding the wider team.

## Private Git hosting

For SSH:

1. sign in as an administrator;
2. open Settings and obtain Prism's SSH public key;
3. add it as a read-only deploy key or machine-user key on the Git host;
4. pin the host key through Prism's Git access settings;
5. test repository access before import.

Automatic `ssh-keyscan` is disabled by default. Do not trust an unverified host
key merely to make import succeed.

For private GitHub HTTPS cloning, `GITHUB_TOKEN` is supported. Prefer a narrowly
scoped token and keep it only in the deployment secret store.

## Network and worker sizing

Keep PostgreSQL, backend, and workers on a private Docker network. Tune:

- Uvicorn worker count and PostgreSQL pool size together;
- Prism worker concurrency for host CPU and memory;
- KiCad-heavy concurrency conservatively;
- comparison and WebGPU slots based on the largest expected design.

Start with low concurrency, observe real projects, then increase it. Worker CPU
and memory limits in `.env.example` are ceilings, not capacity guarantees.

## Production readiness

Do not call an installation production-ready until:

- authentication fails closed when credentials are removed;
- direct backend access is blocked;
- HTTPS is trusted by browsers and KiCad workstations;
- backups contain PostgreSQL, project data, and SSH state;
- a restore has been tested on a separate host;
- update and rollback commits are recorded;
- worker failure and disk-full behavior are understood;
- at least one administrator besides the deployer can access the workspace.

Continue with [Operations](OPERATIONS.md).
