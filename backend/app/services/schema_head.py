"""Bring every PostgreSQL schema Prism owns to head, in dependency order.

The backend calls :func:`bring_every_schema_to_head` once at startup. Each
schema has one :class:`~app.services.schema_ledger.Ledger`; services that also
reconcile something on every start (the workspace origin backfill, the
catalog's baseline and derived indexes, the bootstrap admin rows) do it through
their own initialiser, which runs the ledger first. Workers and lazily
initialised services call the same initialisers, so a process that starts
before the backend still finds its schema at head.

Order: the workspace and auth ledgers share the ``workspace`` schema; comments
read workspace tables through their search path; the catalog is independent;
the artifact store's ``operations`` schema comes last because catalog retention
joins it to catalog tables.
"""

from __future__ import annotations

from app.services.artifact_schema_migrations import ARTIFACT_LEDGER
from app.services.auth_schema_migrations import AUTH_LEDGER
from app.services.catalog_schema_migrations import CATALOG_LEDGER
from app.services.comments_schema_migrations import COMMENTS_LEDGER
from app.services.schema_ledger import Ledger
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER

LEDGERS: tuple[Ledger, ...] = (
    WORKSPACE_LEDGER,
    AUTH_LEDGER,
    COMMENTS_LEDGER,
    CATALOG_LEDGER,
    ARTIFACT_LEDGER,
)


def bring_every_schema_to_head() -> None:
    from app.services import access_service
    from app.services.comments_store_service import comments_store
    from app.services.component_catalog_service import catalog_service
    from app.services.postgres_database import database
    from app.services.workspace_service import workspace

    workspace.initialize()
    access_service.initialize_role_store()
    comments_store.initialize()
    catalog_service.initialize()
    ARTIFACT_LEDGER.migrate(database.connection)


__all__ = ["LEDGERS", "bring_every_schema_to_head"]
