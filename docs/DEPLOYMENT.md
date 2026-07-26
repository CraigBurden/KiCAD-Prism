# Deployment

This guide covers the supported shared deployment path for KiCAD Prism:
the digest-pinned deployment bundle attached to a stable GitHub Release.

Feature development and source testing happen on `dev`. Stable code is promoted
to `main`, tagged, built, smoke-tested, and published by the release workflow.
Operators should not deploy a moving branch.

## Supported deployment contract

The public release target is a Linux AMD64 Docker host. A successful release
contains:

```text
kicad-prism-vX.Y.Z-linux-amd64.tar.gz
├── compose.yml
├── .env.example
├── Caddyfile
├── Caddyfile.internal
├── README.md
├── VERSION
└── SHA256SUMS
```

The generated `.env.example` pins the Prism backend and frontend images by
registry digest. The backend image is reused by the API, general worker, and
catalog worker. The Compose file has no source checkout or `build:` directive.

Docker Desktop can emulate AMD64 containers on other host architectures, but
native ARM64 release images are not currently published. Emulated deployments
are not the supported production target.

## Prerequisites

Prepare:

- a Linux AMD64 host with Docker Engine and Docker Compose v2;
- local SSD or NVMe storage sized for repositories and generated artifacts;
- a DNS name and TLS termination for a shared deployment;
- an OIDC client;
- a durable backup destination;
- enough CPU and memory for the selected worker concurrency.

Allow outbound HTTPS to the configured Git hosts, OIDC provider, GitHub
Container Registry, Docker Hub, and any other registries selected in `.env`.

## 1. Obtain and verify a stable release

