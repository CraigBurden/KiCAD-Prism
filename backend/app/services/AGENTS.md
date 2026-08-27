# Backend services

56 modules. Most are self-explanatory from their name and reasonably sized. This
file covers the catalog subsystem, which is neither. Read `AGENTS.md` at the
repository root first.

## Catalog layering

Three files, and the names do not tell you which to use:

| File | Lines | What it actually is |
| --- | --- | --- |
| `component_catalog_service.py` | 5 | A re-export shim. Not a service. |
| `component_catalog_service_postgres.py` | 1,156 | Persistence. SQL, transactions, row mapping. |
| `component_catalog_domain.py` | 8,200 | Everything else. |

`component_catalog_domain.py` is one class, `ComponentCatalogDomainService`,
with 194 methods. It performs archive handling, `kicad-cli` subprocess
invocation, XML parsing, CSV export, SHA-256 hashing, MIME detection, symbol and
footprint payload rewriting, and threading. **You will not fit it in context.**

Navigate it by method prefix rather than reading it:

| Prefix | Concern |
| --- | --- |
| `_klc_*` | KLC validation and release gating |
| `_preview_*` | Preview rendering and preview identity |
| `_import_*` | Ingest from projects and folders |
| `_export_*` | DBL export and CSV output |
| `_store_*`, `_asset_*`, `_write_*` | Asset object storage |
| `_symbol_*`, `_footprint_*` | KiCad payload rewriting |
| `list_*`, `get_*`, `search_*` | Read queries |

Decomposition along these prefixes is planned. Do not add a method that
straddles two of them.

## Catalog jobs

`catalog_worker_tasks.py` holds the `HANDLERS` table — the catalog worker's
equivalent of `job_handlers.py`:

`catalog_validation`, `catalog_preview_generation`, `project_component_import`,
`folder_library_import`, `artifact_maintenance`, `catalog_metadata_batch`.

Catalog jobs are checkpointed. A handler receives its prior checkpoint and
accumulated result and must tolerate resumption — a handler that assumes a cold
start will redo or duplicate work when a lease is reclaimed.

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
