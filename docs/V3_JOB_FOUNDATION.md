# V3 Job Foundation

V3.0.0-alpha moves Prism's production heavy work onto a PostgreSQL-coordinated
job system. PostgreSQL is the queue, lease authority, fencing authority,
deduplication authority, resource-slot coordinator, exclusion-lock coordinator,
and artifact metadata store.

Legacy Visual Diff is deliberately not part of this migration. Its existing
service remains available, but it is not scheduled by `prism-worker`, included
in V3 capacity calculations, or covered by the V3 benchmark matrix.

## Runtime topology

- `backend` serves interactive APIs and enqueues work. It does not run migrated
  compilers in request threads.
- `prism-worker` claims general heavy jobs and supervises each attempt in a
  separate process group.
- `catalog-worker` claims catalog-specific jobs from an independent pool.
- PostgreSQL owns job and artifact state. Workers can be added without adding
  Redis, Celery, or a process-local coordination layer.
- Completed artifacts live in a content-addressed store on the shared projects
  volume. Database rows point at immutable objects.

The migrated job kinds are:

- Design Comparison
- WebGPU 3D generation
- KiCad workflow/jobset execution
- project import, analysis, and synchronization
- semantic index/compile work
- catalog validation, preview, import, metadata-batch, and maintenance work

## Correctness model

Each claim increments a monotonically increasing fence. Every heartbeat,
progress update, completion, failure, and artifact publication includes that
fence. A stale attempt can finish its subprocess, but it cannot publish state or
replace the artifact owned by a newer attempt.

Jobs use renewable leases and at-least-once execution. An expired lease can be
reclaimed after a worker crash. Deduplication ensures equivalent active requests
share one job, while completed-artifact lookup turns repeat requests into cache
hits.

Resource requirements are acquired transactionally with the job claim. The
default deployment limits are:

```text
PRISM_WORKER_CONCURRENCY=4
PRISM_WEBGPU_CONCURRENCY=1
PRISM_DESIGN_COMPARE_CONCURRENCY=1
PRISM_WORKFLOW_CONCURRENCY=1
PRISM_IMPORT_CONCURRENCY=1
PRISM_SEMANTIC_COMPILE_SLOTS=2
```

These are PostgreSQL-backed slot caps, not host CPU reservations. Compose also
applies per-service `cpus` / `mem_limit` **ceilings** so the API cannot be starved
by an unbounded worker container, but Docker Desktop does not hard-guarantee CPU
shares the way Kubernetes `requests` would. Tune slot counts and container
limits together.

Repository and project exclusion locks are also database-backed. Read-compatible
jobs may overlap, while write/exclusive jobs cannot race a conflicting attempt
in another worker process.

## Cancellation and failure handling

- Cancellation is durable in PostgreSQL.
- A worker checks cancellation before launch and while supervising.
- Running subprocesses are placed in their own process group.
- Cancellation sends a graceful termination first, then kills the process group
  after `PRISM_JOB_CANCEL_GRACE_SECONDS`.
- Heartbeat/database failure prevents an attempt from publishing success.
- Retryable failures enter `retry_wait` with a future `available_at`.
- A partial or failed artifact never replaces a completed immutable object.
- Staging files and invalid/missing artifact rows are reconciled by maintenance.

## Artifact publication

Publication is a fenced two-step operation:

1. Write and validate a staging object.
2. Commit the terminal job update and artifact rows under the current fence.

Only then is the immutable object authoritative. Design Comparison publishes a
small manifest plus six independently addressable sidecars:

- core metadata
- schematic changes
- PCB changes
- BOM changes
- stackup changes
- document-diff navigation data

The API authorizes the parent project before serving any sidecar. The frontend
loads the sidecars concurrently, reducing initial parse pressure and avoiding a
single multi-megabyte JSON response.

Completed artifacts default to 30 days of retention. Partial artifacts default
to 24 hours:

```text
PRISM_JOB_ARTIFACT_RETENTION_DAYS=30
PRISM_JOB_PARTIAL_RETENTION_HOURS=24
```

## Design Comparison performance model

Both revision snapshots are generated concurrently with a bounded two-worker
pipeline. Initial schematic/BOM semantics are produced first; PCB and stackup
work follows as the second stage. Per-project/commit caches retain parsed
revision assets.

The benchmark recorder writes one JSON document per physical job attempt under
`.kicad-prism/jobs/<job-id>/benchmark-fence-<fence>.json`. It records wall time,
CPU time, thread, scope, status, peak RSS, cache hits, and nested semantic
generator events.

For JTYU-OBC on the native ARM64/local-kicad-monkey stack, the measured cold
comparison was 38.6 seconds. The two semantic indexes ran in parallel and took
21.4 and 20.6 seconds; PCB geometry ran in parallel and took 7.6 and 7.5
seconds. With both revision caches warm, the same comparison was ready in 3.1
seconds. This explains the earlier multi-minute observation: it was dominated
by cold revision asset generation and host CPU contention, not comparison
assembly or sequential Base/Compare scheduling.

## Operational endpoints and load tooling

Administrators can query:

```text
GET /api/jobs/benchmark-metrics?since=<ISO-8601>
```

The response contains:

- jobs and active jobs by kind/status
- queue-claim p50/p95/max
- job update-rate p95/max
- API PostgreSQL pool wait metrics
- API thread-pool utilization and queue depth

`scripts/benchmark_concurrent_users.py` supports a signed session cookie or
bearer token and exercises normal project/catalog reads alongside Design
Comparison and WebGPU jobs. It records endpoint distributions, heavy-job
outcomes, job/pool metrics, hardware details, and optional Docker samples.

The repository benchmark image includes both load harnesses. For the full
20-user capacity hammer (Design Comparison, WebGPU, remote search + asset
download, VPN-like delay, EC2 sizing notes), see
[`docs/V3_CAPACITY_HAMMER.md`](V3_CAPACITY_HAMMER.md) and
`scripts/run_capacity_hammer.sh`.

A reproducible Docker-network run:

```text
docker build -f loadtest/Dockerfile -t kicad-prism-loadtest .
docker run --rm --network <prism-network> \
  --entrypoint python \
  -e PRISM_BENCHMARK_SESSION_COOKIE \
  -v <report-directory>:/results \
  kicad-prism-loadtest \
  /loadtest/benchmark_concurrent_users.py \
  --base-url http://frontend \
  --users 20 --heavy-users 5 --duration 600 \
  --network-delay-ms 45 --network-jitter-ms 25 \
  --output /results/v3-concurrent-users.json
```

## Recovery runbook

1. Confirm PostgreSQL health.
2. Inspect `/api/jobs/<job-id>` and `/api/jobs/<job-id>/events`.
3. Inspect the fenced attempt log at `/api/jobs/<job-id>/logs`.
4. If a worker died, wait for the lease to expire or restart workers; do not
   edit the job row manually.
5. If an artifact object is missing, the read path invalidates the row. Requeue
   the request to regenerate it.
6. Run catalog artifact maintenance for staging cleanup, reconciliation,
   retention pruning, and garbage collection.
7. Scale worker process count only after reviewing DB-backed kind and semantic
   slot limits.
