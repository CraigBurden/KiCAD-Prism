# V3.0.0-alpha Acceptance Report

Date: 2026-07-24

Environment: Docker Desktop Linux ARM64, 10 logical CPUs, 7.75 GiB assigned
memory, native KiCad 10.0.4 ARM64 image, local kicad-monkey 2026.7.17, Python
3.12.8, PostgreSQL 17.

Legacy Visual Diff is excluded from this milestone's migration, capacity model,
benchmarks, and acceptance gates.

## Functional and recovery matrix

| Area | Evidence | Result |
| --- | --- | --- |
| PostgreSQL queue and sole coordination plane | Job schema/service and live workers use PostgreSQL claims, leases, locks, slots, and artifact rows | Pass |
| At-least-once lease recovery | Expired lease reclaim and stale-fence rejection integration tests | Pass |
| Fenced publication | Stale completion and sidecar publication tests | Pass |
| Active-request deduplication | Concurrent enqueue/cache tests and live heavy requests shared one physical job | Pass |
| DB-backed kind/resource limits | Multi-worker claim tests for WebGPU, Design Comparison, workflow, import, and semantic slots | Pass |
| Project/repository exclusion | Transactional shared/exclusive lock tests | Pass |
| Cancellation | Pre-launch cancellation and supervised process-group termination tests | Pass |
| Database outage | Worker heartbeat/read failure tests prevent false publication and terminate safely | Pass |
| Disk/staging failure | Artifact promotion failure tests leave no authoritative partial artifact | Pass |
| API/worker isolation | API and worker run as separate containers with independent DB pools and Compose `cpus`/`mem_limit` ceilings (limits, not Kubernetes-style reservations) | Pass |
| Immutable completed artifacts | Digest object store, authenticated reads, cache hits with object validation, reconciliation, retention, and GC tests | Pass |
| Design Comparison sidecars | Six fenced sidecars, authenticated immutable URLs, concurrent frontend loader, backend/frontend tests | Pass |
| WebGPU O(1) readiness | Ready metadata table; fast status never invokes git or scans sources (full/abbrev SHA via DB; symbolic refs return unresolved) | Pass |
| Workspace bootstrap/read cache | Versioned one-query bootstrap, ETag, role visibility, Git SHA caches, optional totals | Pass |
| Remote-provider projection | Released-only projection, version/ETag, capped paging, projection-backed search/category reads | Pass |
| Thumbnail path | Hashed immutable WebP, maximum 640×480, quality fallback to at most 250 KiB | Pass |
| Catalog fixture isolation | PostgreSQL integration tests now retire temporary-file-backed fixtures in teardown | Pass |

## Test suites

- Backend: 157 tests passed, 6 skipped in the full container run.
- Focused queue/worker/artifact/compare: 61 tests passed.
- Live PostgreSQL job integration: 7 tests passed.
- Live catalog PostgreSQL integration: 6 tests passed.
- Design Comparison backend: 42 tests passed.
- Frontend: 9 test files, 42 tests passed.
- Frontend lint and production build: passed.
- Docker native ARM64 builds for backend, worker, catalog worker, and frontend:
  passed.

## JTYU-OBC Design Comparison timing

Cold physical job:

| Stage | Wall time |
| --- | ---: |
| Full comparison ready | 38.6 s |
| Concurrent initial revision pipeline | 25.7 s |
| Base semantic index | 20.6 s |
| Compare semantic index | 21.4 s |
| Base semantic `load-project` | 15.6 s |
| Compare semantic `load-project` | 16.6 s |
| Concurrent PCB revision pipeline | 11.1 s |
| Base PCB geometry | 7.6 s |
| Compare PCB geometry | 7.5 s |
| Schematic semantic diff | 1.1 s |

Warm physical job:

| Stage | Wall time |
| --- | ---: |
| Full comparison ready | 3.1 s |
| Revision cache resolution | 2.2 s |
| Schematic semantic diff | 0.51 s |
| Schematic geometry diff | 0.08 s |
| PCB geometry diff | 0.07 s |
| Route metrics | 0.06 s |

The cold path is dominated by kicad-monkey project loading and semantic
extraction. Comparison assembly is not the bottleneck. Base and Compare work
overlaps as intended.

## Concurrent-user benchmarks

Baseline: 20 standard users, 30-second target window.

| Metric | Result |
| --- | ---: |
| Requests | 6,026 |
| Throughput | 176.5 req/s |
| Overall p50 / p95 / p99 | 17.2 / 98.1 / 258.8 ms |
| Workspace bootstrap p95 | 65.7 ms |
| Commit history p50 / p95 | 25.7 / 355.3 ms |
| Remote search p95 | 166.9 ms |
| Category listing p95 | 76.4 ms |

Mixed physical run: 20 users, including four heavy users. The physical Design
Comparison completed in 4.1 seconds with warm revision caches. The physical
WebGPU build completed in 56.0 seconds; its compiler subprocess consumed 47.9
seconds. While those jobs ran:

| Metric | Result | Gate |
| --- | ---: | ---: |
| Overall read p95 | 103.7 ms | ≤ 2× idle (196.2 ms) |
| Workspace bootstrap p95 | 49.2 ms | ≤ 2× idle |
| Commit history p50 / p95 | 32.3 / 155.5 ms | < 150 / < 400 ms |
| Remote search p95 | 154.9 ms | < 500 ms |
| Category listing p95 | 73.2 ms | < 400 ms |
| Design Comparison status p95 | 37.2 ms | < 100 ms |
| WebGPU status p95 | 10.3 ms | < 100 ms |
| Job update rate p95 / max | 2.19 / 2.27 per second | approximately ≤ 3/s |
| Queue claim p95 / max | 4.60 / 4.83 s | bounded by worker polling/claim cycle |
| API thread-pool queue after run | 0 | no backlog |
| API DB waiters after run | 0 | no backlog |

The mixed run revealed a compatibility bug: WebGPU result metadata's artifact
status (`ready`) overwrote the authoritative queue status (`completed`) on the
legacy project-job endpoint. Four clients therefore continued polling until the
benchmark timeout even though the job had completed. The merge order is fixed
and regression-tested.

A post-fix 20-user/four-heavy-user probe completed 15 cached Design Comparison
and 15 cached WebGPU requests per kind with no timeouts. Overall p95 was 70.4
ms; Design Comparison status p95 was 35.1 ms and WebGPU status p95 was 5.7 ms.

## Known benchmark-data note

The initial reports included failures from a released PostgreSQL integration
fixture whose assets lived in a deleted temporary directory. This was not load
shedding or job interference. The fixture was retired from the active provider
projection, and integration-test teardown now retires all components it creates.
The component remains as an auditable tombstone rather than being hard-deleted.

## Alpha decision

The V3 job foundation meets the 20-user/four-heavy-user correctness, isolation,
interactive latency, status latency, deduplication, update-rate, and recovery
gates on the measured native ARM64 environment. The implementation is suitable
for V3.0.0-alpha.

The most valuable next optimization is inside cold semantic extraction,
especially kicad-monkey `load-project`. It should be pursued with persistent
parsed-project/index reuse or an incremental semantic cache, not by increasing
unbounded worker concurrency.
