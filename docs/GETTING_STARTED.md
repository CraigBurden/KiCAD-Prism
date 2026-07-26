# Getting started

This guide starts a local KiCAD Prism evaluation from source. It is not a
production deployment guide.

## Prerequisites

- Git
- Docker Engine with Docker Compose v2, or Docker Desktop
- a Linux AMD64 Docker host
- enough memory and disk for the projects you intend to import

Prism runs KiCad tooling inside its backend and workers. The documented public
source-build path uses the stable AMD64 KiCad runtime image from Docker Hub.

## 1. Clone and configure

```bash
git clone https://github.com/krishna-swaroop/KiCAD-Prism.git
cd KiCAD-Prism
cp .env.example .env
```

For a single-user local evaluation, set:

```env
AUTH_ENABLED=false
DEV_GUEST_ROLE=admin
UVICORN_WORKERS=1
```

This gives every visitor administrator access. Never use that configuration on
an interface reachable by other people.

## 2. Select the KiCad runtime image

Use the stable public KiCad image built for AMD64:

```env
KICAD_BASE_IMAGE=kicad/kicad:10.0.4
KICAD_BASE_PLATFORM=linux/amd64
DOCKER_PLATFORM=linux/amd64
```

Verify the image architecture and KiCad version before building Prism:

```bash
docker pull --platform linux/amd64 kicad/kicad:10.0.4
docker image inspect kicad/kicad:10.0.4 --format '{{.Architecture}}'
docker run --rm --platform linux/amd64 kicad/kicad:10.0.4 kicad-cli --version
```

## 3. Start Prism

```bash
docker compose up --build -d
docker compose ps
```

All five services should be running and PostgreSQL should report healthy:

- `kicad-prism-postgres`
- `kicad-prism-backend`
- `kicad-prism-worker`
- `kicad-prism-catalog-worker`
- `kicad-prism-frontend`

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

## 4. Import a project

1. Select **Import Project**.
2. Paste an HTTPS or SSH clone URL.
3. Wait for repository analysis.
4. Select the discovered project paths you want to register.
5. Start import and wait for the queued job to complete.
6. Open the project and inspect its Overview, Visualizers, History, Workflows,
   Assets, and Documentation sections.

For private repositories, configure SSH from Settings or provide the deployment
with appropriate Git credentials. See [Project workflows](PROJECT_WORKFLOWS.md).

## 5. Stop or reset

Stop the application without removing PostgreSQL data:

```bash
docker compose down
```

Do not add `--volumes` unless you intentionally want to destroy the PostgreSQL
database. Project and SSH data are stored in `./data` and are not removed by
`docker compose down`.

## Troubleshooting

### Backend image cannot be resolved

The configured `KICAD_BASE_IMAGE` does not exist locally and cannot be pulled.
Confirm that the configured stable KiCad tag exists in the public registry.

### Docker host architecture is unsupported

Confirm that the Docker host reports AMD64:

```bash
docker info --format '{{.Architecture}}'
docker image inspect kicad/kicad:10.0.4 \
  --format '{{.Architecture}}'
```

Both commands should report `amd64`. Set all three Docker/KiCad variables to the
documented AMD64 values and rebuild.

### Frontend returns 502

The frontend is up but the backend is not ready. Inspect:

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 postgres
```

### Authentication startup failure

`AUTH_ENABLED=true` fails closed when OIDC, session secret, or database settings
are incomplete. Use explicit guest mode only for a private local evaluation, or
complete [Authentication and access](AUTHENTICATION_AND_ACCESS.md).

## Next

- [Deployment](DEPLOYMENT.md)
- [Team adoption](TEAM_ADOPTION.md)
- [Configuration](CONFIGURATION.md)
