# System Builder

System Builder is being rebuilt. The design is
[ADR: System Builder v2](../architecture/adr-system-builder-v2.md): a system
schematic over boards referenced by design-bundle revision, sub-ports, harness
blocks, mate-derived placement, and a `prism.system.v2` document edited by
operations.

**Stage 0 (done)** removed System Builder v1: its frontend, API, services and
tables, the catalog's `module` and `assembly` kinds, and the mesh 3D path. The
feature branch has no System Builder UI until stage 2 lands.

**Stage 1 (in progress)** is the headless core. Its contracts are
[`CONTRACTS.md`](CONTRACTS.md): the `prism.system.v2` document, the
`prism.system.ops.a0` operations with recorded-inverse undo, storage, the
`/api/systems` routes, redaction and limits. The TypeSpec is
`native/src/tsp/prism/system-v2.tsp` and `system-ops-a0.tsp`.

## What v1 left behind

Kept in place for stage 1 to take over:

- `backend/app/services/systems/placement/` and its TypeScript port
  `frontend/src/features/system-builder/placement/`: connector frames, mates,
  poses, harness ends, nodes, curves, routes and checks. Both replay the
  goldens in `backend/tests/fixtures/system_builder/`.
- `backend/app/services/systems/connector_detection.py`: which components are
  connectors, in a fixed rule order.

## The v1 documents

v1's contracts, user guide, manifest schema and examples are no longer in the
tree. Code comments still cite them (for example "CONTRACTS_P2 §14" in the
placement maths). Read them at the last commit that had them:

```bash
git show 59b3e190:docs/system-builder/CONTRACTS.md
git show 59b3e190:docs/system-builder/CONTRACTS_P2.md
git show 59b3e190:docs/system-builder/USER_GUIDE.md
git show 59b3e190:docs/system-builder/schemas/system_manifest.v1.schema.json
```

