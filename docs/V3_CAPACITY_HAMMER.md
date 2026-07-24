# V3 Capacity Hammer (20-user sizing)

Hammer Prism with a mixed workload so you can size an EC2 (or any) VM from
measured Docker CPU/memory peaks, job outcomes, and client latency under
VPN-like delay.

Workload mix (default):

| Cohort | Count | Behavior |
| --- | ---: | --- |
| Heavy | 5 | Design Comparison **or** WebGPU 3D (50/50), then interactive/catalog burst |
| Standard | 15 | Project browse + randomized Remote Symbol search + place (~80% signed asset download, ~20% inline) |

Legacy Visual Diff is **not** in this matrix.

## Prerequisites

1. Stack healthy (`frontend` on `:8080`, `backend`, `prism-worker`, `catalog-worker`, Postgres).
2. Auth: signed `kicad_prism_session` **or** bearer token.
3. Host Python with `aiohttp`, **or** the loadtest image.

Mint a session cookie (uses `.env` `SESSION_SECRET`):

```bash
python3 scripts/mint_benchmark_session.py
export PRISM_BENCHMARK_SESSION_COOKIE="$(cat /tmp/prism-benchmark-session.txt)"
```

Or mint a remote-panel bearer via `scripts/bootstrap_remote_panel_loadtest_client.sh`
and pass `--bearer-token` (panel/search/assets only; heavy jobs still need a
full Prism session or admin-capable bearer).

## Application-level VPN delay (default)

`--network-delay-ms` / `--network-jitter-ms` sleep before each HTTP call:

- counted in **client** latency
- excluded from **server** latency
- defaults: 45 ms one-way ≈ 90 ms RTT, ±25 ms jitter, 0.1% simulated loss

```bash
python3 scripts/benchmark_concurrent_users.py \
  --base-url http://127.0.0.1:8080 \
  --users 20 --heavy-users 5 \
  --duration 600 \
  --network-delay-ms 45 --network-jitter-ms 25 --network-loss-pct 0.1 \
  --session-cookie "$PRISM_BENCHMARK_SESSION_COOKIE" \
  --output /tmp/v3-capacity-hammer.json
```

## Kernel netem (closer to real VPN)

App delay models RTT; it does not shape TCP congestion or MTU. On Linux (or a
Linux loadtest container with `NET_ADMIN`), add netem on the client egress:

```bash
# ~90 ms RTT, jitter, light loss — run as root on the load-generator namespace
tc qdisc add dev eth0 root netem delay 45ms 25ms distribution normal loss 0.1%
# clear when done
tc qdisc del dev eth0 root
```

Then set `--network-delay-ms 0` so you do not double-count delay.

Docker Compose helper (optional):

```bash
./scripts/run_capacity_hammer.sh
```

## Docker network run

```bash
docker build -f loadtest/Dockerfile -t kicad-prism-loadtest .
docker run --rm --network <prism-network> \
  --entrypoint python \
  -e PRISM_BENCHMARK_SESSION_COOKIE \
  -v "$(pwd)/tmp-results:/results" \
  kicad-prism-loadtest \
  /loadtest/benchmark_concurrent_users.py \
  --base-url http://frontend \
  --users 20 --heavy-users 5 --duration 600 \
  --network-delay-ms 45 --network-jitter-ms 25 \
  --output /results/v3-capacity-hammer.json
```

## Reading the report

- **Server latency** — time inside HTTP (capacity of API/DB).
- **Client latency** — server + injected VPN delay (what users feel).
- **Heavy jobs** — Design Comparison / WebGPU completed / failed / timeout.
- **Place / assets** — manifest + signed download success/bytes.
- **Container peaks** — drive EC2 vCPU / GiB recommendation (≈2× mem headroom).
- **Queue metrics** — `/api/jobs/benchmark-metrics` claim/update/pool wait.

Sizing notes for V3:

- Keep `UVICORN_WORKERS=1` on the API until multi-process API isolation is
  re-validated; scale `prism-worker` slots/concurrency and CPU ceilings instead.
- Put `data/projects` on local NVMe (`gp3`/`io2`), not EFS/NFS.
- Separate API vs worker CPU/memory ceilings so heavy jobs cannot starve reads.

## EC2 readiness checklist

Architecture is ready for a **private** EC2/VPC deploy of V3.0.0-alpha if:

- [ ] OIDC (or approved auth) configured; `SESSION_COOKIE_SECURE=true` behind HTTPS
- [ ] TLS terminator (Caddy/ALB/Nginx) with correct `PUBLIC_BASE_URL` / CORS
- [ ] Postgres durable volume + backups; projects volume on local disk
- [ ] `prism-worker` and `catalog-worker` running; slot env tuned from hammer
- [ ] Monitoring on job queue depth, worker heartbeats, disk for artifact store
- [ ] VPN/security group restricts access; signed asset URLs treated as secrets

Not production-hardened yet:

- Legacy Visual Diff still runs in-API threads (out of V3 capacity model)
- No multi-AZ / HA story beyond single-host Compose
- Cold Design Comparison / WebGPU still CPU-heavy (size for peaks, not averages)
