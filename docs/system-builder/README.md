# System Builder

System Builder was removed from this branch on 2026-10-23, by the maintainer's
decision, so that the feature can be re-thought before it is built again.

- **Where the code is:** tag `archive/system-builder-v1-dev` (this branch with
  System Builder v1) and tag `archive/system-builder-v2` (the feature branch
  with System Builder v2). Read v1's contracts with
  `git show archive/system-builder-v1-dev:docs/system-builder/CONTRACTS.md`.
- **What comes next:** the re-scoped System Builder is planned on the branch
  `feature/system-builder-v3`, starting from `docs/system-builder-v3/SCOPE.md`.

What stayed:

- `frontend/src/features/system-builder/placement/`: the harness geometry the
  3D viewer's bundle still imports (`kicad-prism-viewer/viewer/src/main.js`),
  with its goldens in `backend/tests/fixtures/system_builder/`. It goes when
  the viewer's multi-board scene does.
- the catalog's **mates with** relation and 3D model alignment, which are part
  data (`backend/app/api/catalog_part_relations.py`).

The database drops what System Builder made: workspace migration 123 drops the
v1 tables, and catalog migration 13 deletes the retired `module` and
`assembly` components.
