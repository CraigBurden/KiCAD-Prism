# Configuration

Docker Compose reads the repository-root `.env` file and passes settings to the
Prism services. The authoritative list and defaults live in `.env.example`.
Keep production values in a secret store or host-local file; never commit them.

## Core groups

### Identity and browser access

| Setting | Purpose |
| --- | --- |
| `WORKSPACE_NAME` | name shown on the login page |
| `AUTH_ENABLED` | explicit authentication switch |
| `DEV_GUEST_ROLE` | role used only when authentication is disabled |
| `OIDC_*` | OIDC issuer, client, claims, scopes, and provider label |
| `SESSION_SECRET` | signs session and provider tokens |
| `SESSION_TTL_HOURS` | absolute session lifetime |
| `SESSION_IDLE_TIMEOUT_MINUTES` | optional idle revocation |
| `PUBLIC_BASE_URL` | canonical public HTTPS origin |
| `CORS_ORIGINS_STR` | exact browser origins permitted to send credentials |
| `BOOTSTRAP_ADMIN_USERS_STR` | initial administrator emails |
| `DEFAULT_VIEWER_DOMAINS_STR` | optional implicit viewer domains |

`AUTH_ENABLED=true` fails closed if required identity, secret, or database
settings are incomplete.

### Database and workers

| Setting | Purpose |
| --- | --- |
| `PRISM_DATABASE_URL` | authoritative PostgreSQL connection URL |
| `PRISM_DATABASE_POOL_*` | connection pool bounds per process |
| `UVICORN_WORKERS` | API worker processes |
| `PRISM_WORKER_CONCURRENCY` | general queued-job concurrency |
| `CATALOG_WORKER_CONCURRENCY` | catalog queued-job concurrency |
| `PRISM_*_CONCURRENCY` | fenced slots for heavy job classes |
| `PRISM_JOB_*` | leases, heartbeat, cancellation, and artifact retention |

Database capacity must cover all API and worker pools, not only one process.

### Git import

| Setting | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | optional private GitHub HTTPS credential |
| `IMPORT_ALLOWED_HOSTS_STR` | comma-separated Git host allowlist |
| `IMPORT_ALLOW_INSECURE_HTTP` | permits plaintext HTTP remotes when explicitly required |
| `GIT_SCAN_KNOWN_HOSTS_ON_STARTUP` | optional host-key discovery during startup |

Prism rejects `file://`, local paths, embedded URL credentials, and Git remote
helper transports regardless of allowlist settings.

### Catalog and Remote Symbol Provider

Catalog settings control artifact roots, import limits, KLC validation, release
gating, DBL export, worker concurrency, and retention. Provider settings control
the OAuth client ID, token lifetimes, library prefix, and project destination
directory.

In Compose environment files, preserve the KiCad project variable with:

```env
REMOTE_PROVIDER_DESTINATION_DIR=$${KIPRJMOD}/RemoteLibrary
```

The doubled dollar sign prevents Compose from expanding the value before it
reaches Prism.

### Architecture

The following values must describe one native platform:

```env
KICAD_BASE_IMAGE=<native-kicad-image>
KICAD_BASE_PLATFORM=linux/arm64
DOCKER_PLATFORM=linux/arm64
```

or:

```env
KICAD_BASE_IMAGE=<native-kicad-image>
KICAD_BASE_PLATFORM=linux/amd64
DOCKER_PLATFORM=linux/amd64
```

## Project-level `.prism.json`

Place `.prism.json` in a KiCad project root when auto-detection does not find the
desired files or when the project needs a friendly name.

Example:

```json
{
  "project_name": "Power Distribution Unit",
  "description": "Primary and protected power distribution",
  "schematic": "hardware/pdu.kicad_sch",
  "pcb": "hardware/pdu.kicad_pcb",
  "documentation": "docs",
  "designOutputs": "build/design",
  "manufacturingOutputs": "build/fabrication",
  "thumbnail": "assets/thumbnail",
  "readme": "README.md",
  "jobset": "Outputs.kicad_jobset"
}
```

For compatibility, path fields can also be nested under a `paths` object.
Top-level fields take part in the same resolution.

Supported path fields:

- `schematic`
- `pcb`
- `subsheets`
- `designOutputs`
- `manufacturingOutputs`
- `documentation`
- `thumbnail`
- `readme`
- `jobset`

Resolution order is explicit `.prism.json`, auto-detection, then conventional
fallbacks. Paths are relative to the registered project root.

The schema currently accepts `workflows`, `portfolio`, and additional fields for
forward compatibility. Arbitrary `workflows` entries are not executed as
first-class custom workflows in V3 alpha; the product currently exposes its
fixed workflow types.

## Safe change procedure

1. Back up the current `.env`.
2. Compare it with the new `.env.example`.
3. change one setting group at a time;
4. render Compose before restart:

```bash
docker compose --env-file .env -f docker-compose.yml config --quiet
```

5. restart and inspect backend and worker logs;
6. verify authentication and one representative project operation.

Changing `SESSION_SECRET` revokes sessions and invalidates signed provider
tokens. Changing database or artifact roots without moving their data creates an
apparently empty installation.
