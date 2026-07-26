# Operations

This runbook covers the minimum operational practices for a shared KiCAD Prism
installation.

## What must be backed up

A recoverable backup contains one consistent set of:

1. PostgreSQL;
2. `data/projects`;
3. `data/ssh`;
4. the deployed `.env` from the host secret store;
5. the deployed Prism commit SHA and KiCad base-image identity.

PostgreSQL alone cannot restore component assets or imported repositories.
Project storage alone cannot restore roles, sessions, comments, catalog
metadata, jobs, or audit records.

## Logical backup

Choose a maintenance window or otherwise ensure the database dump and filesystem
snapshot represent a known point in time.

Record the version:

```bash
git rev-parse HEAD
docker compose images
```

Create a PostgreSQL custom-format dump, substituting the configured database and
user:

```bash
docker compose exec -T postgres \
  pg_dump -U kicad_prism -d kicad_prism -Fc \
  > prism-postgres.dump
```

Archive persistent files:

```bash
tar -C data -czf prism-files.tar.gz projects ssh
```

Copy the dump, archive, environment configuration, and version record to storage
that is not on the Prism host. Encrypt backups according to company policy
because repositories, catalog assets, and SSH private keys may be confidential.

## Restore test

Test restores on an isolated host:

1. check out the recorded Prism revision;
2. restore `.env` without exposing the test host publicly;
3. start only PostgreSQL;
4. restore `data/projects` and `data/ssh`;
5. restore the database;
6. start backend and workers;
7. start frontend;
8. verify login, one project, comments, one comparison, Library Manager, and one
   Remote Symbol placement.

Example database restore into the fresh configured database:

```bash
docker compose up -d postgres
docker compose exec -T postgres \
  pg_restore -U kicad_prism -d kicad_prism --clean --if-exists \
  < prism-postgres.dump
```

Run this only against the isolated restore target. `--clean` replaces objects in
the target database.

## Upgrade

1. read the release notes and identify schema, environment, image, and session
   changes;
2. create and verify a fresh backup;
3. record the current commit and image digests;
4. fetch and check out the target tag or commit;
5. compare `.env.example` with the deployed `.env`;
6. render Compose with `docker compose config --quiet`;
7. rebuild and start;
8. watch PostgreSQL, backend, and worker logs;
9. run the post-upgrade verification checklist.

```bash
docker compose up --build -d
docker compose logs --tail=200 postgres backend prism-worker catalog-worker
```

Do not assume an older application can read a database after a forward schema
migration. A rollback may require restoring the pre-upgrade PostgreSQL and file
backup together.

## Post-change verification

- OIDC login and logout
- viewer and designer permissions
- repository import or synchronization
- schematic, PCB, and BOM display
- Design Comparison completion
- comment creation and resolution
- one jobset and artifact download
- catalog search and release queue
- Remote Symbol Provider discovery and placement
- backup job completion

## Logs and job diagnosis

```bash
docker compose ps
docker compose logs --tail=200 backend
docker compose logs --tail=200 prism-worker
docker compose logs --tail=200 catalog-worker
docker compose logs --tail=200 postgres
docker compose logs --tail=200 frontend
```

For a failed user job, capture its job identifier, type, requested project or
component, attempt logs, worker logs, and the source commit. Retrying without
capturing those details makes intermittent failures difficult to diagnose.

## Capacity and retention

Monitor:

- host and Docker disk usage;
- PostgreSQL volume growth;
- `data/projects/.kicad-prism` artifact growth;
- worker memory during the largest designs;
- queued and repeatedly retried jobs;
- catalog import and validation duration.

Use the configured artifact and partial-output retention settings. Do not delete
unknown directories inside `.kicad-prism` by hand. Confirm whether an item is
authoritative data or a regenerable cache first.

## Common failures

### Frontend returns 502

Inspect backend startup. Common causes are invalid auth settings, PostgreSQL
unavailability, or a migration/startup exception.

### Imported projects disappear

Verify the host's `data/projects` mount, permissions, and restored content. Then
verify workspace rows in PostgreSQL; both are required.

### Authentication loops

Check exact redirect URIs, `PUBLIC_BASE_URL`, CORS, proxy headers, cookie Secure
behavior, and the host clock.

### Jobs remain queued

Confirm the appropriate worker is running and connected to the same
`PRISM_DATABASE_URL`. Inspect leases and worker logs before restarting.

### Catalog metadata exists but placement fails

Verify the released revision's asset files exist in persistent storage and that
provider metadata advertises the correct origin.

### Disk is full

Stop new imports and generation. Preserve PostgreSQL and authoritative assets
before removing anything. Move or expire known generated job artifacts through a
documented retention path rather than deleting arbitrary directories.