Open the
[latest stable GitHub Release](https://github.com/krishna-swaroop/KiCAD-Prism/releases/latest)
and download:

- `kicad-prism-vX.Y.Z-linux-amd64.tar.gz`
- `kicad-prism-vX.Y.Z-linux-amd64.tar.gz.sha256`

Verify and extract:

```bash
sha256sum -c kicad-prism-vX.Y.Z-linux-amd64.tar.gz.sha256
tar -xzf kicad-prism-vX.Y.Z-linux-amd64.tar.gz
cd kicad-prism-vX.Y.Z-linux-amd64
sha256sum -c SHA256SUMS
```

Use a stable installation directory and keep it for future upgrades. Relative
paths in `compose.yml` deliberately keep project and SSH state under that
directory.

```text
/srv/kicad-prism/
├── compose.yml
├── .env
├── Caddyfile
├── VERSION
├── certs/
└── data/
    ├── projects/
    └── ssh/
```

For the first installation, move the extracted bundle contents into the chosen
directory before starting Prism.

## 2. Configure the environment

```bash
cp .env.example .env
mkdir -p data/projects data/ssh certs
```

Do not replace `PRISM_BACKEND_IMAGE` or `PRISM_FRONTEND_IMAGE` with mutable tags.
They are the tested image digests for this release.

At minimum, configure:

```env
POSTGRES_DB=kicad_prism
POSTGRES_USER=kicad_prism
POSTGRES_PASSWORD=<random-database-password>

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

Generate secrets independently:

```bash
openssl rand -base64 48
```

Keep `.env` readable only by the deployment administrator and backup process.
It contains database, OIDC, session, and optional Git credentials.

See [Configuration](CONFIGURATION.md) for the remaining settings.

## 3. Configure OIDC

Register both redirect URIs with the identity provider:

```text
https://prism.example.com/auth/callback
https://prism.example.com/oauth/oidc/callback
```

The issuer must use HTTPS and provide standard OIDC discovery metadata.
`AUTH_ENABLED=true` fails closed if the issuer, client credentials, session
secret, or database configuration is incomplete.

Use `BOOTSTRAP_ADMIN_USERS_STR` only to establish the first administrators.
After first login, verify explicit roles and keep at least two administrator
accounts.

Read [Authentication and access](AUTHENTICATION_AND_ACCESS.md) before onboarding
the team.

## 4. Configure HTTPS

The request path is:

```text
client -> TLS reverse proxy -> frontend:80 -> backend:8000
```

The release Compose file publishes the frontend only on
`127.0.0.1:${PRISM_HTTP_PORT:-8080}`. It does not publish the backend.

### Bundled Caddy

Edit `Caddyfile`, replace `prism.example.com`, point DNS to the host, and allow
inbound ports 80 and 443:

```bash
docker compose --profile proxy pull
docker compose --profile proxy up -d --wait
```

For a private CA or custom certificate:

1. replace `Caddyfile` with `Caddyfile.internal`;
2. place `prism.crt` and `prism.key` in `certs/`;
3. distribute the issuing root CA to browsers and KiCad workstations;
4. start the same `proxy` profile.

### Existing reverse proxy

Start Prism without the proxy profile and route the host proxy to
`http://127.0.0.1:8080`.

The proxy must preserve `Host` and forward the public protocol. Keep
`PUBLIC_BASE_URL` and `CORS_ORIGINS_STR` set to the exact external HTTPS origin.

## 5. Start and verify

Pulling by digest verifies that the registry content matches the bundle:

```bash
docker compose pull
docker compose up -d --wait
docker compose ps
```

Inspect startup:

```bash
docker compose logs --tail=100 postgres backend prism-worker catalog-worker frontend
```

Verify health through the frontend:

```bash
curl -fsS https://prism.example.com/healthz
curl -fsS https://prism.example.com/api/health/live
curl -fsS https://prism.example.com/api/health/ready
```

The readiness endpoint verifies PostgreSQL and writable project storage. It
returns HTTP 503 until both are available.

Verify public metadata:

```bash
curl -fsS https://prism.example.com/api/auth/config
curl -fsS https://prism.example.com/.well-known/kicad-remote-provider
curl -fsS https://prism.example.com/oauth/.well-known/oauth-authorization-server
```

Every advertised absolute URL must use the public HTTPS origin.

Sign in as a bootstrap administrator, assign roles, import a small test
repository, complete one comparison or workflow, and place one released
component before onboarding the wider team.

## Persistent state

A complete installation contains three persistence domains:

| Location | Contents |
| --- | --- |
| Docker volume `prism-postgres-data` | users, roles, sessions, projects, comments, catalog, jobs, and audit records |
| `data/projects` | Git checkouts, catalog assets, generated artifacts, caches, and exports |
| `data/ssh` | Prism Git identity and known-host state |

All three are required for complete recovery. Do not place them on ephemeral
container storage.

## Private Git hosting

For SSH:

1. sign in as an administrator;
2. open Settings and obtain Prism's SSH public key;
3. install it as a read-only deploy key or machine-user key;
4. verify and pin the Git host key;
5. test repository access before importing.

Automatic `ssh-keyscan` is disabled by default. Do not accept an unverified host
key simply to make import succeed.

For private GitHub HTTPS access, `GITHUB_TOKEN` is supported. Use a narrowly
scoped credential and store it only in the deployment secret store.

## Worker sizing

KiCad rendering, comparison, and catalog validation are CPU- and memory-heavy.
Start conservatively:

| Installation | Suggested starting point |
| --- | --- |
| Private evaluation | 4 vCPU, 16 GB RAM, one API worker, one general job, one catalog job |
| Small team | 8 vCPU, 32 GB RAM, two API workers, two general jobs, one catalog job |
| Larger or complex designs | benchmark representative projects before increasing concurrency |

The CPU and memory settings in `.env.example` are service ceilings. They are not
reservations and their sum should not exceed what the host can sustain alongside
PostgreSQL and filesystem cache.

Increase one concurrency class at a time. Monitor worker memory, job duration,
queue depth, PostgreSQL connections, and disk growth before raising it again.

## Releases without a deployment bundle

Releases created before this contract must be built from their tagged source:

```bash
git clone https://github.com/krishna-swaroop/KiCAD-Prism.git
cd KiCAD-Prism
git checkout <stable-release-tag>
cp .env.example .env
docker compose up --build -d
```

Record the tag, commit SHA, and rendered Compose configuration. This is also the
development path, but it is not preferred when a release bundle exists.

## Production readiness

Before declaring the service ready:

- OIDC fails closed when credentials are removed;
- browsers and KiCad workstations trust HTTPS;
- only the intended frontend or proxy ports are reachable;
- Prism image references remain digest-pinned;
- PostgreSQL, project data, SSH state, and `.env` are backed up;
- a restore has succeeded on an isolated host;
- the upgrade and rollback procedure has been rehearsed;
- disk-full and worker-failure behavior is understood;
- at least two administrators can access the workspace.

Continue with [Operations](OPERATIONS.md).
