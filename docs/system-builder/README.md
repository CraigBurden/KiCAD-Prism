# System Builder

System Builder was removed from this branch on 2026-10-23, by the maintainer's
decision, so that the feature can be re-thought before it is built again.

- **Where the code is:** tag `archive/system-builder-v2` (the last commit of
  `feature/native-design-bundle` that had System Builder v2) and tag
  `archive/system-builder-v1-dev` (`dev` with System Builder v1).
- **The record:** [ADR: System Builder v2](../architecture/adr-system-builder-v2.md),
  now retired. Its contracts are at the tag:
  `git show archive/system-builder-v2:docs/system-builder/CONTRACTS.md`.
- **What comes next:** the re-scoped System Builder is planned on the branch
  `feature/system-builder-v3`, starting from `docs/system-builder-v3/SCOPE.md`.

What stayed, because it is board data or shared fixtures rather than System
Builder:

- the design bundle's `projections/system-interface.json` (connectors, pins and
  power nets of one board);
- `backend/tests/fixtures/system_builder/`, whose boards the native parity
  goldens and CLI tests read as sources;
- the catalog's harness part fields and **mates with**.

The database drops what System Builder made: workspace migration 129 drops the
`ws_system*` and `ws_board_sub_port*` tables, and catalog migration 16 deletes
published `system` entries and their `system_entry` assets.
