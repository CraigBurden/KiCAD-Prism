# Backend services

This map focuses on the catalog subsystem, whose public surface spans several
large modules. Read `AGENTS.md` at the repository root first.

## Catalog layering

Three files, and the names do not tell you which to use:

| File | Role |
| --- | --- |
| `component_catalog_service.py` | Compatibility import and runtime singleton. |
| `component_catalog_service_postgres.py` | Concrete PostgreSQL connection, schema initialization, and database-specific overrides. |
| `component_catalog_domain.py` | Inherited catalog API and behavior, including SQL through the connection abstraction and file-backed assets. |

`ComponentCatalogPostgresService` inherits the large
`ComponentCatalogDomainService`; the latter is not storage-neutral despite its
name. Navigate it with symbol search rather than loading the file wholesale.
Useful search terms are `project_import`, `folder_import`, `metadata_batch`,
`validation`, `_klc_`, `preview`, `asset`, `representation`, `release`, and
`dbl`. Public reads generally begin with `list_`, `get_`, or `search_`.

Do not extend the inheritance split casually. When adding a cohesive capability,
first consider a narrow collaborator with a public API that both workers and
HTTP handlers can use; avoid creating another caller of private catalog methods.

## Catalog jobs

`catalog_worker_tasks.py` holds the `HANDLERS` table — the catalog worker's
equivalent of `job_handlers.py`:

`catalog_validation`, `catalog_preview_generation`, `project_component_import`,
`folder_library_import`, `artifact_maintenance`, `catalog_metadata_batch`.

The catalog wrapper restores `catalog_checkpoint` and `catalog_result` into the
legacy handler envelope and persists updates reported through `progress`.
Handlers that report checkpoints must therefore tolerate resumption and must
not duplicate completed work after a lease is reclaimed.

## Rules that live here

- **Fail closed.** `rate_limit_service.py` explains why the limiter denies on
  outage rather than allowing. Do not invert it for convenience.
- **Host keys are pinned.** `project_import_service.py` documents why
  `accept-new` was removed. Do not restore it.
- **Role-aware lookups only.** See the access-control section in the root
  `AGENTS.md`.
- **Audit identity comes from the session**, never from the request payload.

## Design comparison

`design_compare_service.py` orchestrates; `design_compare_nodes.py` parses;
`design_compare_semantics.py` groups; `design_compare_artifacts.py` persists
output; `design_compare_sources.py` resolves revisions. The correctness rules
for this pipeline are in
`frontend/src/components/design-comparison/AGENTS.md`, because most of the ways
to get it wrong are visible on the frontend side.

One backend rule: the viewer must never infer the old route from the comparison
object (`design_compare_nodes.py`). Each revision carries its own geometry.
