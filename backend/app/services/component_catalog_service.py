from app.core.config import settings
from app.services.component_catalog_service_sqlite import *  # noqa: F401,F403


if settings.CATALOG_DATABASE_URL.strip():
    from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService

    catalog_service = ComponentCatalogPostgresService()
